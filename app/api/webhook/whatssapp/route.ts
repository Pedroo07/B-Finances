import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import {
  GoogleGenerativeAI,
  type GenerateContentRequest,
  type Part,
} from "@google/generative-ai";
import { getPhoneVariations } from "@/lib/utils";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { confirmDeleteTool } from "@/lib/whatsapp/tools";
import { resolveFindTransactionSelection } from "@/lib/whatsapp/handlers/findTransactionHandler";
import { interpretBFinanceCommand } from "@/lib/whatsapp/commands/commandInterpreter";
import { executeBFinanceCommand } from "@/lib/whatsapp/commands/commandExecutor";
import { formatBFinanceResponse } from "@/lib/whatsapp/commands/responseFormatter";
import { normalizeCommandFilters } from "@/lib/whatsapp/commands/normalizers/filterNormalizer";
import { normalizeCommandPeriod } from "@/lib/whatsapp/commands/normalizers/periodNormalizer";
import { normalizeCommandScope } from "@/lib/whatsapp/commands/normalizers/scopeNormalizer";
import type { BFinanceCommand } from "@/lib/whatsapp/commands/types";
import {
  getSession,
  updateSessionHistory,
  setPendingAction,
  getPendingAction,
  clearPendingAction,
  checkRateLimit,
} from "@/lib/whatsapp/utils/sessionManager";
import {
  getShortTermMemory,
  rememberShortTermTopic,
  type ShortTermMemorySnapshot,
} from "@/lib/whatsapp/utils/shortTermMemory";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const agentModels = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3-flash",
];

type PromptPayload = string | GenerateContentRequest | Array<string | Part>;

async function getUserIdByPhone(phoneNumber: string): Promise<string | null> {
  try {
    const variations = getPhoneVariations(phoneNumber);
    const snapshot = await db
      .collection("users")
      .where("phoneNumber", "in", variations)
      .limit(1)
      .get();

    if (!snapshot.empty) return snapshot.docs[0].id;
  } catch (err) {
    console.error("Erro ao buscar usuario por telefone:", err);
  }

  return null;
}

async function downloadWhatsAppAudio(mediaId: string): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  const mediaResponse = await fetch(
    `https://graph.facebook.com/v23.0/${mediaId}`,
    {
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
    },
  );

  if (!mediaResponse.ok) {
    const errorBody = await mediaResponse.text();
    console.error("META ERROR:", errorBody);
    throw new Error(
      `Erro ao buscar midia: ${mediaResponse.status} ${errorBody}`,
    );
  }

  const mediaData = await mediaResponse.json();
  const audioResponse = await fetch(mediaData.url, {
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
    },
  });

  if (!audioResponse.ok) {
    throw new Error(
      `Erro ao baixar audio: ${audioResponse.status} ${audioResponse.statusText}`,
    );
  }

  const arrayBuffer = await audioResponse.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: mediaData.mime_type || "audio/ogg",
  };
}

async function generateContentWithFallback(
  promptPayload: PromptPayload,
  systemInstruction?: string,
): Promise<string> {
  let lastError: unknown = null;

  for (const agent of agentModels) {
    try {
      const config: { model: string; systemInstruction?: string } = {
        model: agent,
      };
      if (systemInstruction) config.systemInstruction = systemInstruction;
      const model = genAI.getGenerativeModel(config);
      const result = await model.generateContent(promptPayload);
      return result.response.text();
    } catch (error) {
      console.warn(
        `Falha ou limite atingido no modelo ${agent}. Tentando o proximo da lista...`,
      );
      lastError = error;
    }
  }

  const errorMessage =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Todos os modelos falharam. Ultimo erro: ${errorMessage}`);
}

async function transcribeAudio(
  audioBuffer: Buffer,
  mimeType: string,
): Promise<string> {
  const promptPayload = [
    {
      inlineData: {
        mimeType,
        data: audioBuffer.toString("base64"),
      },
    },
    {
      text: "Transcreva apenas o conteudo deste audio em portugues. Retorne somente a transcricao, sem explicacoes.",
    },
  ];

  return await generateContentWithFallback(promptPayload);
}

function buildHistoryString(
  history: Array<{ role: string; text: string }> | undefined,
): string {
  if (!history || history.length === 0) return "Nenhum historico anterior.";
  return history.map((h) => `${h.role}: ${h.text}`).join("\n");
}

function normalizeFreeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isPendingActionResponse(messageText: string): boolean {
  const normalized = normalizeFreeText(messageText);

  return (
    /^#?\s*\d+\s*$/.test(normalized) ||
    /^(sim|s|confirmar|confirmo|pode apagar|pode deletar|pode excluir|nao|n|cancelar|cancela)$/.test(
      normalized,
    )
  );
}

function isCancelPendingResponse(messageText: string): boolean {
  const normalized = normalizeFreeText(messageText);
  return /^(cancelar|cancela|nao|n)$/.test(normalized);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPreviousBFinanceCommand(
  shortTermMemory?: ShortTermMemorySnapshot | null,
): BFinanceCommand | null {
  if (!shortTermMemory) return null;

  for (const turn of [...shortTermMemory.turns].reverse()) {
    if (
      turn.toolName === "bfinance_command" &&
      isRecord(turn.parameters.command)
    ) {
      return turn.parameters.command as BFinanceCommand;
    }
  }

  return null;
}

async function handlePendingActionIfApplicable(
  pendingAction: { type?: string; [key: string]: unknown },
  userId: string,
  fromPhoneNumber: string,
  messageText: string,
): Promise<boolean> {
  if (isCancelPendingResponse(messageText)) {
    await clearPendingAction(fromPhoneNumber);
    const reply = "Acao cancelada.";
    await sendWhatsAppMessage(fromPhoneNumber, reply);
    await updateSessionHistory(fromPhoneNumber, "assistant", reply);
    return true;
  }

  if (!isPendingActionResponse(messageText)) {
    await clearPendingAction(fromPhoneNumber);
    return false;
  }

  if (
    pendingAction.type === "delete_transaction" ||
    pendingAction.type === "delete_card_transaction" ||
    pendingAction.type === "delete_transaction_multiple" ||
    pendingAction.type === "delete_card_transaction_multiple"
  ) {
    const reply = await confirmDeleteTool.execute({
      userId,
      pendingAction,
      confirmation: messageText,
    });
    await clearPendingAction(fromPhoneNumber);
    await sendWhatsAppMessage(fromPhoneNumber, reply);
    await updateSessionHistory(fromPhoneNumber, "assistant", reply);
    return true;
  }

  if (pendingAction.type === "find_transaction_multiple") {
    const selection = resolveFindTransactionSelection(
      pendingAction,
      messageText,
    );

    if (selection.shouldClear) {
      await clearPendingAction(fromPhoneNumber);
    }

    await sendWhatsAppMessage(fromPhoneNumber, selection.message);
    await updateSessionHistory(fromPhoneNumber, "assistant", selection.message);
    return true;
  }

  await clearPendingAction(fromPhoneNumber);
  return false;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado com sucesso!");
    return new Response(challenge, { status: 200 });
  }

  console.warn("Falha na verificacao do webhook. Token invalido.");
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const messageEntry = data?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!messageEntry) {
      return NextResponse.json({ status: "ignored" });
    }

    const fromPhoneNumber = messageEntry.from;
    if (!fromPhoneNumber) {
      return NextResponse.json({ status: "ignored_no_sender" });
    }

    const userId = await getUserIdByPhone(fromPhoneNumber);
    if (!userId) {
      console.warn(
        `Mensagem recebida de numero nao cadastrado: ${fromPhoneNumber}`,
      );
      await sendWhatsAppMessage(
        fromPhoneNumber,
        "Ola! Nao encontramos nenhuma conta associada a este numero no B-Finances. Cadastre seu telefone no aplicativo para usar o bot do WhatsApp.",
      );
      return NextResponse.json({
        status: "error",
        error: "Unregistered phone number",
      });
    }

    const allowed = await checkRateLimit(fromPhoneNumber);
    if (!allowed) {
      await sendWhatsAppMessage(
        fromPhoneNumber,
        "Aguarde: voce esta enviando mensagens muito rapidamente.",
      );
      return NextResponse.json({ status: "rate_limited" });
    }

    let messageText = "";

    if (messageEntry.type === "text") {
      messageText = messageEntry.text?.body?.trim() || "";
    }

    if (messageEntry.type === "audio") {
      const mediaId = messageEntry.audio?.id;
      if (!mediaId) {
        return NextResponse.json({ status: "audio_without_media_id" });
      }

      console.log("Recebido audio:", mediaId);
      const { buffer, mimeType } = await downloadWhatsAppAudio(mediaId);
      messageText = await transcribeAudio(buffer, mimeType);
      console.log("Transcricao:", messageText);
    }

    if (!messageText) {
      return NextResponse.json({ status: "unsupported_or_empty_message" });
    }

    await updateSessionHistory(fromPhoneNumber, "user", messageText);
    const shortTermMemory = getShortTermMemory(fromPhoneNumber);
    const pendingAction = await getPendingAction(fromPhoneNumber);

    if (pendingAction) {
      const handledPending = await handlePendingActionIfApplicable(
        pendingAction,
        userId,
        fromPhoneNumber,
        messageText,
      );

      if (handledPending) {
        return NextResponse.json({ status: "success" });
      }
    }

    const session = await getSession(fromPhoneNumber);
    const conversationHistory = buildHistoryString(session?.history);
    const currentDate = new Date();
    const previousCommand = getPreviousBFinanceCommand(shortTermMemory);
    const interpretedCommand = await interpretBFinanceCommand({
      messageText,
      conversationHistory,
      shortTermMemory,
      currentDate,
    });
    const normalizerContext = { previousCommand };

    let command = normalizeCommandPeriod(
      messageText,
      interpretedCommand,
      currentDate,
      normalizerContext,
    );
    command = normalizeCommandScope(
      messageText,
      command,
      currentDate,
      normalizerContext,
    );
    command = normalizeCommandFilters(
      messageText,
      command,
      currentDate,
      normalizerContext,
    );

    console.log("B-Finances command:", JSON.stringify(command));

    const commandResult = await executeBFinanceCommand({
      userId,
      command,
      messageText,
      conversationHistory,
      phoneNumber: fromPhoneNumber,
    });

    if (
      commandResult.success &&
      commandResult.kind === "ready_message" &&
      commandResult.pendingAction
    ) {
      await setPendingAction(fromPhoneNumber, commandResult.pendingAction);
    }

    const reply = formatBFinanceResponse(commandResult);
    await sendWhatsAppMessage(fromPhoneNumber, reply);

    rememberShortTermTopic(fromPhoneNumber, {
      toolName: "bfinance_command",
      parameters: { command },
      userMessage: messageText,
      assistantReply: reply,
    });

    await updateSessionHistory(fromPhoneNumber, "assistant", reply);

    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("Erro no processamento:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

