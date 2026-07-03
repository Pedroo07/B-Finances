import { getCreditCardBankKey, getCreditCardName } from "@/lib/creditCards/catalog";
import {
  createCardTransaction,
  getCardTransactions,
  type CardTransaction,
} from "@/lib/services/admin/cardTransactionsAdmin";
import {
  getPendingBills,
  getUpcomingBills,
  type BillAccount,
} from "@/lib/services/admin/billAccountsAdmin";
import {
  createTransaction,
  getTransactions,
  type Transaction,
} from "@/lib/services/admin/transactionsAdmin";
import {
  getAllCardInvoices,
  getCardInvoiceAmount,
} from "@/lib/services/admin/userCreditCardsAdmin";
import {
  getInvestments,
  type Investment,
} from "@/lib/services/admin/investmentsAdmin";
import { handleDelete } from "../handlers/deleteHandler";
import { handlePayment } from "../handlers/paymentHandler";
import { IntentType } from "../intents/intentTypes";
import type {
  BFinanceCommand,
  BFinanceCommandResult,
  BFinanceFilters,
  BFinancePaymentMethod,
  BFinancePeriod,
  BFinanceScope,
  CommandBillItem,
  CommandInvestmentItem,
  CommandRankingItem,
  CommandTotals,
  CommandTransactionItem,
} from "./types";

type ExecutorInput = {
  userId: string;
  command: BFinanceCommand;
  messageText: string;
  conversationHistory?: string;
  phoneNumber?: string;
};

type TransactionQueryResult = {
  items: CommandTransactionItem[];
  totals: CommandTotals;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultPeriod(): BFinancePeriod {
  return {
    raw: null,
    type: "all",
    startDate: null,
    endDate: null,
    month: null,
    year: null,
    days: null,
    isExplicit: false,
  };
}

function defaultScope(): BFinanceScope {
  return {
    includeNormalTransactions: true,
    includeCardTransactions: true,
    cardName: null,
    excludeCardTransactions: false,
    paymentMethod: null,
    excludePaymentMethod: null,
  };
}

function getCommandPeriod(command: BFinanceCommand): BFinancePeriod {
  return command.period ?? defaultPeriod();
}

function getCommandScope(command: BFinanceCommand): BFinanceScope {
  return command.scope ?? defaultScope();
}

function withinPeriod(date: string, period: BFinancePeriod): boolean {
  if (period.startDate && date < period.startDate) return false;
  if (period.endDate && date > period.endDate) return false;
  return true;
}

function cardMatches(itemCardName: string | undefined, filterCardName?: string | null): boolean {
  if (!filterCardName) return true;

  const itemBankKey = getCreditCardBankKey(itemCardName ?? "");
  const filterBankKey = getCreditCardBankKey(filterCardName);

  if (itemBankKey && filterBankKey) return itemBankKey === filterBankKey;
  return normalizeText(itemCardName ?? "") === normalizeText(filterCardName);
}

function amountMatches(amount: number, filters: BFinanceFilters): boolean {
  const absoluteAmount = Math.abs(amount);

  if (filters.amount !== undefined && filters.amount !== null) {
    return Math.abs(absoluteAmount - Math.abs(filters.amount)) < 0.01;
  }

  if (filters.minAmount !== undefined && filters.minAmount !== null) {
    if (absoluteAmount < Math.abs(filters.minAmount)) return false;
  }

  if (filters.maxAmount !== undefined && filters.maxAmount !== null) {
    if (absoluteAmount > Math.abs(filters.maxAmount)) return false;
  }

  return true;
}

function textMatches(item: CommandTransactionItem, filters: BFinanceFilters): boolean {
  if (filters.category) {
    const normalizedCategory = normalizeText(filters.category);
    if (normalizeText(item.category ?? "") !== normalizedCategory) return false;
  }

  if (filters.description) {
    const needle = normalizeText(filters.description);
    const searchable = normalizeText(
      [item.description, item.category, item.cardName, item.paymentMethod]
        .filter(Boolean)
        .join(" "),
    );
    if (!searchable.includes(needle)) return false;
  }

  return amountMatches(item.amount, filters);
}

function normalTransactionToItem(transaction: Transaction): CommandTransactionItem {
  const type = transaction.type === "income" ? "income" : "expense";
  return {
    id: transaction.id,
    source: "transaction",
    description: transaction.description,
    date: transaction.date,
    amount:
      type === "income" ? Math.abs(transaction.amount) : -Math.abs(transaction.amount),
    category: transaction.category,
    type,
    paymentMethod: transaction.paymentMethod,
    cardName: null,
  };
}

function cardTransactionToItem(transaction: CardTransaction): CommandTransactionItem {
  return {
    id: transaction.id,
    source: "card_transaction",
    description: transaction.description,
    date: transaction.date,
    amount: -Math.abs(transaction.amount),
    category: transaction.category,
    type: "expense",
    paymentMethod: "credit_card",
    cardName: getCreditCardName(transaction.card),
  };
}

function filterNormalTransaction(
  item: CommandTransactionItem,
  command: BFinanceCommand,
): boolean {
  const period = getCommandPeriod(command);
  const scope = getCommandScope(command);
  const filters = command.filters ?? {};

  if (!scope.includeNormalTransactions) return false;
  if (!withinPeriod(item.date, period)) return false;
  if (command.transactionType === "expense" && item.type !== "expense") return false;
  if (command.transactionType === "income" && item.type !== "income") return false;

  if (scope.paymentMethod && scope.paymentMethod !== item.paymentMethod) {
    return false;
  }

  if (
    scope.excludePaymentMethod &&
    scope.excludePaymentMethod === item.paymentMethod
  ) {
    return false;
  }

  return textMatches(item, filters);
}

function filterCardTransaction(
  item: CommandTransactionItem,
  command: BFinanceCommand,
): boolean {
  const period = getCommandPeriod(command);
  const scope = getCommandScope(command);
  const filters = command.filters ?? {};

  if (!scope.includeCardTransactions || scope.excludeCardTransactions) {
    return false;
  }

  if (command.transactionType === "income") return false;
  if (!withinPeriod(item.date, period)) return false;
  if (!cardMatches(item.cardName ?? undefined, scope.cardName)) return false;

  return textMatches(item, filters);
}

function sortItems(
  items: CommandTransactionItem[],
  filters: BFinanceFilters | undefined,
): CommandTransactionItem[] {
  const orderBy = filters?.orderBy ?? "date_desc";
  return [...items].sort((a, b) => {
    if (orderBy === "date_asc") return a.date.localeCompare(b.date);
    if (orderBy === "amount_desc") return Math.abs(b.amount) - Math.abs(a.amount);
    if (orderBy === "amount_asc") return Math.abs(a.amount) - Math.abs(b.amount);

    return b.date.localeCompare(a.date);
  });
}

function applyLimit(
  items: CommandTransactionItem[],
  filters: BFinanceFilters | undefined,
): CommandTransactionItem[] {
  const limit = filters?.limit;
  if (!limit || limit <= 0) return items;
  return items.slice(0, Math.min(limit, 100));
}

function calculateTotals(items: CommandTransactionItem[]): CommandTotals {
  const income = items
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const normalExpense = items
    .filter((item) => item.type === "expense" && item.source === "transaction")
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const cardExpense = items
    .filter((item) => item.source === "card_transaction")
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const expense = normalExpense + cardExpense;

  return {
    income,
    normalExpense,
    cardExpense,
    expense,
    balance: income - expense,
    count: items.length,
  };
}

function buildCategoryRanking(
  items: CommandTransactionItem[],
): CommandRankingItem[] {
  const rankingsByCategory = items.reduce<Record<string, CommandRankingItem>>(
    (rankings, item) => {
      const label = item.category || "other";
      const current = rankings[label] ?? { label, total: 0, count: 0 };
      current.total += Math.abs(item.amount);
      current.count += 1;
      rankings[label] = current;
      return rankings;
    },
    {},
  );

  return Object.values(rankingsByCategory).sort((a, b) => b.total - a.total);
}

function buildTransactionTitle(command: BFinanceCommand): string {
  const scope = getCommandScope(command);
  const typeLabel =
    command.transactionType === "income"
      ? "Receitas"
      : command.transactionType === "expense"
        ? "Despesas"
        : "Transacoes";

  if (scope.includeCardTransactions && !scope.includeNormalTransactions) {
    return scope.cardName ? `${typeLabel} do cartao ${scope.cardName}` : `${typeLabel} do cartao`;
  }

  if (scope.excludeCardTransactions) return `${typeLabel} sem cartao`;
  return typeLabel;
}

async function queryTransactions(
  userId: string,
  command: BFinanceCommand,
): Promise<TransactionQueryResult> {
  const scope = getCommandScope(command);
  const [normalTransactions, cardTransactions] = await Promise.all([
    scope.includeNormalTransactions ? getTransactions(userId) : Promise.resolve([]),
    scope.includeCardTransactions && !scope.excludeCardTransactions
      ? getCardTransactions(userId)
      : Promise.resolve([]),
  ]);

  const normalItems = normalTransactions
    .map(normalTransactionToItem)
    .filter((item) => filterNormalTransaction(item, command));
  const cardItems = cardTransactions
    .map(cardTransactionToItem)
    .filter((item) => filterCardTransaction(item, command));
  const items = applyLimit(
    sortItems([...normalItems, ...cardItems], command.filters),
    command.filters,
  );

  return {
    items,
    totals: calculateTotals(items),
  };
}

function toBillItem(bill: BillAccount): CommandBillItem {
  return {
    id: bill.id,
    description: bill.description,
    amount: Math.abs(bill.amount),
    dueDate: bill.dueDate,
    status: bill.status,
  };
}

function toInvestmentItem(investment: Investment): CommandInvestmentItem {
  return {
    id: investment.id,
    category: investment.category,
    balance: investment.balance || 0,
    totalYield: investment.total_yield || 0,
    liquidity: investment.liquidez,
  };
}

function normalizeCategory(command: BFinanceCommand): string {
  if (command.data?.category) return command.data.category;
  if (command.filters?.category) return command.filters.category;
  return command.transactionType === "income" ? "extra" : "other";
}

function normalizePaymentMethod(command: BFinanceCommand): BFinancePaymentMethod {
  const method = command.data?.paymentMethod ?? command.scope?.paymentMethod;
  if (method === "cash" || method === "pix" || method === "debit") return method;
  if (method === "credit_card") return "credit_card";
  return command.transactionType === "income" ? "pix" : "pix";
}

async function executeCreateTransaction(
  userId: string,
  command: BFinanceCommand,
): Promise<BFinanceCommandResult> {
  const missingFields: string[] = [];
  const description = command.data?.description || command.filters?.description;
  const amount = command.data?.amount ?? command.filters?.amount ?? null;

  if (!description) missingFields.push("description");
  if (!amount || amount <= 0) missingFields.push("amount");

  if (missingFields.length > 0) {
    return {
      success: false,
      kind: "clarification",
      command,
      missingFields,
      message: "Preciso da descricao e do valor para adicionar a transacao.",
    };
  }

  const descriptionText = description ?? "";
  const amountValue = amount ?? 0;
  const paymentMethod = normalizePaymentMethod(command);
  const date = command.data?.date || formatDate(new Date());
  const category = normalizeCategory(command);
  const type = command.transactionType === "income" ? "income" : "expense";
  const normalizedAmount =
    type === "income" ? Math.abs(amountValue) : -Math.abs(amountValue);

  if (paymentMethod === "credit_card" || command.resource === "card_transaction") {
    const cardName = command.data?.cardName || command.scope?.cardName;

    if (!cardName) {
      return {
        success: false,
        kind: "clarification",
        command,
        missingFields: ["cardName"],
        message: "Qual cartao devo usar para essa compra?",
      };
    }

    const created = await createCardTransaction(userId, {
      description: descriptionText,
      amount: normalizedAmount,
      category,
      date,
      card: getCreditCardName(cardName),
    });

    return {
      success: true,
      kind: "transaction_created",
      command,
      item: cardTransactionToItem(created),
    };
  }

  const created = await createTransaction(userId, {
    description: descriptionText,
    amount: normalizedAmount,
    category,
    date,
    type,
    paymentMethod,
  });

  return {
    success: true,
    kind: "transaction_created",
    command,
    item: normalTransactionToItem(created),
  };
}

async function executeDeleteTransaction(
  userId: string,
  command: BFinanceCommand,
  phoneNumber?: string,
): Promise<BFinanceCommandResult> {
  const description = command.data?.description || command.filters?.description;

  if (!description || /\b(aquela|aquele|isso|essa|esse)\b/.test(normalizeText(description))) {
    return {
      success: false,
      kind: "clarification",
      command,
      missingFields: ["description"],
      message:
        "Qual transacao voce quer apagar? Me diga uma pista, como descricao, valor, data ou cartao.",
    };
  }

  const source =
    command.resource === "card_transaction" ||
    (command.scope?.includeCardTransactions && !command.scope.includeNormalTransactions)
      ? "card"
      : "transaction";
  const result = await handleDelete(
    userId,
    source === "card"
      ? IntentType.DELETE_CARD_TRANSACTION
      : IntentType.DELETE_TRANSACTION,
    {
      description,
      source,
    },
    phoneNumber ?? "",
  );

  return {
    success: true,
    kind: "ready_message",
    command,
    message: result.message,
    pendingAction: result.pendingAction,
  };
}

async function executePayment(
  userId: string,
  command: BFinanceCommand,
): Promise<BFinanceCommandResult> {
  const isInvoice = command.resource === "invoice";
  const description = command.data?.description || command.filters?.description;
  const card = command.data?.cardName || command.scope?.cardName;
  const amount = command.data?.amount ?? command.filters?.amount ?? undefined;

  if (isInvoice && !card) {
    return {
      success: false,
      kind: "clarification",
      command,
      missingFields: ["cardName"],
      message: "Qual fatura/cartao voce pagou?",
    };
  }

  if (isInvoice && (!amount || amount <= 0)) {
    return {
      success: false,
      kind: "clarification",
      command,
      missingFields: ["amount"],
      message: "Qual valor voce pagou nessa fatura?",
    };
  }

  if (!isInvoice && !description) {
    return {
      success: false,
      kind: "clarification",
      command,
      missingFields: ["description"],
      message: "Qual conta voce pagou?",
    };
  }

  const result = await handlePayment(
    userId,
    isInvoice ? IntentType.PAY_CARD_INVOICE : IntentType.PAY_BILL,
    isInvoice
      ? {
          card,
          amount,
          month: command.period?.month ?? undefined,
          year: command.period?.year ?? undefined,
        }
      : { description },
  );

  return {
    success: true,
    kind: "ready_message",
    command,
    message: result,
  };
}

async function executeInvoiceQuery(
  userId: string,
  command: BFinanceCommand,
): Promise<BFinanceCommandResult> {
  const today = new Date();
  const period = getCommandPeriod(command);
  const month = period.month || today.getMonth() + 1;
  const year = period.year || today.getFullYear();
  const cardName = command.scope?.cardName || command.data?.cardName || null;

  if (cardName) {
    const amount = await getCardInvoiceAmount(userId, cardName, year, month);
    return {
      success: true,
      kind: "invoice_summary",
      command,
      title: `Fatura ${getCreditCardName(cardName)}`,
      period: {
        ...period,
        month,
        year,
      },
      invoices: [{ cardName: getCreditCardName(cardName), amount }],
      total: amount,
    };
  }

  const invoices = await getAllCardInvoices(userId, year, month);
  const total = invoices.reduce((sum, invoice) => sum + invoice.amount, 0);

  return {
    success: true,
    kind: "invoice_summary",
    command,
    title: "Faturas",
    period: {
      ...period,
      month,
      year,
    },
    invoices,
    total,
  };
}

async function executeBillsQuery(
  userId: string,
  command: BFinanceCommand,
): Promise<BFinanceCommandResult> {
  const days = command.filters?.limit ?? command.period?.days ?? null;
  const bills =
    days && days <= 14 ? await getUpcomingBills(userId, days) : await getPendingBills(userId);
  const billItems = bills.map(toBillItem);
  const total = billItems.reduce((sum, bill) => sum + bill.amount, 0);

  return {
    success: true,
    kind: "bill_list",
    command,
    title: "Contas a pagar",
    bills: billItems,
    total,
  };
}

async function executeInvestmentsQuery(
  userId: string,
  command: BFinanceCommand,
): Promise<BFinanceCommandResult> {
  const investments = (await getInvestments(userId)).map(toInvestmentItem);
  const totalBalance = investments.reduce(
    (sum, investment) => sum + investment.balance,
    0,
  );
  const totalYield = investments.reduce(
    (sum, investment) => sum + investment.totalYield,
    0,
  );

  return {
    success: true,
    kind: "investment_summary",
    command,
    title: "Investimentos",
    investments,
    totalBalance,
    totalYield,
  };
}

async function executeSummaryQuery(
  userId: string,
  command: BFinanceCommand,
): Promise<BFinanceCommandResult> {
  const transactionResult = await queryTransactions(userId, {
    ...command,
    resource: "transaction",
    transactionType: "all",
    scope: {
      includeNormalTransactions: true,
      includeCardTransactions: true,
      cardName: null,
      excludeCardTransactions: false,
      paymentMethod: null,
      excludePaymentMethod: null,
    },
    filters: {
      ...command.filters,
      limit: null,
    },
  });
  const [pendingBills, investments] = await Promise.all([
    getPendingBills(userId),
    getInvestments(userId),
  ]);

  return {
    success: true,
    kind: "financial_summary",
    command,
    title: "Resumo financeiro",
    period: getCommandPeriod(command),
    totals: transactionResult.totals,
    pendingBills: pendingBills.map(toBillItem),
    investments: investments.map(toInvestmentItem),
  };
}

async function executeTransactionQuery(
  userId: string,
  command: BFinanceCommand,
): Promise<BFinanceCommandResult> {
  const result = await queryTransactions(userId, command);
  const period = getCommandPeriod(command);
  const title = buildTransactionTitle(command);

  if (command.operation === "ranking") {
    const rankings = buildCategoryRanking(result.items);
    return {
      success: true,
      kind: "category_ranking",
      command,
      title: `${title} por categoria`,
      period,
      rankings,
      total: rankings.reduce((sum, item) => sum + item.total, 0),
    };
  }

  if (command.operation === "total") {
    return {
      success: true,
      kind: "transaction_total",
      command,
      title,
      period,
      totals: result.totals,
      items: result.items,
    };
  }

  return {
    success: true,
    kind: "transaction_list",
    command,
    title,
    period,
    totals: result.totals,
    items: result.items,
  };
}

export async function executeBFinanceCommand({
  userId,
  command,
  phoneNumber,
}: ExecutorInput): Promise<BFinanceCommandResult> {
  try {
    if (command.action === "help") {
      return {
        success: true,
        kind: "ready_message",
        command,
        message:
          "Voce pode adicionar gastos e receitas, listar transacoes, consultar faturas, contas, investimentos e pedir resumo financeiro.",
      };
    }

    if (command.action === "clarify") {
      return {
        success: false,
        kind: "clarification",
        command,
        message:
          command.clarification?.question ||
          "Pode me dizer um pouco melhor o que voce quer fazer?",
        missingFields: command.clarification?.missingFields,
      };
    }

    if (command.action === "create" && command.resource === "transaction") {
      return await executeCreateTransaction(userId, command);
    }

    if (
      command.action === "create" &&
      command.resource === "card_transaction"
    ) {
      return await executeCreateTransaction(userId, command);
    }

    if (
      command.action === "delete" &&
      (command.resource === "transaction" ||
        command.resource === "card_transaction")
    ) {
      return await executeDeleteTransaction(userId, command, phoneNumber);
    }

    if (command.action === "update") {
      return {
        success: false,
        kind: "clarification",
        command,
        missingFields: ["fieldToEdit"],
        message:
          "Qual campo voce quer alterar nessa transacao: descricao, valor, data, categoria ou metodo de pagamento?",
      };
    }

    if (command.action === "pay") {
      return await executePayment(userId, command);
    }

    if (command.action !== "query") {
      return {
        success: false,
        kind: "clarification",
        command,
        message: "Nao entendi qual acao voce quer executar.",
      };
    }

    if (
      command.resource === "transaction" ||
      command.resource === "card_transaction"
    ) {
      return await executeTransactionQuery(userId, command);
    }

    if (command.resource === "summary") {
      return await executeSummaryQuery(userId, command);
    }

    if (command.resource === "invoice") {
      return await executeInvoiceQuery(userId, command);
    }

    if (command.resource === "bill") {
      return await executeBillsQuery(userId, command);
    }

    if (command.resource === "investment") {
      return await executeInvestmentsQuery(userId, command);
    }

    return {
      success: false,
      kind: "clarification",
      command,
      message: "Nao entendi muito bem o que voce quer consultar.",
    };
  } catch (error) {
    console.error("Erro ao executar comando B-Finances:", error);
    return {
      success: false,
      kind: "error",
      command,
      message: "Ocorreu um erro ao processar sua solicitacao. Tente novamente.",
    };
  }
}
