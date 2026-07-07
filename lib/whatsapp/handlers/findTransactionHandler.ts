import {
  getTransactions,
  type Transaction,
} from "@/lib/services/admin/transactionsAdmin";
import {
  getCardTransactions,
  type CardTransaction,
} from "@/lib/services/admin/cardTransactionsAdmin";
import {
  findCreditCardNameInText,
  getCreditCardBankKey,
} from "@/lib/creditCards/catalog";
import { formatCurrency } from "../formatters/responseFormatter";
import { formatDate } from "../utils/dateParser";

const MAX_RESULTS_TO_SHOW = 20;

type TransactionSource = "transaction" | "card";

export type FindableTransaction = {
  id: string;
  source: TransactionSource;
  description: string;
  date: string;
  amount: number;
  category?: string;
  type?: string;
  paymentMethod?: string;
  card?: string;
};

export type FindTransactionToolResult = {
  message: string;
  needsSelection: boolean;
  pendingAction?: {
    type: "find_transaction_multiple";
    transactions: FindableTransaction[];
  };
};

type DateFilter = {
  startDate: string;
  endDate: string;
};

type FindCriteria = {
  rawQuery: string;
  normalizedQuery: string;
  tokens: string[];
  amount?: number;
  card?: string;
  cardMentioned: boolean;
  dateFilter?: DateFilter;
};

type SelectionResolution = {
  message: string;
  shouldClear: boolean;
};

const STOP_WORDS = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "com",
  "compra",
  "compras",
  "da",
  "das",
  "de",
  "despesa",
  "despesas",
  "do",
  "dos",
  "em",
  "encontra",
  "encontrar",
  "encontre",
  "gasto",
  "gastos",
  "localiza",
  "localizar",
  "localize",
  "me",
  "meu",
  "minha",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "por",
  "procura",
  "procurar",
  "procure",
  "reais",
  "real",
  "r",
  "rs",
  "transacao",
  "transacoes",
  "um",
  "uma",
]);

const DATE_WORDS = new Set([
  "anteontem",
  "domingo",
  "feira",
  "hoje",
  "mes",
  "ontem",
  "passada",
  "passado",
  "quarta",
  "quinta",
  "sabado",
  "segunda",
  "semana",
  "sexta",
  "terca",
]);

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDateForStorage(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function exactDateFilter(date: Date): DateFilter {
  const dateStr = formatDateForStorage(date);
  return { startDate: dateStr, endDate: dateStr };
}

function getCurrentWeekStart(today: Date): Date {
  const day = today.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  return addDays(today, diffToMonday);
}

function parseExplicitDate(normalizedQuery: string, today: Date): DateFilter | undefined {
  const match = normalizedQuery.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (!match) return undefined;

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = match[3]
    ? Number(match[3].length === 2 ? `20${match[3]}` : match[3])
    : today.getFullYear();

  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return undefined;
  }

  return exactDateFilter(date);
}

function parseDateFilter(normalizedQuery: string, today = new Date()): DateFilter | undefined {
  const explicitDate = parseExplicitDate(normalizedQuery, today);
  if (explicitDate) return explicitDate;

  if (normalizedQuery.includes("anteontem")) {
    return exactDateFilter(addDays(today, -2));
  }

  if (normalizedQuery.includes("ontem")) {
    return exactDateFilter(addDays(today, -1));
  }

  if (normalizedQuery.includes("hoje")) {
    return exactDateFilter(today);
  }

  const currentWeekStart = getCurrentWeekStart(today);

  if (normalizedQuery.includes("semana passada")) {
    return {
      startDate: formatDateForStorage(addDays(currentWeekStart, -7)),
      endDate: formatDateForStorage(addDays(currentWeekStart, -1)),
    };
  }

  if (
    normalizedQuery.includes("esta semana") ||
    normalizedQuery.includes("essa semana")
  ) {
    return {
      startDate: formatDateForStorage(currentWeekStart),
      endDate: formatDateForStorage(addDays(currentWeekStart, 6)),
    };
  }

  if (normalizedQuery.includes("mes passado")) {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return {
      startDate: formatDateForStorage(start),
      endDate: formatDateForStorage(end),
    };
  }

  if (
    normalizedQuery.includes("este mes") ||
    normalizedQuery.includes("esse mes")
  ) {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return {
      startDate: formatDateForStorage(start),
      endDate: formatDateForStorage(end),
    };
  }

  const weekdays: Array<{ name: string; day: number }> = [
    { name: "domingo", day: 0 },
    { name: "segunda", day: 1 },
    { name: "terca", day: 2 },
    { name: "quarta", day: 3 },
    { name: "quinta", day: 4 },
    { name: "sexta", day: 5 },
    { name: "sabado", day: 6 },
  ];

  const weekday = weekdays.find(({ name }) =>
    new RegExp(`\\b${name}(?:\\s+feira)?\\b`).test(normalizedQuery),
  );

  if (weekday) {
    let daysBack = today.getDay() - weekday.day;
    if (daysBack < 0) daysBack += 7;
    if (normalizedQuery.includes("passad")) daysBack += 7;
    return exactDateFilter(addDays(today, -daysBack));
  }

  return undefined;
}

function parseAmount(rawQuery: string, normalizedQuery: string): number | undefined {
  const hasMoneySignal =
    /\br\$/.test(rawQuery.toLowerCase()) ||
    /\brs\b/.test(normalizedQuery) ||
    /\breais?\b/.test(normalizedQuery);

  const onlyNumber = /^\s*\d+(?:[.,]\d{1,2})?\s*$/.test(rawQuery);
  if (!hasMoneySignal && !onlyNumber) return undefined;

  const match = rawQuery.match(
    /(?:r\$\s*|rs\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/i,
  );
  if (!match) return undefined;

  const normalizedAmount = match[1].includes(",")
    ? match[1].replace(/\./g, "").replace(",", ".")
    : match[1];
  const amount = Number(normalizedAmount);

  return Number.isFinite(amount) ? amount : undefined;
}

function parseCard(normalizedQuery: string): string | undefined {
  return findCreditCardNameInText(normalizedQuery) ?? undefined;
}

function hasCardMention(normalizedQuery: string): boolean {
  return (
    /\bcartao\b/.test(normalizedQuery) ||
    /\bcredito\b/.test(normalizedQuery) ||
    parseCard(normalizedQuery) !== undefined
  );
}

function tokenizeQuery(
  normalizedQuery: string,
  card: string | undefined,
): string[] {
  const cardWords = card ? normalizeText(card).split(/\s+/) : [];
  const compactCard = card ? normalizeText(card).replace(/[^a-z0-9]/g, "") : "";

  return normalizedQuery
    .replace(/\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 1)
    .filter((token) => !STOP_WORDS.has(token))
    .filter((token) => !DATE_WORDS.has(token))
    .filter((token) => token !== "cartao" && token !== "credito")
    .filter((token) => !cardWords.includes(token))
    .filter((token) => !compactCard || !compactCard.includes(token));
}

function buildCriteria(query: string): FindCriteria {
  const rawQuery = query.trim();
  const normalizedQuery = normalizeText(rawQuery);
  const card = parseCard(normalizedQuery);

  return {
    rawQuery,
    normalizedQuery,
    tokens: tokenizeQuery(normalizedQuery, card),
    amount: parseAmount(rawQuery, normalizedQuery),
    card,
    cardMentioned: hasCardMention(normalizedQuery),
    dateFilter: parseDateFilter(normalizedQuery),
  };
}

function toFindableTransaction(transaction: Transaction): FindableTransaction {
  return {
    id: transaction.id,
    source: "transaction",
    description: transaction.description,
    date: transaction.date,
    amount: transaction.amount,
    category: transaction.category,
    type: transaction.type,
    paymentMethod: transaction.paymentMethod,
  };
}

function toFindableCardTransaction(
  transaction: CardTransaction,
): FindableTransaction {
  return {
    id: transaction.id,
    source: "card",
    description: transaction.description,
    date: transaction.date,
    amount: -Math.abs(transaction.amount),
    category: transaction.category,
    card: transaction.card,
    type: "expense",
    paymentMethod: "credit_card",
  };
}

function amountMatches(itemAmount: number, searchedAmount: number): boolean {
  return Math.abs(Math.abs(itemAmount) - searchedAmount) < 0.01;
}

function dateMatches(date: string, dateFilter: DateFilter): boolean {
  return date >= dateFilter.startDate && date <= dateFilter.endDate;
}

function textMatches(item: FindableTransaction, criteria: FindCriteria): boolean {
  if (criteria.tokens.length === 0) return true;

  const searchableParts = [
    item.description,
    item.category,
    item.type,
    item.paymentMethod,
  ];

  if (criteria.cardMentioned || criteria.card) {
    searchableParts.push(item.card);
  }

  const searchableText = normalizeText(searchableParts.filter(Boolean).join(" "));
  return criteria.tokens.every((token) => searchableText.includes(token));
}

function cardMatches(item: FindableTransaction, criteria: FindCriteria): boolean {
  if (criteria.card) {
    const itemBankKey = getCreditCardBankKey(item.card ?? "");
    const criteriaBankKey = getCreditCardBankKey(criteria.card);

    if (itemBankKey && criteriaBankKey) {
      return item.source === "card" && itemBankKey === criteriaBankKey;
    }

    return item.source === "card" && item.card === criteria.card;
  }

  if (criteria.cardMentioned) {
    return item.source === "card";
  }

  return true;
}

function matchesCriteria(
  item: FindableTransaction,
  criteria: FindCriteria,
): boolean {
  if (criteria.dateFilter && !dateMatches(item.date, criteria.dateFilter)) {
    return false;
  }

  if (criteria.amount !== undefined && !amountMatches(item.amount, criteria.amount)) {
    return false;
  }

  if (!cardMatches(item, criteria)) {
    return false;
  }

  return textMatches(item, criteria);
}

function sortTransactions(
  transactions: FindableTransaction[],
): FindableTransaction[] {
  return [...transactions].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return Math.abs(b.amount) - Math.abs(a.amount);
  });
}

function getSourceLabel(item: FindableTransaction): string {
  if (item.source === "card") {
    return `Cartao ${item.card || ""}`.trim();
  }

  if (item.type === "income") return "Receita";
  if (item.paymentMethod === "pix") return "Pix";
  if (item.paymentMethod === "cash") return "Dinheiro";
  if (item.paymentMethod === "debit") return "Debito";
  return "Transacao";
}

function formatFoundTransaction(
  item: FindableTransaction,
  index?: number,
): string {
  const prefix = index === undefined ? "" : `${index}. `;
  const lines = [
    `${prefix}*${item.description}*`,
    `   ${formatCurrency(item.amount)} | ${formatDate(item.date)} | ${getSourceLabel(item)}`,
  ];

  if (item.category) {
    lines.push(`   Categoria: ${item.category}`);
  }

  return lines.join("\n");
}

function formatSingleResult(item: FindableTransaction): string {
  return `Encontrei esta transacao:\n\n${formatFoundTransaction(item)}`;
}

function formatMultipleResults(
  query: string,
  transactions: FindableTransaction[],
): string {
  const visibleTransactions = transactions.slice(0, MAX_RESULTS_TO_SHOW);
  const hiddenCount = transactions.length - visibleTransactions.length;

  let response = `Encontrei ${transactions.length} transacoes para "${query}":\n\n`;
  response += visibleTransactions
    .map((transaction, index) => formatFoundTransaction(transaction, index + 1))
    .join("\n\n");

  if (hiddenCount > 0) {
    response += `\n\nMostrei as ${MAX_RESULTS_TO_SHOW} mais recentes. Se nao estiver aqui, refine a busca.`;
  }

  response += "\n\nQual delas voce quer? Responda com o numero.";

  return response;
}

export async function handleFindTransaction(
  userId: string,
  query: string,
): Promise<FindTransactionToolResult> {
  const criteria = buildCriteria(query);

  if (
    criteria.tokens.length === 0 &&
    criteria.amount === undefined &&
    !criteria.cardMentioned &&
    !criteria.dateFilter
  ) {
    return {
      message:
        "Me diga uma pista da transacao, como descricao, data, valor ou cartao.",
      needsSelection: false,
    };
  }

  const [transactions, cardTransactions] = await Promise.all([
    getTransactions(userId),
    getCardTransactions(userId),
  ]);

  const matches = sortTransactions([
    ...transactions.map(toFindableTransaction),
    ...cardTransactions.map(toFindableCardTransaction),
  ].filter((transaction) => matchesCriteria(transaction, criteria)));

  if (matches.length === 0) {
    return {
      message: `Nao encontrei transacoes para "${criteria.rawQuery}".`,
      needsSelection: false,
    };
  }

  if (matches.length === 1) {
    return {
      message: formatSingleResult(matches[0]),
      needsSelection: false,
    };
  }

  const visibleTransactions = matches.slice(0, MAX_RESULTS_TO_SHOW);

  return {
    message: formatMultipleResults(criteria.rawQuery, matches),
    needsSelection: true,
    pendingAction: {
      type: "find_transaction_multiple",
      transactions: visibleTransactions,
    },
  };
}

export function resolveFindTransactionSelection(
  pendingAction: unknown,
  messageText: string,
): SelectionResolution {
  const action = pendingAction as {
    type?: string;
    transactions?: FindableTransaction[];
  };

  if (
    action.type !== "find_transaction_multiple" ||
    !Array.isArray(action.transactions)
  ) {
    return {
      message: "Nao encontrei uma busca pendente para essa escolha.",
      shouldClear: true,
    };
  }

  const match = messageText.trim().match(/^#?\s*(\d+)\s*$/);
  if (!match) {
    return {
      message:
        "Responda com o numero da transacao da lista, ou envie cancelar.",
      shouldClear: false,
    };
  }

  const selectedIndex = Number(match[1]) - 1;
  const selected = action.transactions[selectedIndex];

  if (!selected) {
    return {
      message:
        "Numero invalido. Escolha um numero da lista, ou envie cancelar.",
      shouldClear: false,
    };
  }

  return {
    message: `Transacao escolhida:\n\n${formatFoundTransaction(selected)}`,
    shouldClear: true,
  };
}
