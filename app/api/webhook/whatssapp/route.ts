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
import {
  beginUpdateForTarget,
  createQuerySelectionAction,
  handleUpdateTransactionPendingAction,
  isPendingQueryTransactionSelectionAction,
  isPendingUpdateTransactionAction,
  resolveQueryTransactionSelection,
  type PendingUpdateTransactionAction,
  type UpdateTransactionTarget,
} from "@/lib/whatsapp/handlers/updateTransactionHandler";
import { clearlyStartsNewCommand } from "@/lib/whatsapp/handlers/updateTransactionFlow";
import { interpretBFinanceCommand } from "@/lib/whatsapp/commands/commandInterpreter";
import { executeBFinanceCommand } from "@/lib/whatsapp/commands/commandExecutor";
import { formatBFinanceResponse } from "@/lib/whatsapp/commands/responseFormatter";
import { normalizeCommandFilters } from "@/lib/whatsapp/commands/normalizers/filterNormalizer";
import { normalizeCommandInstallments } from "@/lib/whatsapp/commands/normalizers/installmentNormalizer";
import { normalizeCommandCategory } from "@/lib/whatsapp/commands/normalizers/categoryNormalizer";
import { normalizeCommandUpdate } from "@/lib/whatsapp/commands/normalizers/updateNormalizer";
import { normalizeCommandPeriod } from "@/lib/whatsapp/commands/normalizers/periodNormalizer";
import { normalizeCommandScope } from "@/lib/whatsapp/commands/normalizers/scopeNormalizer";
import { normalizeCommandResource } from "@/lib/whatsapp/commands/normalizers/resourceNormalizer";
import type { BFinanceCommand } from "@/lib/whatsapp/commands/types";
import {
  getSession,
  updateSessionHistory,
  setPendingAction,
  getPendingAction,
  clearPendingAction,
  checkRateLimit,
  getLastTransactionReference,
  rememberLastTransactionReference,
} from "@/lib/whatsapp/utils/sessionManager";
import {
  getShortTermMemory,
  rememberShortTermTopic,
  type ShortTermMemorySnapshot,
} from "@/lib/whatsapp/utils/shortTermMemory";
import { getBrasiliaDate } from "@/lib/whatsapp/utils/brasiliaDate";
import { extractMoney } from "@/lib/whatsapp/utils/moneyParser";

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

function isNumericSelectionResponse(messageText: string): boolean {
  return /^#?\s*\d+\s*$/.test(messageText.trim());
}

function isCancelPendingResponse(messageText: string): boolean {
  const normalized = normalizeFreeText(messageText);
  return /^(cancelar|cancela|nao|n)$/.test(normalized);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function rememberTransactionTarget(
  phoneNumber: string,
  target: UpdateTransactionTarget,
): Promise<void> {
  await rememberLastTransactionReference(phoneNumber, {
    id: target.id,
    source: target.source,
    description: target.description,
    date: target.date,
    amount: target.amount,
    category: target.category ?? null,
    type: target.type,
    paymentMethod: target.paymentMethod ?? null,
    cardName: target.cardName ?? null,
    createdAt: target.createdAt ?? null,
  });
}

function buildPendingUpdateCriteriaCommand(
  pendingAction: PendingUpdateTransactionAction,
  messageText: string,
  currentDate: Date,
): BFinanceCommand | null {
  if (!pendingAction.command) return null;

  const normalized = normalizeFreeText(messageText);
  const latestReference = /\b(ultim[oa]|mais recente)\b/.test(normalized);
  const baseCommand: BFinanceCommand = {
    ...pendingAction.command,
    action: "update",
    resource: "transaction",
    period: undefined,
    filters: {},
    scope: {
      includeNormalTransactions: true,
      includeCardTransactions: true,
      cardName: null,
      excludeCardTransactions: false,
      paymentMethod: null,
      excludePaymentMethod: null,
    },
    update: {
      ...pendingAction.update,
      reference: latestReference
        ? "latest"
        : pendingAction.update?.reference ?? null,
      targetText: messageText.trim(),
    },
  };

  let command = normalizeCommandPeriod(messageText, baseCommand, currentDate);
  command = normalizeCommandScope(messageText, command, currentDate);
  command = normalizeCommandFilters(messageText, command, currentDate);

  const money = extractMoney(messageText);
  if (
    money &&
    !command.filters?.amount &&
    normalizeFreeText(messageText).replace(/\b(r\$|rs|reais?)\b/g, "").match(/^[\d.,\s-]+$/)
  ) {
    command.filters = { ...command.filters, amount: Math.abs(money.value) };
  }

  const hasStructuredCriterion = Boolean(
    command.filters?.description ||
      command.filters?.category ||
      (command.filters?.amount !== null &&
        command.filters?.amount !== undefined) ||
      command.period?.isExplicit ||
      command.scope?.cardName ||
      command.scope?.paymentMethod,
  );

  if (!hasStructuredCriterion && !latestReference) {
    command.filters = {
      ...command.filters,
      description: messageText.trim(),
    };
  }

  if (latestReference) {
    command.filters = {
      ...command.filters,
      limit: 1,
      orderBy: "date_desc",
    };
    if (/\b(despesa|gasto|compra)\b/.test(normalized)) {
      command.transactionType = "expense";
    } else if (/\b(receita|entrada|ganho)\b/.test(normalized)) {
      command.transactionType = "income";
    }
  }

  return command;
}

function formatResetTime(date: Date): string {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
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

function getCardSelectionOptions(
  pendingAction: { type?: string; [key: string]: unknown },
): Array<{ index: number; cardName: string }> {
  if (pendingAction.type !== "select_card_for_query") return [];
  if (!Array.isArray(pendingAction.cards)) return [];

  return pendingAction.cards.flatMap((card) => {
    if (!isRecord(card)) return [];
    const index = typeof card.index === "number" ? card.index : null;
    const cardName = typeof card.cardName === "string" ? card.cardName : null;
    return index && cardName ? [{ index, cardName }] : [];
  });
}

function resolveCardSelection(
  messageText: string,
  options: Array<{ index: number; cardName: string }>,
): string | null {
  const normalized = normalizeFreeText(messageText)
    .replace(/^#/, "")
    .replace(/[^a-z0-9]/g, "");
  const selectedIndex = Number(normalized);

  if (Number.isInteger(selectedIndex)) {
    return (
      options.find((option) => option.index === selectedIndex)?.cardName ?? null
    );
  }

  return (
    options.find(
      (option) =>
        normalizeFreeText(option.cardName).replace(/[^a-z0-9]/g, "") ===
        normalized,
    )?.cardName ?? null
  );
}

function commandWithSelectedCard(
  command: BFinanceCommand,
  cardName: string,
): BFinanceCommand {
  return {
    ...command,
    resource: "card_transaction",
    scope: {
      ...(command.scope ?? {
        includeNormalTransactions: false,
        includeCardTransactions: true,
      }),
      includeNormalTransactions: false,
      includeCardTransactions: true,
      cardName,
      excludeCardTransactions: false,
      paymentMethod: "credit_card",
      excludePaymentMethod: null,
    },
    data: command.data
      ? {
          ...command.data,
          cardName: command.data.cardName ?? cardName,
          paymentMethod: command.data.paymentMethod ?? "credit_card",
        }
      : command.data,
  };
}

async function handleCardSelectionPendingAction(
  pendingAction: { type?: string; [key: string]: unknown },
  userId: string,
  fromPhoneNumber: string,
  messageText: string,
): Promise<boolean> {
  const options = getCardSelectionOptions(pendingAction);
  const command = isRecord(pendingAction.command)
    ? (pendingAction.command as BFinanceCommand)
    : null;

  if (!command || options.length === 0) {
    await clearPendingAction(fromPhoneNumber);
    return false;
  }

  const selectedCard = resolveCardSelection(messageText, options);

  if (!selectedCard) {
    const reply = [
      "Não encontrei esse cartão na lista. Responda com o número ou o nome do cartão:",
      "",
      ...options.map((option) => `${option.index}. ${option.cardName}`),
    ].join("\n");
    await sendWhatsAppMessage(fromPhoneNumber, reply);
    await updateSessionHistory(fromPhoneNumber, "assistant", reply);
    return true;
  }

  const selectedCommand = commandWithSelectedCard(command, selectedCard);
  const sourceMessageText =
    typeof pendingAction.sourceMessageText === "string"
      ? pendingAction.sourceMessageText
      : messageText;
  const commandResult = await executeBFinanceCommand({
    userId,
    command: selectedCommand,
    messageText: sourceMessageText,
    phoneNumber: fromPhoneNumber,
  });

  if (
    commandResult.success &&
    commandResult.kind === "ready_message" &&
    commandResult.pendingAction
  ) {
    await setPendingAction(fromPhoneNumber, commandResult.pendingAction);
  } else if (
    commandResult.success &&
    commandResult.kind === "transaction_list" &&
    commandResult.items.length > 0
  ) {
    await setPendingAction(
      fromPhoneNumber,
      createQuerySelectionAction(commandResult.items),
    );
  } else {
    await clearPendingAction(fromPhoneNumber);
  }

  if (
    commandResult.success &&
    commandResult.kind === "transaction_created"
  ) {
    await rememberTransactionTarget(fromPhoneNumber, commandResult.item);
  }

  if (
    commandResult.success &&
    commandResult.kind === "ready_message" &&
    commandResult.updatedItem
  ) {
    await rememberTransactionTarget(
      fromPhoneNumber,
      commandResult.updatedItem,
    );
  } else if (
    commandResult.success &&
    commandResult.kind === "ready_message" &&
    isPendingUpdateTransactionAction(commandResult.pendingAction) &&
    commandResult.pendingAction.target
  ) {
    await rememberTransactionTarget(
      fromPhoneNumber,
      commandResult.pendingAction.target,
    );
  }

  const reply = formatBFinanceResponse(commandResult);
  await sendWhatsAppMessage(fromPhoneNumber, reply);
  rememberShortTermTopic(fromPhoneNumber, {
    toolName: "bfinance_command",
    parameters: { command: selectedCommand },
    userMessage: messageText,
    assistantReply: reply,
  });
  await updateSessionHistory(fromPhoneNumber, "assistant", reply);
  return true;
}

async function handlePendingActionIfApplicable(
  pendingAction: { type?: string; [key: string]: unknown },
  userId: string,
  fromPhoneNumber: string,
  messageText: string,
): Promise<boolean> {
  if (isCancelPendingResponse(messageText)) {
    await clearPendingAction(fromPhoneNumber);
    const reply = "Ação cancelada.";
    await sendWhatsAppMessage(fromPhoneNumber, reply);
    await updateSessionHistory(fromPhoneNumber, "assistant", reply);
    return true;
  }

  if (pendingAction.type === "select_card_for_query") {
    return await handleCardSelectionPendingAction(
      pendingAction,
      userId,
      fromPhoneNumber,
      messageText,
    );
  }

  if (pendingAction.type === "select_transaction_from_query") {
    if (!isPendingQueryTransactionSelectionAction(pendingAction)) {
      await clearPendingAction(fromPhoneNumber);
      const reply =
        "Essa lista foi criada em uma versão anterior. Faça a consulta novamente.";
      await sendWhatsAppMessage(fromPhoneNumber, reply);
      await updateSessionHistory(fromPhoneNumber, "assistant", reply);
      return true;
    }

    if (!isNumericSelectionResponse(messageText)) {
      await clearPendingAction(fromPhoneNumber);
      return false;
    }

    const selection = resolveQueryTransactionSelection(
      pendingAction,
      messageText,
    );

    if (selection.expired) {
      await clearPendingAction(fromPhoneNumber);
      const reply = "Essa lista expirou. Faça a consulta novamente.";
      await sendWhatsAppMessage(fromPhoneNumber, reply);
      await updateSessionHistory(fromPhoneNumber, "assistant", reply);
      return true;
    }

    if (!selection.valid || !selection.target) {
      const candidates = pendingAction.candidates;
      const reply = [
        "Número inválido. Escolha um item da lista ou envie “cancelar”.",
        candidates.length > 0
          ? `Use um número entre 1 e ${candidates.length}.`
          : null,
      ]
        .filter(Boolean)
        .join("\n");
      await sendWhatsAppMessage(fromPhoneNumber, reply);
      await updateSessionHistory(fromPhoneNumber, "assistant", reply);
      return true;
    }

    await rememberTransactionTarget(fromPhoneNumber, selection.target);
    const result = await beginUpdateForTarget(
      userId,
      selection.target,
    );
    if (result.pendingAction) {
      await setPendingAction(fromPhoneNumber, result.pendingAction);
    } else {
      await clearPendingAction(fromPhoneNumber);
    }
    await sendWhatsAppMessage(fromPhoneNumber, result.message);
    await updateSessionHistory(fromPhoneNumber, "assistant", result.message);
    return true;
  }

  if (pendingAction.type === "update_transaction") {
    if (clearlyStartsNewCommand(messageText)) {
      await clearPendingAction(fromPhoneNumber);
      return false;
    }

    if (
      isPendingUpdateTransactionAction(pendingAction) &&
      pendingAction.step === "criteria"
    ) {
      const pendingState = await handleUpdateTransactionPendingAction(
        userId,
        pendingAction,
        messageText,
      );
      if (!pendingState.needsCriteria) {
        await clearPendingAction(fromPhoneNumber);
        await sendWhatsAppMessage(fromPhoneNumber, pendingState.message);
        await updateSessionHistory(
          fromPhoneNumber,
          "assistant",
          pendingState.message,
        );
        return true;
      }

      const command = buildPendingUpdateCriteriaCommand(
        pendingAction,
        messageText,
        getBrasiliaDate(),
      );

      if (!command) {
        await clearPendingAction(fromPhoneNumber);
        return false;
      }

      const commandResult = await executeBFinanceCommand({
        userId,
        command,
        messageText,
        phoneNumber: fromPhoneNumber,
      });

      if (
        commandResult.success &&
        commandResult.kind === "ready_message" &&
        commandResult.pendingAction
      ) {
        await setPendingAction(fromPhoneNumber, commandResult.pendingAction);
      } else {
        await clearPendingAction(fromPhoneNumber);
      }

      if (
        commandResult.success &&
        commandResult.kind === "ready_message" &&
        commandResult.updatedItem
      ) {
        await rememberTransactionTarget(
          fromPhoneNumber,
          commandResult.updatedItem,
        );
      }

      const reply = formatBFinanceResponse(commandResult);
      await sendWhatsAppMessage(fromPhoneNumber, reply);
      await updateSessionHistory(fromPhoneNumber, "assistant", reply);
      return true;
    }

    const result = await handleUpdateTransactionPendingAction(
      userId,
      pendingAction,
      messageText,
    );

    if (result.pendingAction) {
      await setPendingAction(fromPhoneNumber, result.pendingAction);
    } else {
      await clearPendingAction(fromPhoneNumber);
    }

    const rememberedTarget =
      result.updatedTarget ?? result.pendingAction?.target;
    if (rememberedTarget) {
      await rememberTransactionTarget(
        fromPhoneNumber,
        rememberedTarget,
      );
    }

    await sendWhatsAppMessage(fromPhoneNumber, result.message);
    await updateSessionHistory(fromPhoneNumber, "assistant", result.message);
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
        "Olá! Não encontramos nenhuma conta associada a este número no B-Finances. Cadastre seu telefone no aplicativo para usar o bot do WhatsApp.",
      );
      return NextResponse.json({
        status: "error",
        error: "Unregistered phone number",
      });
    }

    const rateLimit = await checkRateLimit(fromPhoneNumber);
    if (!rateLimit.allowed) {
      await sendWhatsAppMessage(
        fromPhoneNumber,
        `Você atingiu o limite de ${rateLimit.limit} mensagens por hora. Tente novamente após ${formatResetTime(rateLimit.resetAt)}.`,
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
    const currentDate = getBrasiliaDate();
    const previousCommand = getPreviousBFinanceCommand(shortTermMemory);
    const interpretedCommand = await interpretBFinanceCommand({
      messageText,
      conversationHistory,
      shortTermMemory,
      currentDate,
    });
    const normalizerContext = { previousCommand };

    let command = normalizeCommandUpdate(messageText, interpretedCommand);
    const targetMessageText =
      command.action === "update"
        ? command.update?.targetText ?? ""
        : messageText;

    command = normalizeCommandResource(targetMessageText, command);

    command = normalizeCommandPeriod(
      targetMessageText,
      command,
      currentDate,
      normalizerContext,
    );
    command = normalizeCommandScope(
      targetMessageText,
      command,
      currentDate,
      normalizerContext,
    );
    command = normalizeCommandFilters(
      targetMessageText,
      command,
      currentDate,
      normalizerContext,
    );
    command = normalizeCommandCategory(messageText, command);
    command = normalizeCommandInstallments(messageText, command);

    console.log("B-Finances command:", JSON.stringify(command));

    const recentTransaction = await getLastTransactionReference(
      fromPhoneNumber,
    );
    const commandResult = await executeBFinanceCommand({
      userId,
      command,
      messageText,
      conversationHistory,
      phoneNumber: fromPhoneNumber,
      recentTransaction,
    });

    if (
      commandResult.success &&
      commandResult.kind === "ready_message" &&
      commandResult.pendingAction
    ) {
      await setPendingAction(fromPhoneNumber, commandResult.pendingAction);
    } else if (
      commandResult.success &&
      commandResult.kind === "transaction_list" &&
      commandResult.items.length > 0
    ) {
      await setPendingAction(
        fromPhoneNumber,
        createQuerySelectionAction(commandResult.items),
      );
    }

    if (
      commandResult.success &&
      commandResult.kind === "transaction_created"
    ) {
      await rememberTransactionTarget(fromPhoneNumber, commandResult.item);
    }

    if (
      commandResult.success &&
      commandResult.kind === "ready_message" &&
      commandResult.updatedItem
    ) {
      await rememberTransactionTarget(
        fromPhoneNumber,
        commandResult.updatedItem,
      );
    } else if (
      commandResult.success &&
      commandResult.kind === "ready_message" &&
      isPendingUpdateTransactionAction(commandResult.pendingAction) &&
      commandResult.pendingAction.target
    ) {
      await rememberTransactionTarget(
        fromPhoneNumber,
        commandResult.pendingAction.target,
      );
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
