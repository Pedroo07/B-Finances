import {
  getTransactions,
  getTransactionsByPeriod,
  type Transaction,
} from "@/lib/services/admin/transactionsAdmin";
import {
  getCardTransactions,
  getCardTransactionsByCard,
  type CardTransaction,
} from "@/lib/services/admin/cardTransactionsAdmin";
import {
  getBillAccounts,
  type BillAccount,
} from "@/lib/services/admin/billAccountsAdmin";
import {
  getInvestments,
  type Investment,
} from "@/lib/services/admin/investmentsAdmin";
import {
  previousComparablePeriod,
} from "./periodResolver";
import type { FinancialPlan, ResolvedPeriod } from "./types";

export type FinancialDataSet = {
  period: ResolvedPeriod;
  comparisonPeriod: ResolvedPeriod;
  transactions: Transaction[];
  cardTransactions: CardTransaction[];
  bills: BillAccount[];
  allBills: BillAccount[];
  investments: Investment[];
  previousTransactions: Transaction[];
  previousCardTransactions: CardTransaction[];
  historicalTransactions: Transaction[];
  historicalCardTransactions: CardTransaction[];
  toolsExecuted: string[];
};

function isInPeriod(date: string | undefined, period: ResolvedPeriod): boolean {
  return Boolean(date && date >= period.startDate && date <= period.endDate);
}

function needsHistoricalData(plan: FinancialPlan): boolean {
  return plan.requiredCapabilities.some((capability) =>
    [
      "recurring_expenses",
      "unusual_expenses",
      "monthly_comparison",
      "yearly_totals",
    ].includes(capability),
  );
}

function needsTransactions(plan: FinancialPlan): boolean {
  return plan.requiredCapabilities.some((capability) =>
    [
      "income",
      "expenses",
      "balance",
      "list_items",
      "group_by_category",
      "recurring_expenses",
      "unusual_expenses",
      "monthly_comparison",
      "yearly_totals",
    ].includes(capability),
  );
}

function needsCardTransactions(plan: FinancialPlan): boolean {
  return plan.requiredCapabilities.some((capability) =>
    [
      "card_expenses",
      "group_by_category",
      "list_items",
      "recurring_expenses",
      "unusual_expenses",
      "monthly_comparison",
      "yearly_totals",
    ].includes(capability),
  );
}

function needsBills(plan: FinancialPlan): boolean {
  return plan.requiredCapabilities.some((capability) =>
    ["bills", "recurring_expenses", "balance"].includes(capability),
  );
}

function needsInvestments(plan: FinancialPlan): boolean {
  return plan.requiredCapabilities.includes("investments");
}

export async function executeFinancialCapabilities(
  userId: string,
  plan: FinancialPlan,
): Promise<FinancialDataSet> {
  const comparisonPeriod = previousComparablePeriod(plan.period);
  const useHistoricalData = needsHistoricalData(plan);
  const toolsExecuted: string[] = [];

  const transactionsPromise = needsTransactions(plan)
    ? useHistoricalData
      ? getTransactions(userId).then((items) => {
          toolsExecuted.push("transactionsAdmin.getTransactions");
          return items;
        })
      : getTransactionsByPeriod(
          userId,
          plan.period.startDate,
          plan.period.endDate,
        ).then((items) => {
          toolsExecuted.push("transactionsAdmin.getTransactionsByPeriod");
          return items;
        })
    : Promise.resolve([] as Transaction[]);

  const cardTransactionsPromise = needsCardTransactions(plan)
    ? plan.cardName && !useHistoricalData
      ? getCardTransactionsByCard(
          userId,
          plan.cardName,
          plan.period.startDate,
          plan.period.endDate,
        ).then((items) => {
          toolsExecuted.push("cardTransactionsAdmin.getCardTransactionsByCard");
          return items;
        })
      : getCardTransactions(userId).then((items) => {
          toolsExecuted.push("cardTransactionsAdmin.getCardTransactions");
          return items;
        })
    : Promise.resolve([] as CardTransaction[]);

  const billsPromise = needsBills(plan)
    ? getBillAccounts(userId).then((items) => {
        toolsExecuted.push("billAccountsAdmin.getBillAccounts");
        return items;
      })
    : Promise.resolve([] as BillAccount[]);

  const investmentsPromise = needsInvestments(plan)
    ? getInvestments(userId).then((items) => {
        toolsExecuted.push("investmentsAdmin.getInvestments");
        return items;
      })
    : Promise.resolve([] as Investment[]);

  const [
    rawTransactions,
    rawCardTransactions,
    rawBills,
    investments,
  ] = await Promise.all([
    transactionsPromise,
    cardTransactionsPromise,
    billsPromise,
    investmentsPromise,
  ]);

  const periodTransactions = useHistoricalData
    ? rawTransactions.filter((transaction) => isInPeriod(transaction.date, plan.period))
    : rawTransactions;
  const previousTransactions = rawTransactions.filter((transaction) =>
    isInPeriod(transaction.date, comparisonPeriod),
  );

  const periodCardTransactions = useHistoricalData || !plan.cardName
    ? rawCardTransactions.filter(
        (transaction) =>
          isInPeriod(transaction.date, plan.period) &&
          (!plan.cardName || transaction.card === plan.cardName),
      )
    : rawCardTransactions;
  const previousCardTransactions = rawCardTransactions.filter(
    (transaction) =>
      isInPeriod(transaction.date, comparisonPeriod) &&
      (!plan.cardName || transaction.card === plan.cardName),
  );

  const bills = rawBills.filter(
    (bill) => !bill.hiddenFromBills && isInPeriod(bill.dueDate, plan.period),
  );

  return {
    period: plan.period,
    comparisonPeriod,
    transactions: periodTransactions,
    cardTransactions: periodCardTransactions,
    bills,
    allBills: rawBills.filter((bill) => !bill.hiddenFromBills),
    investments,
    previousTransactions,
    previousCardTransactions,
    historicalTransactions: rawTransactions,
    historicalCardTransactions: rawCardTransactions,
    toolsExecuted,
  };
}
