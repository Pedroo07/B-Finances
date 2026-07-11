import {
  getTransactions,
  type Transaction,
} from "@/lib/services/admin/transactionsAdmin";
import {
  getCardTransactions,
  type CardTransaction,
} from "@/lib/services/admin/cardTransactionsAdmin";
import {
  getBillAccounts,
  getPendingBills,
  type BillAccount,
} from "@/lib/services/admin/billAccountsAdmin";
import {
  getInvestments,
  type Investment,
} from "@/lib/services/admin/investmentsAdmin";
import { formatCurrency } from "../formatters/responseFormatter";
import {
  formatCategoryWithEmoji,
  getCategoryLabel,
} from "@/lib/whatsapp/categories";

type ExpenseSource = "transaction" | "card";

type ExpenseEntry = {
  id: string;
  source: ExpenseSource;
  description: string;
  category: string;
  date: string;
  amount: number;
};

type MonthRange = {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
};

type MonthSummary = {
  range: MonthRange;
  income: number;
  cashExpense: number;
  cashBalance: number;
  consumptionExpense: number;
  categoryTotals: Record<string, number>;
};

type MonthComparison = {
  current: MonthSummary;
  previous: MonthSummary;
  expenseDifference: number;
  expenseChangePercent: number | null;
  incomeDifference: number;
  incomeChangePercent: number | null;
  balanceDifference: number;
};

type CategoryInsight = {
  category: string;
  amount: number;
  percentage: number;
};

type UnusualSpending = {
  kind: "category" | "transaction";
  label: string;
  amount: number;
  referenceAmount: number;
  difference: number;
  reason: string;
};

type RecurringExpense = {
  description: string;
  amount: number;
  months: number;
  source: "bill" | "pattern";
  recurrence: string;
};

type Projection = {
  projectedConsumption: number | null;
  projectedBalance: number | null;
  pendingBillsToMonthEnd: number;
  budgetReference: number | null;
  budgetStatus: string;
  historyMonths: number;
};

type SavingsPotential = {
  categoryExcess: number;
  recurringReview: number;
  total: number;
};

type FinancialAdviceAnalysis = {
  question: string;
  today: string;
  dataPoints: {
    transactions: number;
    cardTransactions: number;
    bills: number;
    pendingBills: number;
    investments: number;
  };
  comparison: MonthComparison;
  topCategories: CategoryInsight[];
  unusualSpendings: UnusualSpending[];
  recurringExpenses: RecurringExpense[];
  projection: Projection;
  savingsPotential: SavingsPotential;
  purchaseTarget?: {
    amount: number;
    conservativeAvailable: number;
    projectedAvailable: number | null;
    liquidInvestments: number;
  };
};

const LOOKBACK_MONTHS = 3;
const RECURRING_LOOKBACK_MONTHS = 6;
const MIN_CATEGORY_ANOMALY_AMOUNT = 50;
const MIN_NEW_CATEGORY_AMOUNT = 100;
const CREDIT_CARD_PAYMENT_CATEGORIES = new Set([
  "credit card",
  "credit_card",
  "cartoes de credito",
  "cartao de credito",
]);

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function toDateString(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

function monthRangeFromOffset(today: Date, offset: number): MonthRange {
  const year = today.getFullYear();
  const monthIndex = today.getMonth() - offset;
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  const key = `${start.getFullYear()}-${pad2(start.getMonth() + 1)}`;

  return {
    key,
    label: `${MONTH_NAMES[start.getMonth()]}/${start.getFullYear()}`,
    startDate: toDateString(start),
    endDate: toDateString(end),
  };
}

function daysInCurrentMonth(today: Date): number {
  return new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
}

function isDateInRange(date: string, range: MonthRange): boolean {
  return date >= range.startDate && date <= range.endDate;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeCategory(category: string | undefined): string {
  return normalizeText(category || "other");
}

function translateCategory(category: string): string {
  return getCategoryLabel(category);
}

function safeAmount(value: unknown): number {
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
  const category = normalizeCategory(transaction.category);
  const description = normalizeText(transaction.description || "");

  return (
    CREDIT_CARD_PAYMENT_CATEGORIES.has(category) ||
    description.includes("fatura do cartao") ||
    description.includes("fatura cartao")
  );
}

function toExpenseEntries(
  transactions: Transaction[],
  cardTransactions: CardTransaction[],
): ExpenseEntry[] {
  const transactionExpenses = transactions
    .filter(isExpense)
    .filter((transaction) => !isCreditCardPayment(transaction))
    .map((transaction) => ({
      id: transaction.id,
      source: "transaction" as const,
      description: transaction.description,
      category: transaction.category || "other",
      date: transaction.date,
      amount: Math.abs(safeAmount(transaction.amount)),
    }));

  const cardExpenses = cardTransactions.map((transaction) => ({
    id: transaction.id,
    source: "card" as const,
    description: transaction.description,
    category: transaction.category || "other",
    date: transaction.date,
    amount: Math.abs(safeAmount(transaction.amount)),
  }));

  return [...transactionExpenses, ...cardExpenses].filter(
    (expense) => expense.date && expense.amount > 0,
  );
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function percentageChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function buildCategoryTotals(expenses: ExpenseEntry[]): Record<string, number> {
  return expenses.reduce<Record<string, number>>((totals, expense) => {
    const category = expense.category || "other";
    totals[category] = (totals[category] || 0) + expense.amount;
    return totals;
  }, {});
}

function buildMonthSummary(
  range: MonthRange,
  transactions: Transaction[],
  expenses: ExpenseEntry[],
): MonthSummary {
  const monthTransactions = transactions.filter((transaction) =>
    isDateInRange(transaction.date, range),
  );
  const monthExpenses = expenses.filter((expense) =>
    isDateInRange(expense.date, range),
  );

  const income = sum(
    monthTransactions.filter(isIncome).map((transaction) =>
      Math.abs(safeAmount(transaction.amount)),
    ),
  );
  const cashExpense = sum(
    monthTransactions.filter(isExpense).map((transaction) =>
      Math.abs(safeAmount(transaction.amount)),
    ),
  );
  const consumptionExpense = sum(monthExpenses.map((expense) => expense.amount));

  return {
    range,
    income,
    cashExpense,
    cashBalance: income - cashExpense,
    consumptionExpense,
    categoryTotals: buildCategoryTotals(monthExpenses),
  };
}

function buildTopCategories(summary: MonthSummary): CategoryInsight[] {
  if (summary.consumptionExpense === 0) return [];

  return Object.entries(summary.categoryTotals)
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: (amount / summary.consumptionExpense) * 100,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}

function buildHistorySummaries(
  today: Date,
  transactions: Transaction[],
  expenses: ExpenseEntry[],
): MonthSummary[] {
  return Array.from({ length: LOOKBACK_MONTHS }, (_, index) =>
    buildMonthSummary(
      monthRangeFromOffset(today, index + 1),
      transactions,
      expenses,
    ),
  );
}

function buildMonthComparison(
  current: MonthSummary,
  previous: MonthSummary,
): MonthComparison {
  return {
    current,
    previous,
    expenseDifference:
      current.consumptionExpense - previous.consumptionExpense,
    expenseChangePercent: percentageChange(
      current.consumptionExpense,
      previous.consumptionExpense,
    ),
    incomeDifference: current.income - previous.income,
    incomeChangePercent: percentageChange(current.income, previous.income),
    balanceDifference: current.cashBalance - previous.cashBalance,
  };
}

function averageCategoryAmount(
  category: string,
  history: MonthSummary[],
): number {
  if (history.length === 0) return 0;

  return (
    sum(history.map((summary) => summary.categoryTotals[category] || 0)) /
    history.length
  );
}

function buildUnusualSpendings(
  current: MonthSummary,
  history: MonthSummary[],
  currentExpenses: ExpenseEntry[],
): UnusualSpending[] {
  const categoryAnomalies = Object.entries(current.categoryTotals)
    .map(([category, amount]): UnusualSpending | null => {
      const referenceAmount = averageCategoryAmount(category, history);
      const difference = amount - referenceAmount;
      const isNewRelevantCategory =
        referenceAmount === 0 && amount >= MIN_NEW_CATEGORY_AMOUNT;
      const isLargeIncrease =
        referenceAmount > 0 &&
        difference >= MIN_CATEGORY_ANOMALY_AMOUNT &&
        amount >= referenceAmount * 1.5;

      if (!isNewRelevantCategory && !isLargeIncrease) return null;

      return {
        kind: "category" as const,
        label: translateCategory(category),
        amount,
        referenceAmount,
        difference,
        reason:
          referenceAmount === 0
            ? "nao apareceu nos ultimos meses analisados"
            : "ficou acima da media dos ultimos meses",
      };
    })
    .filter((item): item is UnusualSpending => Boolean(item));

  const previousExpenses = history.flatMap((summary) =>
    Object.keys(summary.categoryTotals),
  );
  const categoriesWithHistory = new Set(previousExpenses);

  const transactionAnomalies = currentExpenses
    .filter((expense) => categoriesWithHistory.has(expense.category))
    .map((expense): UnusualSpending | null => {
      const sameCategoryAverage = averageCategoryAmount(
        expense.category,
        history,
      );
      if (
        sameCategoryAverage <= 0 ||
        expense.amount < sameCategoryAverage ||
        expense.amount - sameCategoryAverage < MIN_CATEGORY_ANOMALY_AMOUNT
      ) {
        return null;
      }

      return {
        kind: "transaction" as const,
        label: expense.description,
        amount: expense.amount,
        referenceAmount: sameCategoryAverage,
        difference: expense.amount - sameCategoryAverage,
        reason: `lancamento alto em ${translateCategory(expense.category)}`,
      };
    })
    .filter((item): item is UnusualSpending => Boolean(item));

  return [...categoryAnomalies, ...transactionAnomalies]
    .sort((a, b) => b.difference - a.difference)
    .slice(0, 5);
}

function recurrenceLabel(recurrence: BillAccount["recurrence"]): string {
  if (typeof recurrence === "string") return recurrence;
  return recurrence.type;
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

function normalizeRecurringDescription(description: string): string {
  return normalizeText(description)
    .replace(/\b(parcela|pagamento|assinatura|mensalidade)\b/g, "")
    .replace(/\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildRecurringExpenses(
  today: Date,
  bills: BillAccount[],
  expenses: ExpenseEntry[],
): RecurringExpense[] {
  const recurringBills = bills
    .filter(isRecurringBill)
    .map((bill) => ({
      description: bill.description,
      amount: Math.abs(safeAmount(bill.amount)),
      months: bill.recurrence === "installments" ? bill.installments || 0 : 0,
      source: "bill" as const,
      recurrence: recurrenceLabel(bill.recurrence),
    }))
    .filter((bill) => bill.amount > 0);

  const oldestRange = monthRangeFromOffset(today, RECURRING_LOOKBACK_MONTHS - 1);
  const recentExpenses = expenses.filter(
    (expense) => expense.date >= oldestRange.startDate,
  );

  const grouped = recentExpenses.reduce<
    Record<string, { description: string; amounts: number[]; months: Set<string> }>
  >((groups, expense) => {
    const normalizedDescription = normalizeRecurringDescription(
      expense.description,
    );
    if (!normalizedDescription) return groups;

    const key = `${normalizedDescription}|${expense.category}`;
    if (!groups[key]) {
      groups[key] = {
        description: expense.description,
        amounts: [],
        months: new Set<string>(),
      };
    }

    groups[key].amounts.push(expense.amount);
    groups[key].months.add(expense.date.slice(0, 7));
    return groups;
  }, {});

  const recurringPatterns = Object.values(grouped)
    .filter((group) => group.months.size >= 3)
    .map((group) => ({
      description: group.description,
      amount: sum(group.amounts) / group.amounts.length,
      months: group.months.size,
      source: "pattern" as const,
      recurrence: "padrao mensal",
    }));

  const seenBillDescriptions = new Set(
    recurringBills.map((bill) =>
      normalizeRecurringDescription(bill.description),
    ),
  );

  return [
    ...recurringBills,
    ...recurringPatterns.filter(
      (pattern) =>
        !seenBillDescriptions.has(
          normalizeRecurringDescription(pattern.description),
        ),
    ),
  ]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
}

function buildProjection(
  today: Date,
  current: MonthSummary,
  history: MonthSummary[],
  pendingBills: BillAccount[],
): Projection {
  const todayStr = toDateString(today);
  const pendingBillsToMonthEnd = sum(
    pendingBills
      .filter(
        (bill) =>
          !bill.hiddenFromBills &&
          bill.dueDate >= todayStr &&
          bill.dueDate <= current.range.endDate,
      )
      .map((bill) => Math.abs(safeAmount(bill.amount))),
  );

  const historyWithData = history.filter(
    (summary) =>
      summary.consumptionExpense > 0 || summary.income > 0 || summary.cashExpense > 0,
  );
  const historyMonths = historyWithData.length;
  const averageHistoricalConsumption =
    historyMonths > 0
      ? sum(historyWithData.map((summary) => summary.consumptionExpense)) /
        historyMonths
      : null;
  const elapsedDays = Math.max(1, today.getDate());
  const totalDays = daysInCurrentMonth(today);
  const paceProjection =
    (current.consumptionExpense / elapsedDays) * totalDays;

  const projectedConsumption =
    averageHistoricalConsumption === null
      ? paceProjection
      : elapsedDays < 10
        ? Math.max(current.consumptionExpense, averageHistoricalConsumption)
        : Math.max(current.consumptionExpense, paceProjection);

  const projectedBalance =
    current.income - projectedConsumption - pendingBillsToMonthEnd;
  const budgetReference = current.income > 0 ? current.income : null;

  let budgetStatus =
    "Nao ha receita registrada neste mes para comparar gastos contra renda.";

  if (budgetReference !== null) {
    const projectedRatio = projectedConsumption / budgetReference;
    if (projectedRatio >= 1) {
      budgetStatus =
        "Alerta: a projecao de gastos passa da receita registrada do mes.";
    } else if (projectedRatio >= 0.85) {
      budgetStatus =
        "Atencao: a projecao de gastos esta perto da receita registrada.";
    } else {
      budgetStatus =
        "Dentro da referencia: a projecao fica abaixo da receita registrada.";
    }
  }

  return {
    projectedConsumption,
    projectedBalance,
    pendingBillsToMonthEnd,
    budgetReference,
    budgetStatus,
    historyMonths,
  };
}

function buildSavingsPotential(
  unusualSpendings: UnusualSpending[],
  recurringExpenses: RecurringExpense[],
): SavingsPotential {
  const categoryExcess = sum(
    unusualSpendings
      .filter((item) => item.kind === "category")
      .map((item) => Math.max(0, item.difference)),
  );
  const recurringReview = sum(
    recurringExpenses.map((expense) => Math.max(0, expense.amount)),
  );

  return {
    categoryExcess,
    recurringReview,
    total: categoryExcess + recurringReview,
  };
}

function parseBrazilianNumber(value: string): number | null {
  const sanitized = value.replace(/\s/g, "");

  if (sanitized.includes(",") && sanitized.includes(".")) {
    const parsed = Number(sanitized.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (sanitized.includes(",")) {
    const parsed = Number(sanitized.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (/^\d{1,3}(\.\d{3})+$/.test(sanitized)) {
    const parsed = Number(sanitized.replace(/\./g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractTargetAmount(question: string, explicitAmount?: unknown): number | null {
  if (typeof explicitAmount === "number" && explicitAmount > 0) {
    return explicitAmount;
  }

  if (typeof explicitAmount === "string") {
    const parsed = parseBrazilianNumber(explicitAmount);
    if (parsed && parsed > 0) return parsed;
  }

  const amountMatches = question.matchAll(
    /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:[,.]\d{1,2})?)\s*(?:reais|real|rs)?/gi,
  );

  for (const match of amountMatches) {
    const parsed = parseBrazilianNumber(match[1]);
    if (parsed && parsed > 0) return parsed;
  }

  return null;
}

function liquidInvestmentTotal(investments: Investment[]): number {
  return sum(
    investments
      .filter((investment) => investment.liquidez === "imediata")
      .map((investment) => Math.max(0, safeAmount(investment.balance))),
  );
}

function buildAnalysis(
  question: string,
  transactions: Transaction[],
  cardTransactions: CardTransaction[],
  bills: BillAccount[],
  pendingBills: BillAccount[],
  investments: Investment[],
  targetAmount: number | null,
): FinancialAdviceAnalysis {
  const today = new Date();
  const expenses = toExpenseEntries(transactions, cardTransactions);
  const currentRange = monthRangeFromOffset(today, 0);
  const previousRange = monthRangeFromOffset(today, 1);
  const current = buildMonthSummary(currentRange, transactions, expenses);
  const previous = buildMonthSummary(previousRange, transactions, expenses);
  const history = buildHistorySummaries(today, transactions, expenses);
  const currentExpenses = expenses.filter((expense) =>
    isDateInRange(expense.date, currentRange),
  );
  const unusualSpendings = buildUnusualSpendings(
    current,
    history,
    currentExpenses,
  );
  const recurringExpenses = buildRecurringExpenses(today, bills, expenses);
  const projection = buildProjection(today, current, history, pendingBills);
  const savingsPotential = buildSavingsPotential(
    unusualSpendings,
    recurringExpenses,
  );
  const projectedAvailable = projection.projectedBalance;
  const conservativeAvailable =
    current.cashBalance - projection.pendingBillsToMonthEnd;
  const liquidInvestments = liquidInvestmentTotal(investments);

  return {
    question,
    today: toDateString(today),
    dataPoints: {
      transactions: transactions.length,
      cardTransactions: cardTransactions.length,
      bills: bills.length,
      pendingBills: pendingBills.length,
      investments: investments.length,
    },
    comparison: buildMonthComparison(current, previous),
    topCategories: buildTopCategories(current),
    unusualSpendings,
    recurringExpenses,
    projection,
    savingsPotential,
    purchaseTarget:
      targetAmount && targetAmount > 0
        ? {
            amount: targetAmount,
            conservativeAvailable,
            projectedAvailable,
            liquidInvestments,
          }
        : undefined,
  };
}

function formatPercent(value: number | null): string {
  if (value === null) return "sem base anterior";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatDifference(value: number): string {
  return `${value >= 0 ? "+" : "-"}${formatCurrency(Math.abs(value))}`;
}

function describeMainDiagnosis(analysis: FinancialAdviceAnalysis): string {
  const { current } = analysis.comparison;
  const projectedBalance = analysis.projection.projectedBalance;

  if (current.income === 0 && current.consumptionExpense > 0) {
    return `Voce tem ${formatCurrency(
      current.consumptionExpense,
    )} em gastos de consumo neste mes, mas nenhuma receita registrada no periodo.`;
  }

  if (projectedBalance !== null && projectedBalance < 0) {
    return `Pelos dados atuais, a projecao fecha negativa em ${formatCurrency(
      projectedBalance,
    )}.`;
  }

  if (analysis.comparison.expenseDifference > 0) {
    return `Seus gastos de consumo subiram ${formatDifference(
      analysis.comparison.expenseDifference,
    )} contra o mes passado.`;
  }

  return "Pelos dados registrados, nao apareceu um sinal forte de estouro neste mes.";
}

function formatTopCategories(categories: CategoryInsight[]): string {
  if (categories.length === 0) {
    return "- Sem gastos de consumo registrados neste mes.";
  }

  return categories
    .map(
      (category, index) =>
        `${index + 1}. ${formatCategoryWithEmoji(category.category)}: ${formatCurrency(
          category.amount,
        )} (${category.percentage.toFixed(1)}%)`,
    )
    .join("\n");
}

function formatUnusualSpendings(items: UnusualSpending[]): string {
  if (items.length === 0) {
    return "- Nao encontrei gasto incomum com a base historica disponivel.";
  }

  return items
    .map(
      (item) =>
        `- ${item.label}: ${formatCurrency(item.amount)} (${formatDifference(
          item.difference,
        )} vs referencia de ${formatCurrency(item.referenceAmount)}; ${
          item.reason
        })`,
    )
    .join("\n");
}

function formatRecurringExpenses(items: RecurringExpense[]): string {
  if (items.length === 0) {
    return "- Nao encontrei assinaturas ou recorrencias claras nos dados.";
  }

  return items
    .map(
      (item) =>
        `- ${item.description}: ${formatCurrency(item.amount)} (${
          item.recurrence
        }${item.months ? `, ${item.months} meses/parcelas` : ""})`,
    )
    .join("\n");
}

function formatPurchaseAdvice(
  purchaseTarget: FinancialAdviceAnalysis["purchaseTarget"],
): string | null {
  if (!purchaseTarget) return null;

  const {
    amount,
    conservativeAvailable,
    projectedAvailable,
    liquidInvestments,
  } = purchaseTarget;
  const gap = amount - conservativeAvailable;
  const withLiquidInvestments = conservativeAvailable + liquidInvestments;

  if (conservativeAvailable >= amount) {
    return `Compra de ${formatCurrency(
      amount,
    )}: pelos dados atuais, cabe depois das contas pendentes do mes. Sobra estimada: ${formatCurrency(
      conservativeAvailable - amount,
    )}.`;
  }

  if (projectedAvailable !== null && projectedAvailable >= amount) {
    return `Compra de ${formatCurrency(
      amount,
    )}: pode caber pela projecao do mes, mas no saldo conservador faltam ${formatCurrency(
      Math.max(0, gap),
    )}.`;
  }

  if (withLiquidInvestments >= amount) {
    return `Compra de ${formatCurrency(
      amount,
    )}: no caixa conservador faltam ${formatCurrency(
      Math.max(0, gap),
    )}; com investimentos de liquidez imediata registrados, o total disponivel chegaria a ${formatCurrency(
      withLiquidInvestments,
    )}.`;
  }

  return `Compra de ${formatCurrency(
    amount,
  )}: nao recomendo pelos dados atuais. Depois das contas pendentes, ficam ${formatCurrency(
    conservativeAvailable,
  )}; faltam ${formatCurrency(Math.max(0, gap))}.`;
}

function formatAdvice(analysis: FinancialAdviceAnalysis): string {
  const { comparison, projection, savingsPotential } = analysis;
  const purchaseAdvice = formatPurchaseAdvice(analysis.purchaseTarget);

  const lines = [
    `*Consultoria financeira - ${comparison.current.range.label}*`,
    `Base Firestore: ${analysis.dataPoints.transactions} transacoes, ${analysis.dataPoints.cardTransactions} compras no cartao, ${analysis.dataPoints.bills} contas, ${analysis.dataPoints.investments} investimentos.`,
    "",
    `*Diagnostico:* ${describeMainDiagnosis(analysis)}`,
    "",
    "*Comparacao entre meses:*",
    `- Gastos de consumo: ${formatCurrency(
      comparison.current.consumptionExpense,
    )} agora vs ${formatCurrency(
      comparison.previous.consumptionExpense,
    )} em ${comparison.previous.range.label} (${formatDifference(
      comparison.expenseDifference,
    )}; ${formatPercent(comparison.expenseChangePercent)}).`,
    `- Receitas: ${formatCurrency(
      comparison.current.income,
    )} agora vs ${formatCurrency(comparison.previous.income)} (${formatDifference(
      comparison.incomeDifference,
    )}; ${formatPercent(comparison.incomeChangePercent)}).`,
    `- Saldo de caixa registrado: ${formatCurrency(
      comparison.current.cashBalance,
    )} (${formatDifference(comparison.balanceDifference)} vs mes passado).`,
    "",
    "*Maiores categorias:*",
    formatTopCategories(analysis.topCategories),
    "",
    "*Gastos incomuns:*",
    formatUnusualSpendings(analysis.unusualSpendings),
    "",
    "*Assinaturas e recorrencias:*",
    formatRecurringExpenses(analysis.recurringExpenses),
    "",
    "*Alerta de orcamento:*",
    `- ${projection.budgetStatus}`,
    `- Referencia usada: ${
      projection.budgetReference === null
        ? "sem receita mensal registrada"
        : formatCurrency(projection.budgetReference)
    }. Nao encontrei um orcamento mensal dedicado nos dados consultados.`,
    "",
    "*Projecao e saldo:*",
    `- Gastos de consumo projetados: ${
      projection.projectedConsumption === null
        ? "sem base suficiente"
        : formatCurrency(projection.projectedConsumption)
    }${
      projection.historyMonths > 0
        ? `, usando ${projection.historyMonths} mes(es) de historico recente.`
        : ", usando o ritmo do mes atual."
    }`,
    `- Contas pendentes ate o fim do mes: ${formatCurrency(
      projection.pendingBillsToMonthEnd,
    )}.`,
    `- Previsao de saldo financeiro do mes: ${
      projection.projectedBalance === null
        ? "sem base suficiente"
        : formatCurrency(projection.projectedBalance)
    }.`,
    "",
    "*Economia potencial:*",
    `- Excesso acima da media historica: ${formatCurrency(
      savingsPotential.categoryExcess,
    )}.`,
    `- Recorrencias para revisar: ${formatCurrency(
      savingsPotential.recurringReview,
    )}.`,
    `- Total para revisar sem inventar cortes: ${formatCurrency(
      savingsPotential.total,
    )}.`,
  ];

  if (purchaseAdvice) {
    lines.push("", "*Capacidade de compra:*", `- ${purchaseAdvice}`);
  }

  return lines.join("\n");
}

export async function handleFinancialAdvice(
  userId: string,
  parameters: Record<string, unknown>,
  messageText: string,
): Promise<string> {
  try {
    const question =
      typeof parameters.question === "string" && parameters.question.trim()
        ? parameters.question
        : messageText;
    const targetAmount = extractTargetAmount(
      question,
      parameters.target_amount,
    );

    const [
      transactions,
      cardTransactions,
      bills,
      pendingBills,
      investments,
    ] = await Promise.all([
      getTransactions(userId),
      getCardTransactions(userId),
      getBillAccounts(userId),
      getPendingBills(userId),
      getInvestments(userId),
    ]);

    const analysis = buildAnalysis(
      question,
      transactions,
      cardTransactions,
      bills,
      pendingBills,
      investments,
      targetAmount,
    );

    return formatAdvice(analysis);
  } catch (error) {
    console.error("Erro ao gerar consultoria financeira:", error);
    return "Nao consegui analisar seus dados financeiros agora. Tente novamente em instantes.";
  }
}
