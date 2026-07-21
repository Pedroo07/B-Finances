import {
  GoogleGenerativeAI,
  type GenerateContentRequest,
  type Part,
} from "@google/generative-ai";
import { CREDIT_CARD_NAMES_TEXT } from "@/lib/creditCards/catalog";
import type { ShortTermMemorySnapshot } from "../utils/shortTermMemory";
import { getBrasiliaDate } from "../utils/brasiliaDate";
import { parseMoney } from "../utils/moneyParser";
import type {
  BFinanceAction,
  BFinanceCommand,
  BFinanceOperation,
  BFinancePaymentMethod,
  BFinancePeriodType,
  BFinanceResource,
  BFinanceTransactionType,
  BFinanceUpdateField,
  BFinanceUpdateReference,
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
  "next_week",
  "current_month",
  "last_month",
  "current_year",
  "last_year",
  "specific_month",
  "specific_year",
  "last_n_days",
  "date_range",
  "current_invoice",
]);

const PAYMENT_METHODS = new Set<BFinancePaymentMethod>([
  "cash",
  "pix",
  "debit",
  "credit_card",
]);

const UPDATE_FIELDS = new Set<BFinanceUpdateField>([
  "description",
  "amount",
  "date",
  "category",
  "paymentMethod",
]);

const UPDATE_REFERENCES = new Set<BFinanceUpdateReference>([
  "recent",
  "latest",
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
    return parseMoney(value) ?? undefined;
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
      "Não consegui entender com segurança. Você pode reformular o pedido?",
    );
  }

  const action = enumOrDefault(parsed.action, ACTIONS, "clarify");
  const resource = enumOrDefault(parsed.resource, RESOURCES, "transaction");
  const rawPeriod = isRecord(parsed.period) ? parsed.period : undefined;
  const rawScope = isRecord(parsed.scope) ? parsed.scope : undefined;
  const rawFilters = isRecord(parsed.filters) ? parsed.filters : undefined;
  const rawData = isRecord(parsed.data) ? parsed.data : undefined;
  const rawUpdate = isRecord(parsed.update) ? parsed.update : undefined;
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
      installmentCount: nullableNumber(rawData.installmentCount) ?? null,
    };
  }

  if (rawUpdate) {
    const rawValue = rawUpdate.value;
    command.update = {
      field:
        typeof rawUpdate.field === "string" &&
        UPDATE_FIELDS.has(rawUpdate.field as BFinanceUpdateField)
          ? (rawUpdate.field as BFinanceUpdateField)
          : null,
      value:
        typeof rawValue === "number" && Number.isFinite(rawValue)
          ? rawValue
          : nullableString(rawValue) ?? null,
      reference:
        typeof rawUpdate.reference === "string" &&
        UPDATE_REFERENCES.has(rawUpdate.reference as BFinanceUpdateReference)
          ? (rawUpdate.reference as BFinanceUpdateReference)
          : null,
      targetText: nullableString(rawUpdate.targetText) ?? null,
    };
  }

  if (rawClarification) {
    command.clarification = {
      question:
        asString(rawClarification.question) ||
        "Pode explicar um pouco melhor o que você quer fazer?",
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
    "type": "all" | "today" | "yesterday" | "current_week" | "last_week" | "next_week" | "current_month" | "last_month" | "current_year" | "last_year" | "specific_month" | "specific_year" | "last_n_days" | "date_range" | "current_invoice",
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
    "paymentMethod": string | null,
    "installmentCount": number | null
  },
  "update": {
    "field": "description" | "amount" | "date" | "category" | "paymentMethod" | null,
    "value": string | number | null,
    "reference": "recent" | "latest" | null,
    "targetText": string | null
  },
  "clarification": {
    "question": string,
    "missingFields": string[]
  },
  "confidence": number
}

REGRAS:
- Responda APENAS com JSON. Nao use markdown. Nao responda ao usuario.
- Ao preencher clarification.question, escreva em português do Brasil com acentuação correta.
- Nao execute regras finais de data, calculo ou escopo. Apenas interprete a intencao.
- Nao invente dados financeiros.
- Em toda criacao de transacao, preencha data.category com UMA categoria canonica.
- Categorias de despesa: fixes (contas fixas, luz, agua, internet e telefone), foods (mercado, restaurante, padaria, alimentos e lanches), housing (aluguel, condominio e moradia), transport (Uber, taxi, combustivel, estacionamento e transporte publico), delivery (iFood, Rappi e entrega de comida), shopping (roupas, calcados, eletronicos, farmacia e compras), subscriptions (assinaturas, mensalidades e streaming), entertainment (cinema, festas, viagens, shows e lazer) ou other.
- Categorias de receita: salary (salario e pagamento do trabalho principal), extra (freela, bonus, comissao, venda e renda extra) ou other.
- Use other somente quando a descricao nao der nenhuma pista util. O estabelecimento, produto ou servico citado deve ser usado para inferir a categoria.
- Se o usuario indicar explicitamente uma categoria, respeite a escolha dele.
- Exemplos de categoria: mercado/padaria/restaurante => foods; conta de luz/internet => fixes; tenis/roupa/Amazon => shopping; Uber/gasolina => transport; iFood => delivery; Netflix/academia => subscriptions; aluguel/condominio => housing; cinema/show => entertainment.
- Cartoes aceitos para scope.cardName/data.cardName: ${CREDIT_CARD_NAMES_TEXT}. Use esses nomes canonicos.
- Para "quanto gastei", "qnt foi de gasto", "quanto entrou": action query, resource transaction, operation total.
- Para "liste", "ultimas", "mostre": action query, operation list.
- Para "resumo financeiro", "como foi meu mes", "balanco", "minhas financas": action query, resource summary, operation summary.
- Para "estou gastando muito?", "analise minhas financas", "consultoria financeira" ou "onde posso economizar?": action query, resource summary, operation summary ou detail. Nao responda como consultor.
- Para "com qual categoria gastei mais?", "qual categoria cresceu mais?", "maiores categorias": action query, resource transaction, operation ranking.
- Para "fatura do Nubank" ou "quanto esta a fatura": action query, resource invoice, operation detail, scope de cartao.
- Para "quais minhas faturas em aberto" ou "todas as faturas pendentes": action query, resource invoice, operation list, sem misturar contas comuns.
- Para "liste os gastos da fatura", "quais gastos do cartao" ou "compras do cartao": action query, resource card_transaction, operation list, transactionType expense.
- Para "gastos do cartao" sem periodo, use period all/isExplicit false; a normalizacao/executor aplicara fatura atual.
- Para "todo historico do cartao", use period all/isExplicit true.
- Para "proxima semana", "ultima semana", "ultimos 10 dias" ou "de 01/06 ate 15/06", preencha o periodo quando souber; a normalizacao deterministica corrigira datas finais.
- Para "contas a pagar": action query, resource bill, operation list.
- Para "investimentos": action query, resource investment, operation summary.
- Para "gastei 50 conto no lanche": action create, resource transaction, transactionType expense, data preenchido.
- Para "comprei um tenis de 1500 parcelado em 10x": action create, resource card_transaction, transactionType expense, data.amount 1500 e data.installmentCount 10. O valor informado e o total da compra.
- Expressoes como "parcelado", "dividido", "em 5 vezes" ou "5x" indicam compra parcelada no cartao. Sem essas expressoes, installmentCount deve ser 1.
- Para "recebi 300 do freela": action create, resource transaction, transactionType income, data preenchido.
- Para atualizacoes, use filters/period/scope SOMENTE para identificar a transacao existente e update SOMENTE para o campo e o novo valor. Nunca coloque o novo valor em filters.
- Em "altere o valor para 4,75", use update.field amount, update.value 4.75 e update.reference recent.
- Em "altere o valor da ultima despesa para 4,75", use update.field amount, update.value 4.75, update.reference latest e transactionType expense.
- Em "altere o valor da padaria para 4,75", use filters.description padaria, update.field amount e update.value 4.75.
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
"quais minhas faturas em aberto" => query invoice list all
"fatura do cartao nubank" => query invoice detail all, cardName Nubank
"liste os gastos da fatura do nubank" => query card_transaction list expense, cardName Nubank, current_invoice
"despesas sem cartao" => query transaction list expense, exclude card
"so pix" => query transaction list all, paymentMethod pix
"gastos com comida" => query transaction list expense, category foods
"apaga o uber de ontem" => delete transaction, description uber, yesterday
"edita o mercado" => update transaction, description mercado
"altere o valor para 4,75" => update transaction, update amount 4.75, reference recent
"altere o valor da ultima despesa para 4,75" => update transaction expense, update amount 4.75, reference latest
"paguei a conta de luz" => pay bill, description luz
"minhas contas pendentes" => query bill list
"como foi meu mes?" => query summary summary current_month`;
}

export async function interpretBFinanceCommand({
  messageText,
  conversationHistory,
  shortTermMemory = null,
  currentDate = getBrasiliaDate(),
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
      "Não consegui entender com segurança. Você pode reformular o pedido?",
    );
  }
}
