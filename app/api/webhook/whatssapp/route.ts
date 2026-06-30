import { NextResponse } from "next/server";
import { db } from "@/lib/firebaseAdmin";
import {
  GoogleGenerativeAI,
  type GenerateContentRequest,
  type Part,
} from "@google/generative-ai";
import { getPhoneVariations } from "@/lib/utils";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

import { classifyIntent } from "@/lib/whatsapp/intents/intentClassifier";
import { IntentType } from "@/lib/whatsapp/intents/intentTypes";

import { handleAddTransaction } from "@/lib/whatsapp/handlers/addTransactionHandler";
import { handleQuery } from "@/lib/whatsapp/handlers/queryHandler";
import {
  handleDelete,
  confirmDelete,
} from "@/lib/whatsapp/handlers/deleteHandler";
import { handlePayment } from "@/lib/whatsapp/handlers/paymentHandler";
import { handleInvestment } from "@/lib/whatsapp/handlers/investmentHandler";
import { handleNotificationToggle } from "@/lib/whatsapp/handlers/notificationHandler";
import { formatHelpMessage } from "@/lib/whatsapp/formatters/responseFormatter";

import {
  getSession,
  updateSessionHistory,
  setPendingAction,
  getPendingAction,
  clearPendingAction,
  checkRateLimit,
} from "@/lib/whatsapp/utils/sessionManager";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const agentModels = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3-flash",
];

async function getUserIdByPhone(phoneNumber: string): Promise<string | null> {
  try {
    const variations = getPhoneVariations(phoneNumber);
    const snapshot = await db
      .collection("users")
      .where("phoneNumber", "in", variations)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }
  } catch (err) {
    console.error("Erro ao buscar usuário por telefone:", err);
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
      `Erro ao buscar mídia: ${mediaResponse.status} ${errorBody}`,
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
      `Erro ao baixar áudio: ${audioResponse.status} ${audioResponse.statusText}`,
    );
  }

  const arrayBuffer = await audioResponse.arrayBuffer();

  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: mediaData.mime_type || "audio/ogg",
  };
}

type PromptPayload = string | GenerateContentRequest | Array<string | Part>;

async function generateContentWithFallback(
  promptPayload: PromptPayload,
  systemInstruction?: string,
): Promise<string> {
  let ultimoErro: unknown = null;

  for (const agent of agentModels) {
    try {
      const config: { model: string; systemInstruction?: string } = {
        model: agent,
      };
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }
      const model = genAI.getGenerativeModel(config);
      const result = await model.generateContent(promptPayload);
      return result.response.text();
    } catch (error) {
      console.warn(
        `Falha ou limite atingido no modelo ${agent}. Tentando o próximo da lista...`,
      );
      ultimoErro = error;
    }
  }

  const errMsg =
    ultimoErro instanceof Error ? ultimoErro.message : String(ultimoErro);

  throw new Error(`Todos os modelos falharam. Último erro: ${errMsg}`);
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
      text: "Transcreva apenas o conteúdo deste áudio em português. Retorne somente a transcrição, sem explicações.",
    },
  ];

  return await generateContentWithFallback(promptPayload);
}

function buildHistoryString(
  history: Array<{ role: string; text: string }> | undefined,
): string {
  if (!history || history.length === 0) return "Nenhum histórico anterior.";
  return history.map((h) => `${h.role}: ${h.text}`).join("\n");
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

  console.warn(
    "Falha na verificação do webhook. Token inválido ou mode incorreto.",
  );

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
        `Mensagem recebida de número não cadastrado: ${fromPhoneNumber}`,
      );
      await sendWhatsAppMessage(
        fromPhoneNumber,
        "⚠️ Olá! Não encontramos nenhuma conta associada a este número de telefone no B-Finances. Por favor, registre o seu número na tela de cadastro do aplicativo para poder utilizar o nosso bot do WhatsApp.",
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
        "⏳ Você está enviando mensagens muito rapidamente. Por favor, aguarde um momento.",
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

      console.log("Recebido áudio:", mediaId);

      const { buffer, mimeType } = await downloadWhatsAppAudio(mediaId);
      messageText = await transcribeAudio(buffer, mimeType);

      console.log("Transcrição:", messageText);
    }

    if (!messageText) {
      return NextResponse.json({ status: "unsupported_or_empty_message" });
    }

    await updateSessionHistory(fromPhoneNumber, "user", messageText);

    const pendingAction = await getPendingAction(fromPhoneNumber);

    if (pendingAction) {
      const lower = messageText.trim().toLowerCase();
      const isCancel =
        lower === "cancelar" ||
        lower === "não" ||
        lower === "nao" ||
        lower === "n";

      if (isCancel) {
        await clearPendingAction(fromPhoneNumber);
        const reply = "❌ Ação cancelada.";
        await sendWhatsAppMessage(fromPhoneNumber, reply);
        await updateSessionHistory(fromPhoneNumber, "assistant", reply);
        return NextResponse.json({ status: "success" });
      }

      if (
        pendingAction.type === "delete_transaction" ||
        pendingAction.type === "delete_card_transaction" ||
        pendingAction.type === "delete_transaction_multiple" ||
        pendingAction.type === "delete_card_transaction_multiple"
      ) {
        const reply = await confirmDelete(userId, pendingAction, messageText);
        await clearPendingAction(fromPhoneNumber);
        await sendWhatsAppMessage(fromPhoneNumber, reply);
        await updateSessionHistory(fromPhoneNumber, "assistant", reply);
        return NextResponse.json({ status: "success" });
      }
    }

    const session = await getSession(fromPhoneNumber);
    const conversationHistory = buildHistoryString(session?.history);

    const intentResult = await classifyIntent(messageText, conversationHistory);
    console.log("Intent classificada:", intentResult);

    let reply = "";

    switch (intentResult.intent) {
      case IntentType.ADD_TRANSACTION: {
        reply = await handleAddTransaction(
          userId,
          messageText,
          conversationHistory,
        );
        break;
      }

      case IntentType.QUERY_EXPENSES:
      case IntentType.QUERY_INCOME:
      case IntentType.QUERY_BALANCE:
      case IntentType.QUERY_CARD_INVOICE:
      case IntentType.QUERY_BILLS:
      case IntentType.QUERY_INVESTMENTS: {
        reply = await handleQuery(
          userId,
          intentResult.intent,
          intentResult.parameters || {},
        );
        break;
      }

      case IntentType.DELETE_TRANSACTION:
      case IntentType.DELETE_CARD_TRANSACTION: {
        const result = await handleDelete(
          userId,
          intentResult.intent,
          intentResult.parameters || {},
          fromPhoneNumber,
        );
        reply = result.message;
        if (result.needsConfirmation && result.pendingAction) {
          await setPendingAction(fromPhoneNumber, result.pendingAction);
        }
        break;
      }

      case IntentType.PAY_BILL:
      case IntentType.PAY_CARD_INVOICE: {
        reply = await handlePayment(
          userId,
          intentResult.intent,
          intentResult.parameters || {},
        );
        break;
      }

      case IntentType.ADD_INVESTMENT:
      case IntentType.REDEEM_INVESTMENT: {
        reply = await handleInvestment(
          userId,
          intentResult.intent,
          intentResult.parameters || {},
        );
        break;
      }

      case IntentType.TOGGLE_NOTIFICATIONS: {
        reply = await handleNotificationToggle(
          userId,
          intentResult.parameters || {},
        );
        break;
      }

      case IntentType.HELP: {
        reply = formatHelpMessage();
        break;
      }

      case IntentType.UNKNOWN:
      default: {
        reply =
          "🤔 Não entendi muito bem o que você quis dizer. Você pode digitar *ajuda* para ver o que eu sei fazer.";
        break;
      }
    }

    await sendWhatsAppMessage(fromPhoneNumber, reply);
    await updateSessionHistory(fromPhoneNumber, "assistant", reply);

    return NextResponse.json({ status: "success" });
  } catch (error) {
    console.error("Erro no processamento:", error);

    return NextResponse.json(
      {
        status: "error",
      },
      {
        status: 500,
      },
    );
  }
}
