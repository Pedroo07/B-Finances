import {
  GoogleGenerativeAI,
  type GenerateContentRequest,
  type Part,
} from "@google/generative-ai";
import type { ShortTermMemorySnapshot } from "../utils/shortTermMemory";
import type {
  BFinanceAction,
  BFinanceCommand,
  BFinanceOperation,
  BFinancePaymentMethod,
  BFinancePeriodType,
  BFinanceResource,
  BFinanceTransactionType,
} from "./types";

type PromptPayload = string | GenerateContentRequest | Array<string | Part>;

type InterpreterInput = {
  messageText: string;
  conversationHistory: string;
  shortTermMemory?: ShortTermMemorySnapshot | null;
  currentDate?: Date;
};

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const agentModels = [
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-3.5-flash",
  "gemini-3-flash",
];

const ACTIONS = new Set<BFinanceAction>([
  "query",
  "create",
  "update",
  "delete",
  "pay",
  "help",
  "clarify",
]);

const RESOURCES = new Set<BFinanceResource>([
  "transaction",
  "card_transaction",
  "invoice",
  "bill",
  "investment",
  "summary",
  "settings",
]);

const OPERATIONS = new Set<BFinanceOperation>([
  "list",
  "total",
  "summary",
  "ranking",
  "detail",
  "mark_as_paid",
]);

const TRANSACTION_TYPES = new Set<BFinanceTransactionType>([
  "expense",
  "income",
  "all",
]);

const PERIOD_TYPES = new Set<BFinancePeriodType>([
  "all",
  "today",
  "yesterday",
  "current_week",
  "last_week",
  "current_month",
  "last_month",
  "current_year",
  "last_year",
  "specific_month",
  "specific_year",
  "last_n_days",
]);

const PAYMENT_METHODS = new Set<BFinancePaymentMethod>([
  "cash",
  "pix",
  "debit",
  "credit_card",
]);

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

function formatDateForPrompt(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function cleanJsonResponse(responseText: string): string {
  const cleaned = responseText
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function buildMemoryPrompt(
  shortTermMemory?: ShortTermMemorySnapshot | null,
): string {
  if (!shortTermMemory || shortTermMemory.turns.length === 0) {
    return "Nenhuma memoria curta ativa.";
  }

  return shortTermMemory.turns
    .map((turn, index) => {
      return [
        `${index + 1}. Usuario: ${truncate(turn.userMessage, 220)}`,
        `   Ferramenta: ${turn.toolName}`,
        `   Parametros: ${JSON.stringify(turn.parameters)}`,
        `   Resposta: ${truncate(turn.assistantReply, 220)}`,
      ].join("\n");
    })
    .join("\n\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function enumOrDefault<T extends string>(
  value: unknown,
  allowed: Set<T>,
  fallback: T,
): T {
  return typeof value === "string" && allowed.has(value as T)
    ? (value as T)
    : fallback;
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return asString(value);
}

function nullableNumber(value: unknown): number | null | undefined {
  if (value === null) return null;
  return asNumber(value);
}

function normalizeParsedCommand(parsed: unknown): BFinanceCommand {
  if (!isRecord(parsed)) {
    return buildClarificationCommand(
      "Nao consegui entender com seguranca. Voce pode reformular o pedido?",
    );
  }

  const action = enumOrDefault(parsed.action, ACTIONS, "clarify");
  const resource = enumOrDefault(parsed.resource, RESOURCES, "transaction");
  const rawPeriod = isRecord(parsed.period) ? parsed.period : undefined;
  const rawScope = isRecord(parsed.scope) ? parsed.scope : undefined;
  const rawFilters = isRecord(parsed.filters) ? parsed.filters : undefined;
  const rawData = isRecord(parsed.data) ? parsed.data : undefined;
  const rawClarification = isRecord(parsed.clarification)
    ? parsed.clarification
    : undefined;

  const operation =
    typeof parsed.operation === "string" &&
    OPERATIONS.has(parsed.operation as BFinanceOperation)
      ? (parsed.operation as BFinanceOperation)
      : undefined;

  const transactionType =
    typeof parsed.transactionType === "string" &&
    TRANSACTION_TYPES.has(parsed.transactionType as BFinanceTransactionType)
      ? (parsed.transactionType as BFinanceTransactionType)
      : undefined;

  const command: BFinanceCommand = {
    action,
    resource,
    confidence:
      typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(parsed.confidence, 1))
        : 0.75,
  };

  if (operation) command.operation = operation;
  if (transactionType) command.transactionType = transactionType;

  if (rawPeriod) {
    command.period = {
      raw: nullableString(rawPeriod.raw) ?? null,
      type: enumOrDefault(rawPeriod.type, PERIOD_TYPES, "all"),
      startDate: nullableString(rawPeriod.startDate) ?? null,
      endDate: nullableString(rawPeriod.endDate) ?? null,
      month: nullableNumber(rawPeriod.month) ?? null,
      year: nullableNumber(rawPeriod.year) ?? null,
      days: nullableNumber(rawPeriod.days) ?? null,
      isExplicit: Boolean(asBoolean(rawPeriod.isExplicit)),
    };
  }

  if (rawScope) {
    command.scope = {
      includeNormalTransactions:
        asBoolean(rawScope.includeNormalTransactions) ?? true,
      includeCardTransactions:
        asBoolean(rawScope.includeCardTransactions) ?? false,
      cardName: nullableString(rawScope.cardName) ?? null,
      excludeCardTransactions:
        asBoolean(rawScope.excludeCardTransactions) ?? false,
      paymentMethod:
        typeof rawScope.paymentMethod === "string" &&
        PAYMENT_METHODS.has(rawScope.paymentMethod as BFinancePaymentMethod)
          ? (rawScope.paymentMethod as BFinancePaymentMethod)
          : null,
      excludePaymentMethod:
        typeof rawScope.excludePaymentMethod === "string" &&
        PAYMENT_METHODS.has(rawScope.excludePaymentMethod as BFinancePaymentMethod)
          ? (rawScope.excludePaymentMethod as BFinancePaymentMethod)
          : null,
    };
  }

  if (rawFilters) {
    command.filters = {
      category: nullableString(rawFilters.category) ?? null,
      description: nullableString(rawFilters.description) ?? null,
      minAmount: nullableNumber(rawFilters.minAmount) ?? null,
      maxAmount: nullableNumber(rawFilters.maxAmount) ?? null,
      amount: nullableNumber(rawFilters.amount) ?? null,
      limit: nullableNumber(rawFilters.limit) ?? null,
      orderBy:
        rawFilters.orderBy === "date_asc" ||
        rawFilters.orderBy === "amount_desc" ||
        rawFilters.orderBy === "amount_asc"
          ? rawFilters.orderBy
          : "date_desc",
    };
  }

  if (rawData) {
    command.data = {
      description: nullableString(rawData.description) ?? null,
      amount: nullableNumber(rawData.amount) ?? null,
      category: nullableString(rawData.category) ?? null,
      date: nullableString(rawData.date) ?? null,
      cardName:
        nullableString(rawData.cardName) ??
        nullableString(rawData.card) ??
        null,
      paymentMethod: nullableString(rawData.paymentMethod) ?? null,
    };
  }

  if (rawClarification) {
    command.clarification = {
      question:
        asString(rawClarification.question) ||
        "Pode me dizer um pouco melhor o que voce quer fazer?",
      missingFields: Array.isArray(rawClarification.missingFields)
        ? rawClarification.missingFields.filter(
            (field): field is string => typeof field === "string",
          )
        : [],
    };
  }

  return command;
}

function buildClarificationCommand(question: string): BFinanceCommand {
  return {
    action: "clarify",
    resource: "transaction",
    clarification: {
      question,
      missingFields: [],
    },
    confidence: 0,
  };
}

function buildSystemInstruction(input: Required<InterpreterInput>): string {
  const today = formatDateForPrompt(input.currentDate);

  return `Voce e o Command Interpreter do bot WhatsApp do B-Finances.
Sua unica tarefa e converter a mensagem do usuario em UM JSON valido no contrato BFinanceCommand.

DATA DE HOJE: ${today}

HISTORICO RECENTE:
${input.conversationHistory}

MEMORIA CURTA:
${buildMemoryPrompt(input.shortTermMemory)}

CONTRATO DE SAIDA:
{
  "action": "query" | "create" | "update" | "delete" | "pay" | "help" | "clarify",
  "resource": "transaction" | "card_transaction" | "invoice" | "bill" | "investment" | "summary" | "settings",
  "operation": "list" | "total" | "summary" | "ranking" | "detail" | "mark_as_paid",
  "transactionType": "expense" | "income" | "all",
  "period": {
    "raw": string | null,
    "type": "all" | "today" | "yesterday" | "current_week" | "last_week" | "current_month" | "last_month" | "current_year" | "last_year" | "specific_month" | "specific_year" | "last_n_days",
    "startDate": string | null,
    "endDate": string | null,
    "month": number | null,
    "year": number | null,
    "days": number | null,
    "isExplicit": boolean
  },
  "scope": {
    "includeNormalTransactions": boolean,
    "includeCardTransactions": boolean,
    "cardName": string | null,
    "excludeCardTransactions": boolean,
    "paymentMethod": "cash" | "pix" | "debit" | "credit_card" | null,
    "excludePaymentMethod": "credit_card" | "pix" | "debit" | "cash" | null
  },
  "filters": {
    "category": string | null,
    "description": string | null,
    "minAmount": number | null,
    "maxAmount": number | null,
    "amount": number | null,
    "limit": number | null,
    "orderBy": "date_desc" | "date_asc" | "amount_desc" | "amount_asc"
  },
  "data": {
    "description": string | null,
    "amount": number | null,
    "category": string | null,
    "date": string | null,
    "cardName": string | null,
    "paymentMethod": string | null
  },
  "clarification": {
    "question": string,
    "missingFields": string[]
  },
  "confidence": number
}

REGRAS:
- Responda APENAS com JSON. Nao use markdown. Nao responda ao usuario.
- Nao execute regras finais de data, calculo ou escopo. Apenas interprete a intencao.
- Nao invente dados financeiros.
- Para "quanto gastei", "qnt foi de gasto", "quanto entrou": action query, resource transaction, operation total.
- Para "liste", "ultimas", "mostre": action query, operation list.
- Para "resumo financeiro", "como foi meu mes", "balanco", "minhas financas": action query, resource summary, operation summary.
- Para "estou gastando muito?", "analise minhas financas", "consultoria financeira" ou "onde posso economizar?": action query, resource summary, operation summary ou detail. Nao responda como consultor.
- Para "com qual categoria gastei mais?", "qual categoria cresceu mais?", "maiores categorias": action query, resource transaction, operation ranking.
- Para "fatura do Nubank": action query, resource invoice, operation detail, scope de cartao.
- Para "contas a pagar": action query, resource bill, operation list.
- Para "investimentos": action query, resource investment, operation summary.
- Para "gastei 50 conto no lanche": action create, resource transaction, transactionType expense, data preenchido.
- Para "recebi 300 do freela": action create, resource transaction, transactionType income, data preenchido.
- Para cartao de credito, use resource card_transaction apenas quando for uma compra/transacao de cartao; use resource invoice para fatura.
- Para "sem cartao", "ignore cartao", "tirando credito", marque escopo negativo. A normalizacao deterministica fara a correcao final.
- Para "agora so os acima de 500" ou "ordene do maior para o menor", use a memoria para manter a consulta anterior e alterar somente o filtro.
- Se faltar informacao essencial para criar, pagar, atualizar ou apagar, use action clarify com pergunta curta.

EXEMPLOS:
"quanto gastei esse mes?" => query transaction total expense current_month
"qnt foi de gasto mes passado?" => query transaction total expense last_month
"meus gastos de junho" => query transaction list expense specific_month
"quanto entrou mes passado?" => query transaction total income last_month
"liste meus lucros" => query transaction list income
"ultimas 10 transacoes" => query transaction list all, limit 10
"ultimos 5 gastos" => query transaction list expense, limit 5
"gastos no inter" => query transaction list expense, cardName Inter
"compras do nubank" => query transaction list expense, cardName Nubank
"despesas sem cartao" => query transaction list expense, exclude card
"so pix" => query transaction list all, paymentMethod pix
"gastos com comida" => query transaction list expense, category foods
"apaga o uber de ontem" => delete transaction, description uber, yesterday
"edita o mercado" => update transaction, description mercado
"paguei a conta de luz" => pay bill, description luz
"minhas contas pendentes" => query bill list
"como foi meu mes?" => query summary summary current_month`;
}

export async function interpretBFinanceCommand({
  messageText,
  conversationHistory,
  shortTermMemory = null,
  currentDate = new Date(),
}: InterpreterInput): Promise<BFinanceCommand> {
  const input = {
    messageText,
    conversationHistory,
    shortTermMemory,
    currentDate,
  };

  try {
    const responseText = await generateContentWithFallback(
      messageText,
      buildSystemInstruction(input),
    );
    return normalizeParsedCommand(JSON.parse(cleanJsonResponse(responseText)));
  } catch (error) {
    console.error("Erro ao interpretar comando B-Finances:", error);
    return buildClarificationCommand(
      "Nao consegui entender com seguranca. Voce pode reformular o pedido?",
    );
  }
}
