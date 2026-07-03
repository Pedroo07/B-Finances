import type { CardTransaction } from "@/lib/services/admin/cardTransactionsAdmin";
import type { BillAccount } from "@/lib/services/admin/billAccountsAdmin";
import type { Transaction } from "@/lib/services/admin/transactionsAdmin";
import type { FinancialDataSet } from "./dataTools";
import type { FinancialPlan, FinancialScope, ResolvedPeriod } from "./types";

export type FinancialEntry = {
  id: string;
  source: "transaction" | "card";
  type: "income" | "expense";
  description: string;
  category: string;
  date: string;
  amount: number;
  cardName?: string;
};

export type CategoryTotal = {
  category: string;
  label: string;
  amount: number;
  percentage: number;
};

export type RecurringInsight = {
  label: string;
  amount: number;
  source: "bill" | "pattern";
  detail: string;
};

export type UnusualInsight = {
  category: string;
  label: string;
  amount: number;
  previousAmount: number;
  difference: number;
};

export type SmallRepeatedInsight = {
  label: string;
  count: number;
  total: number;
};

const CREDIT_CARD_PAYMENT_CATEGORIES = new Set([
  "credit_card",
  "credit card",
  "cartao de credito",
  "cartoes de credito",
]);

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function safeAmount(value: unknown): number {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function isIncome(transaction: Transaction): boolean {
  return transaction.type === "income" || safeAmount(transaction.amount) > 0;
}

function isExpense(transaction: Transaction): boolean {
  return transaction.type === "expense" || safeAmount(transaction.amount) < 0;
}

function isCreditCardPayment(transaction: Transaction): boolean {
  const category = normalizeText(transaction.category || "");
  const description = normalizeText(transaction.description || "");

  return (
    CREDIT_CARD_PAYMENT_CATEGORIES.has(category) ||
    description.includes("fatura do cartao") ||
    description.includes("fatura cartao")
  );
}

function transactionToEntry(
  transaction: Transaction,
  type: "income" | "expense",
): FinancialEntry {
  return {
    id: transaction.id,
    source: "transaction",
    type,
    description: transaction.description || "Sem descricao",
    category: transaction.category || "other",
    date: transaction.date,
    amount: Math.abs(safeAmount(transaction.amount)),
  };
}

function cardTransactionToEntry(
  transaction: CardTransaction,
): FinancialEntry {
  return {
    id: transaction.id,
    source: "card",
    type: "expense",
    description: transaction.description || "Sem descricao",
    category: transaction.category || "other",
    date: transaction.date,
    amount: Math.abs(safeAmount(transaction.amount)),
    cardName: transaction.card,
  };
}

export function incomeEntries(transactions: Transaction[]): FinancialEntry[] {
  return transactions.filter(isIncome).map((transaction) =>
    transactionToEntry(transaction, "income"),
  );
}

export function cashExpenseEntries(transactions: Transaction[]): FinancialEntry[] {
  return transactions
    .filter(isExpense)
    .filter((transaction) => !isCreditCardPayment(transaction))
    .map((transaction) => transactionToEntry(transaction, "expense"));
}

export function cardExpenseEntries(
  cardTransactions: CardTransaction[],
  cardName?: string,
): FinancialEntry[] {
  return cardTransactions
    .filter((transaction) => !cardName || transaction.card === cardName)
    .map(cardTransactionToEntry);
}

export function expenseEntriesForPlan(
  data: FinancialDataSet,
  plan: FinancialPlan,
): FinancialEntry[] {
  const cashEntries = plan.scope === "card" ? [] : cashExpenseEntries(data.transactions);
  const cardEntries =
    plan.scope === "cash"
      ? []
      : cardExpenseEntries(data.cardTransactions, plan.cardName);
  const entries = [...cashEntries, ...cardEntries];

  if (!plan.filters?.category) return entries;

  return entries.filter((entry) => entry.category === plan.filters?.category);
}

export function entriesTotal(entries: FinancialEntry[]): number {
  return entries.reduce((total, entry) => total + entry.amount, 0);
}

export function sortEntriesByDate(entries: FinancialEntry[]): FinancialEntry[] {
  return [...entries].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return b.amount - a.amount;
  });
}

export function categoryLabel(category: string): string {
  const categoryMap: Record<string, string> = {
    salary: "Salario",
    credit_card: "Cartoes de Credito",
    "credit card": "Cartoes de Credito",
    extra: "Extra",
    other: "Outros",
    fixes: "Fixas",
    foods: "Alimentacao",
    entertainment: "Lazer",
    cdb: "CDB",
    imoveis: "Imoveis",
    cripto: "Cripto",
    acoes: "Acoes",
    fundos: "Fundos",
  };

  return categoryMap[category] || category;
}

export function groupByCategory(entries: FinancialEntry[]): CategoryTotal[] {
  const total = entriesTotal(entries);
  const grouped = entries.reduce<Record<string, number>>((groups, entry) => {
    groups[entry.category] = (groups[entry.category] || 0) + entry.amount;
    return groups;
  }, {});

  return Object.entries(grouped)
    .map(([category, amount]) => ({
      category,
      label: categoryLabel(category),
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function isRecurringBill(bill: BillAccount): boolean {
  if (bill.hiddenFromBills || bill.source === "credit_card_invoice") {
    return false;
  }

  if (typeof bill.recurrence === "string") {
    return bill.recurrence === "monthly" || bill.recurrence === "installments";
  }

  return bill.recurrence.type === "monthly" || bill.recurrence.type === "yearly";
}

function recurrenceLabel(bill: BillAccount): string {
  if (typeof bill.recurrence === "string") return bill.recurrence;
  return bill.recurrence.type;
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function isInLookback(entry: FinancialEntry, period: ResolvedPeriod): boolean {
  const end = new Date(`${period.endDate}T00:00:00`);
  const start = new Date(end);
  start.setMonth(start.getMonth() - 6);
  const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  return entry.date >= startStr && entry.date <= period.endDate;
}

function normalizeDescription(description: string): string {
  return normalizeText(description)
    .replace(/\b(parcela|pagamento|assinatura|mensalidade)\b/g, "")
    .replace(/\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function recurringInsights(
  bills: BillAccount[],
  historicalEntries: FinancialEntry[],
  period: ResolvedPeriod,
): RecurringInsight[] {
  const billInsights = bills
    .filter(isRecurringBill)
    .map((bill) => ({
      label: bill.description,
      amount: Math.abs(safeAmount(bill.amount)),
      source: "bill" as const,
      detail: recurrenceLabel(bill),
    }))
    .filter((item) => item.amount > 0);

  const grouped = historicalEntries
    .filter((entry) => entry.type === "expense")
    .filter((entry) => isInLookback(entry, period))
    .reduce<
      Record<string, { label: string; total: number; count: number; months: Set<string> }>
    >((groups, entry) => {
      const key = `${normalizeDescription(entry.description)}|${entry.category}`;
      if (!key.trim()) return groups;
      if (!groups[key]) {
        groups[key] = {
          label: entry.description,
          total: 0,
          count: 0,
          months: new Set<string>(),
        };
      }
      groups[key].total += entry.amount;
      groups[key].count += 1;
      groups[key].months.add(monthKey(entry.date));
      return groups;
    }, {});

  const patternInsights = Object.values(grouped)
    .filter((item) => item.months.size >= 3)
    .map((item) => ({
      label: item.label,
      amount: item.total / item.count,
      source: "pattern" as const,
      detail: `${item.months.size} meses`,
    }));

  return [...billInsights, ...patternInsights]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
}

export function unusualCategoryInsights(
  currentEntries: FinancialEntry[],
  previousEntries: FinancialEntry[],
): UnusualInsight[] {
  const current = groupByCategory(currentEntries);
  const previous = groupByCategory(previousEntries);
  const previousByCategory = new Map(
    previous.map((item) => [item.category, item.amount]),
  );

  return current
    .map((item) => {
      const previousAmount = previousByCategory.get(item.category) || 0;
      const difference = item.amount - previousAmount;
      const grewEnough =
        (previousAmount === 0 && item.amount >= 100) ||
        (previousAmount > 0 && difference >= 50 && item.amount >= previousAmount * 1.3);

      if (!grewEnough) return null;

      return {
        category: item.category,
        label: item.label,
        amount: item.amount,
        previousAmount,
        difference,
      };
    })
    .filter((item): item is UnusualInsight => Boolean(item))
    .sort((a, b) => b.difference - a.difference)
    .slice(0, 5);
}

export function smallRepeatedInsights(
  entries: FinancialEntry[],
): SmallRepeatedInsight[] {
  const grouped = entries
    .filter((entry) => entry.amount > 0 && entry.amount <= 80)
    .reduce<Record<string, { label: string; count: number; total: number }>>(
      (groups, entry) => {
        const descriptionKey = normalizeDescription(entry.description);
        const key = `${descriptionKey || entry.category}|${entry.category}`;
        if (!groups[key]) {
          groups[key] = { label: entry.description, count: 0, total: 0 };
        }
        groups[key].count += 1;
        groups[key].total += entry.amount;
        return groups;
      },
      {},
    );

  return Object.values(grouped)
    .filter((item) => item.count >= 3)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
}

export function lifestyleTotal(
  entries: FinancialEntry[],
  kind: "food" | "leisure" | "transport" | "subscriptions",
): number {
  const patterns: Record<typeof kind, RegExp> = {
    food: /\b(ifood|delivery|restaurante|lanche|pizza|mercado|supermercado|comida|alimentacao)\b/,
    leisure: /\b(lazer|cinema|show|bar|jogo|viagem|festa|ingresso)\b/,
    transport: /\b(uber|99|taxi|posto|gasolina|combustivel|transporte|metro|onibus)\b/,
    subscriptions: /\b(netflix|spotify|prime|assinatura|mensalidade|icloud|google|youtube|academia)\b/,
  };

  return entries
    .filter((entry) => {
      const text = normalizeText(`${entry.description} ${entry.category}`);
      if (kind === "food" && entry.category === "foods") return true;
      if (kind === "leisure" && entry.category === "entertainment") return true;
      return patterns[kind].test(text);
    })
    .reduce((total, entry) => total + entry.amount, 0);
}

export function monthlyTotals(
  income: FinancialEntry[],
  expenses: FinancialEntry[],
): Array<{ month: string; income: number; expenses: number; balance: number }> {
  const months = new Map<string, { income: number; expenses: number }>();

  for (const entry of income) {
    const key = monthKey(entry.date);
    const item = months.get(key) || { income: 0, expenses: 0 };
    item.income += entry.amount;
    months.set(key, item);
  }

  for (const entry of expenses) {
    const key = monthKey(entry.date);
    const item = months.get(key) || { income: 0, expenses: 0 };
    item.expenses += entry.amount;
    months.set(key, item);
  }

  return [...months.entries()]
    .map(([month, values]) => ({
      month,
      income: values.income,
      expenses: values.expenses,
      balance: values.income - values.expenses,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function historicalExpenseEntriesForScope(
  data: FinancialDataSet,
  scope: FinancialScope,
  cardName?: string,
): FinancialEntry[] {
  const cashEntries =
    scope === "card" ? [] : cashExpenseEntries(data.historicalTransactions);
  const cardEntries =
    scope === "cash"
      ? []
      : cardExpenseEntries(data.historicalCardTransactions, cardName);

  return [...cashEntries, ...cardEntries];
}
