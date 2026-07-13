import { getCreditCardBankKey, getCreditCardName } from "@/lib/creditCards/catalog";
import {
  createCardInstallmentTransactions,
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
  buildTransactionSelectionMessage,
  FIELD_QUESTION,
  type PendingUpdateTransactionAction,
  type UpdateTransactionTarget,
} from "../handlers/updateTransactionHandler";
import { getBrasiliaDate } from "../utils/brasiliaDate";
import {
  getAllCardInvoices,
  getCardInvoiceAmount,
  getCurrentCardInvoiceTransactions,
  getUserCreditCards,
  type CardInvoiceTransactionsResult,
  type UserCreditCard,
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

type PreparedTransactionQuery = {
  command: BFinanceCommand;
  period: BFinancePeriod;
  result: TransactionQueryResult;
  title?: string;
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

function formatDisplayDate(date: string): string {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
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

function currentInvoicePeriod(): BFinancePeriod {
  return {
    raw: "fatura atual",
    type: "current_invoice",
    startDate: null,
    endDate: null,
    month: null,
    year: null,
    days: null,
    isExplicit: false,
  };
}

function getCommandPeriod(command: BFinanceCommand): BFinancePeriod {
  return command.period ?? defaultPeriod();
}

function getCommandScope(command: BFinanceCommand): BFinanceScope {
  return command.scope ?? defaultScope();
}

function isCardOnlyQuery(command: BFinanceCommand): boolean {
  const scope = getCommandScope(command);
  return (
    command.action === "query" &&
    (command.resource === "transaction" ||
      command.resource === "card_transaction") &&
    scope.includeCardTransactions &&
    !scope.includeNormalTransactions &&
    !scope.excludeCardTransactions
  );
}

function cardDisplayName(card: UserCreditCard): string {
  return getCreditCardName(card.bankKey ?? card.id);
}

function withSelectedCard(
  command: BFinanceCommand,
  cardName: string,
): BFinanceCommand {
  const scope = getCommandScope(command);

  return {
    ...command,
    resource: "card_transaction",
    scope: {
      ...scope,
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

function withDefaultCurrentInvoice(command: BFinanceCommand): BFinanceCommand {
  const period = getCommandPeriod(command);

  if (!isCardOnlyQuery(command) || period.type !== "all" || period.isExplicit) {
    return command;
  }

  return {
    ...command,
    period: currentInvoicePeriod(),
  };
}

function buildCardSelectionMessage(cardNames: string[]): string {
  return [
    "Qual cartão você quer consultar?",
    "",
    ...cardNames.map((cardName, index) => `${index + 1}. ${cardName}`),
  ].join("\n");
}

async function prepareCardQueryCommand(
  userId: string,
  command: BFinanceCommand,
): Promise<{ command: BFinanceCommand } | { result: BFinanceCommandResult }> {
  const scope = getCommandScope(command);

  if (!isCardOnlyQuery(command) || scope.cardName) {
    return { command: withDefaultCurrentInvoice(command) };
  }

  const cards = await getUserCreditCards(userId);
  const cardNames = cards.map(cardDisplayName);

  if (cardNames.length === 0) {
    return {
      result: {
        success: true,
        kind: "ready_message",
        command,
        message:
          "Você ainda não tem cartões cadastrados. Cadastre um cartão no aplicativo para consultar os gastos.",
      },
    };
  }

  if (cardNames.length === 1) {
    return {
      command: withDefaultCurrentInvoice(withSelectedCard(command, cardNames[0])),
    };
  }

  return {
    result: {
      success: true,
      kind: "ready_message",
      command,
      message: buildCardSelectionMessage(cardNames),
      pendingAction: {
        type: "select_card_for_query",
        command,
        cards: cardNames.map((cardName, index) => ({
          index: index + 1,
          cardName,
        })),
      },
    },
  };
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
    installmentNumber: transaction.installmentNumber ?? null,
    installmentCount: transaction.installmentCount ?? null,
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
        : "Transações";

  if (scope.includeCardTransactions && !scope.includeNormalTransactions) {
    return scope.cardName ? `${typeLabel} do cartão ${scope.cardName}` : `${typeLabel} do cartão`;
  }

  if (scope.excludeCardTransactions) return `${typeLabel} sem cartão`;
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

function invoicePeriodFromResult(
  invoice: CardInvoiceTransactionsResult,
): BFinancePeriod {
  return {
    raw: "fatura atual",
    type: "current_invoice",
    startDate: invoice.startDate,
    endDate: invoice.endDate,
    month: null,
    year: null,
    days: null,
    isExplicit: true,
  };
}

async function queryCurrentInvoiceTransactions(
  userId: string,
  command: BFinanceCommand,
): Promise<PreparedTransactionQuery | { response: BFinanceCommandResult }> {
  const scope = getCommandScope(command);
  const cardName = scope.cardName;

  if (!cardName) {
    return {
      response: {
        success: false,
        kind: "clarification",
        command,
        missingFields: ["cardName"],
        message: "Qual cartão você quer consultar?",
      },
    };
  }

  let invoice: CardInvoiceTransactionsResult;
  try {
    invoice = await getCurrentCardInvoiceTransactions(userId, cardName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("Credit card billing is not configured")) {
      return {
        response: {
          success: true,
          kind: "ready_message",
          command,
          message:
            "A fatura desse cartão ainda não está configurada. Configure o dia de fechamento e vencimento no aplicativo para consultar a fatura atual.",
        },
      };
    }

    if (message.includes("Credit card not found")) {
      return {
        response: {
          success: true,
          kind: "ready_message",
          command,
          message: "Não encontrei esse cartão cadastrado.",
        },
      };
    }

    throw error;
  }

  const period = invoicePeriodFromResult(invoice);
  const invoiceCommand = {
    ...command,
    period,
    scope: {
      ...scope,
      cardName: invoice.cardName,
    },
  };
  const items = invoice.transactions
    .map(cardTransactionToItem)
    .filter((item) => filterCardTransaction(item, invoiceCommand));
  const sortedItems = applyLimit(
    sortItems(items, invoiceCommand.filters),
    invoiceCommand.filters,
  );

  return {
    command: invoiceCommand,
    period,
    result: {
      items: sortedItems,
      totals: calculateTotals(sortedItems),
    },
    title: `Despesas da fatura atual do cartão ${invoice.cardName} (vence em ${formatDisplayDate(invoice.dueDate)})`,
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
      message: "Preciso da descrição e do valor para adicionar a transação.",
    };
  }

  const descriptionText = description ?? "";
  const amountValue = amount ?? 0;
  const paymentMethod = normalizePaymentMethod(command);
  const date = command.data?.date || formatDate(getBrasiliaDate());
  const category = normalizeCategory(command);
  const type = command.transactionType === "income" ? "income" : "expense";
  const normalizedAmount =
    type === "income" ? Math.abs(amountValue) : -Math.abs(amountValue);
  const installmentRequested = Boolean(command.data?.installmentRequested);
  const installmentCount = command.data?.installmentCount ?? 1;

  if (installmentRequested && installmentCount === 1) {
    return {
      success: false,
      kind: "clarification",
      command,
      missingFields: ["installmentCount"],
      message: "Em quantas vezes foi parcelada a compra? Escolha entre 2x e 12x.",
    };
  }

  if (
    installmentRequested
    && (!Number.isInteger(installmentCount) || installmentCount < 2 || installmentCount > 12)
  ) {
    return {
      success: false,
      kind: "clarification",
      command,
      missingFields: ["installmentCount"],
      message: "O parcelamento deve estar entre 2x e 12x.",
    };
  }

  const isInstallmentPurchase = installmentRequested && installmentCount > 1;
  const isCardPurchase =
    paymentMethod === "credit_card"
    || command.resource === "card_transaction"
    || isInstallmentPurchase;

  if (isCardPurchase) {
    let cardName = command.data?.cardName || command.scope?.cardName;
    let resolvedCommand = command;

    if (!cardName) {
      const cards = await getUserCreditCards(userId);
      const cardNames = cards.map(cardDisplayName);

      if (cardNames.length === 0) {
        return {
          success: true,
          kind: "ready_message",
          command,
          message: "Você ainda não tem cartões cadastrados. Cadastre um cartão no aplicativo antes de adicionar esta compra.",
        };
      }

      if (cardNames.length > 1) {
        return {
          success: true,
          kind: "ready_message",
          command,
          message: [
            "Qual cartão devo usar para essa compra?",
            "",
            ...cardNames.map((name, index) => `${index + 1}. ${name}`),
          ].join("\n"),
          pendingAction: {
            type: "select_card_for_query",
            command,
            cards: cardNames.map((name, index) => ({ index: index + 1, cardName: name })),
          },
        };
      }

      cardName = cardNames[0];
      resolvedCommand = withSelectedCard(command, cardName);
    }

    if (isInstallmentPurchase) {
      const created = await createCardInstallmentTransactions(userId, {
        description: descriptionText,
        totalAmount: Math.abs(amountValue),
        category,
        purchaseDate: date,
        card: getCreditCardName(cardName),
        installmentCount,
      });
      const item = cardTransactionToItem(created[0]);
      item.totalAmount = Math.abs(amountValue);

      return {
        success: true,
        kind: "transaction_created",
        command: resolvedCommand,
        item,
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
      command: resolvedCommand,
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

async function executeUpdateTransaction(
  userId: string,
  command: BFinanceCommand,
): Promise<BFinanceCommandResult> {
  const targetDate = command.data?.date;
  const targetCommand: BFinanceCommand = {
    ...command,
    filters: {
      ...(command.filters ?? {}),
      description:
        command.filters?.description ?? command.data?.description ?? null,
      amount: command.filters?.amount ?? command.data?.amount ?? null,
      category: command.filters?.category ?? command.data?.category ?? null,
    },
    period: targetDate
      ? {
          raw: targetDate,
          type: "date_range",
          startDate: targetDate,
          endDate: targetDate,
          month: null,
          year: null,
          days: null,
          isExplicit: true,
        }
      : command.period,
  };
  const result = await queryTransactions(userId, targetCommand);
  const candidates = result.items.slice(0, 5) as UpdateTransactionTarget[];

  if (candidates.length === 0) {
    return {
      success: false,
      kind: "clarification",
      command,
      message:
        "Não encontrei a transação que você quer alterar. Informe uma pista, como descrição, valor ou data.",
    };
  }

  let message = FIELD_QUESTION;
  let pendingAction: PendingUpdateTransactionAction = {
    type: "update_transaction",
    step: "field",
    target: candidates[0],
  };

  if (candidates.length > 1) {
    message = buildTransactionSelectionMessage(candidates);
    pendingAction = {
      type: "update_transaction",
      step: "transaction",
      candidates,
    };
  }

  return {
    success: true,
    kind: "ready_message",
    command,
    message,
    pendingAction,
  };
}

async function executeDeleteTransaction(
  userId: string,
  command: BFinanceCommand,
): Promise<BFinanceCommandResult> {
  const description = command.data?.description || command.filters?.description;

  if (!description || /\b(aquela|aquele|isso|essa|esse)\b/.test(normalizeText(description))) {
    return {
      success: false,
      kind: "clarification",
      command,
      missingFields: ["description"],
      message:
        "Qual transação você quer apagar? Dê uma pista, como descrição, valor, data ou cartão.",
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
      message: "Qual fatura ou cartão você pagou?",
    };
  }

  if (isInvoice && (!amount || amount <= 0)) {
    return {
      success: false,
      kind: "clarification",
      command,
      missingFields: ["amount"],
      message: "Qual valor você pagou nessa fatura?",
    };
  }

  if (!isInvoice && !description) {
    return {
      success: false,
      kind: "clarification",
      command,
      missingFields: ["description"],
      message: "Qual conta você pagou?",
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
  const today = getBrasiliaDate();
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
  const period = getCommandPeriod(command);
  const bills =
    period.isExplicit && period.startDate && period.endDate
      ? (await getPendingBills(userId)).filter((bill) =>
          withinPeriod(bill.dueDate, period),
        )
      : days && days <= 14
        ? await getUpcomingBills(userId, days)
        : await getPendingBills(userId);
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
  const totals = {
    ...transactionResult.totals,
    balance: transactionResult.totals.income - transactionResult.totals.normalExpense,
  };

  return {
    success: true,
    kind: "financial_summary",
    command,
    title: "Resumo financeiro",
    period: getCommandPeriod(command),
    totals,
    pendingBills: pendingBills.map(toBillItem),
    investments: investments.map(toInvestmentItem),
  };
}

function buildTransactionQueryResponse(
  command: BFinanceCommand,
  result: TransactionQueryResult,
  period: BFinancePeriod,
  title: string = buildTransactionTitle(command),
): BFinanceCommandResult {
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

async function executeTransactionQuery(
  userId: string,
  command: BFinanceCommand,
): Promise<BFinanceCommandResult> {
  const prepared = await prepareCardQueryCommand(userId, command);
  if ("result" in prepared) return prepared.result;

  const preparedCommand = prepared.command;

  if (getCommandPeriod(preparedCommand).type === "current_invoice") {
    const invoiceQuery = await queryCurrentInvoiceTransactions(
      userId,
      preparedCommand,
    );
    if ("response" in invoiceQuery) return invoiceQuery.response;

    return buildTransactionQueryResponse(
      invoiceQuery.command,
      invoiceQuery.result,
      invoiceQuery.period,
      invoiceQuery.title,
    );
  }

  const result = await queryTransactions(userId, preparedCommand);
  const period = getCommandPeriod(preparedCommand);
  return buildTransactionQueryResponse(preparedCommand, result, period);
}

export async function executeBFinanceCommand({
  userId,
  command,
}: ExecutorInput): Promise<BFinanceCommandResult> {
  try {
    if (command.action === "help") {
      return {
        success: true,
        kind: "ready_message",
        command,
        message:
          "Você pode adicionar gastos e receitas, listar transações, consultar faturas, contas, investimentos e pedir um resumo financeiro.",
      };
    }

    if (command.action === "clarify") {
      return {
        success: false,
        kind: "clarification",
        command,
        message:
          command.clarification?.question ||
          "Pode explicar um pouco melhor o que você quer fazer?",
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
      return await executeDeleteTransaction(userId, command);
    }

    if (
      command.action === "update" &&
      (command.resource === "transaction" ||
        command.resource === "card_transaction")
    ) {
      return await executeUpdateTransaction(userId, command);
    }

    if (command.action === "pay") {
      return await executePayment(userId, command);
    }

    if (command.action !== "query") {
      return {
        success: false,
        kind: "clarification",
        command,
        message: "Não entendi qual ação você quer executar.",
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
      message: "Não entendi muito bem o que você quer consultar.",
    };
  } catch (error) {
    console.error("Erro ao executar comando B-Finances:", error);
    return {
      success: false,
      kind: "error",
      command,
      message: "Ocorreu um erro ao processar sua solicitação. Tente novamente.",
    };
  }
}
