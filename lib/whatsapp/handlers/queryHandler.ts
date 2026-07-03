import { IntentType } from "../intents/intentTypes";
import {
  getTransactionsByPeriod,
  getRecentTransactions,
} from "@/lib/services/admin/transactionsAdmin";
import {
  getCardInvoiceAmount,
  getAllCardInvoices,
} from "@/lib/services/admin/userCreditCardsAdmin";
import {
  getPendingBills,
  getUpcomingBills,
} from "@/lib/services/admin/billAccountsAdmin";
import { getInvestments } from "@/lib/services/admin/investmentsAdmin";
import {
  formatTransactionList,
  formatExpensesSummary,
  formatIncomeSummary,
  formatDetailedBalance,
  formatCardInvoice,
  formatAllCardInvoices,
  formatBillsList,
  formatInvestmentsSummary,
} from "../formatters/responseFormatter";
import { getPeriodDates } from "../utils/dateParser";

export async function handleQuery(
  userId: string,
  intent: IntentType,
  parameters: Record<string, any>
): Promise<string> {
  try {
    switch (intent) {
      case IntentType.QUERY_EXPENSES:
        return await handleExpensesQuery(userId, parameters);

      case IntentType.QUERY_INCOME:
        return await handleIncomeQuery(userId, parameters);

      case IntentType.QUERY_BALANCE:
        return await handleBalanceQuery(userId, parameters);

      case IntentType.QUERY_CARD_INVOICE:
        return await handleCardInvoiceQuery(userId, parameters);

      case IntentType.QUERY_BILLS:
        return await handleBillsQuery(userId, parameters);

      case IntentType.QUERY_INVESTMENTS:
        return await handleInvestmentsQuery(userId);

      default:
        return "Erro: Não consegui processar sua consulta.";
    }
  } catch (error) {
    console.error("Erro ao processar consulta:", error);
    return "Erro: Ocorreu um erro ao processar sua consulta. Tente novamente.";
  }
}



async function handleExpensesQuery(
  userId: string,
  parameters: Record<string, any>
): Promise<string> {
  const period = parameters.period || "month";
  const limit: number | undefined = parameters.limit
    ? Number(parameters.limit)
    : undefined;
  const categoryFilter: string | undefined = parameters.category_filter;
  const cardFilter: string | undefined = parameters.card_filter;

  if (limit) {
    const { startDate, endDate } = getPeriodDates(period);
    const transactions = await getRecentTransactions(
      userId,
      limit,
      "expense",
      categoryFilter,
      startDate,
      endDate
    );
    const label = buildExpenseLabel(limit, categoryFilter, cardFilter, period);
    return formatTransactionList(transactions, "expense", label);
  }

  if (cardFilter) {
    return await handleCardExpensesQuery(userId, cardFilter, parameters);
  }

  if (categoryFilter) {
    const { startDate, endDate } = getPeriodDates(period);
    const transactions = await getRecentTransactions(
      userId,
      100,
      "expense",
      categoryFilter,
      startDate,
      endDate
    );
    return formatExpensesSummary(
      transactions,
      `${getPeriodLabel(period)} - categoria: ${categoryFilter}`
    );
  }

  const { startDate, endDate } = getPeriodDates(period);
  const transactions = await getTransactionsByPeriod(userId, startDate, endDate);
  return formatExpensesSummary(transactions, getPeriodLabel(period));
}

async function handleCardExpensesQuery(
  userId: string,
  cardFilter: string,
  parameters: Record<string, any>
): Promise<string> {
  const { getCardTransactionsByCard } = await import(
    "@/lib/services/admin/cardTransactionsAdmin"
  );
  const today = new Date();
  const period = parameters.period || "month";
  const { startDate, endDate } = getPeriodDates(period);
  const transactions = await getCardTransactionsByCard(
    userId,
    cardFilter,
    startDate,
    endDate
  );
  if (transactions.length === 0) {
    return `Cartão: Nenhum gasto encontrado no cartão *${cardFilter}* em ${getPeriodLabel(period)}.`;
  }
  const total = transactions.reduce((s, t) => s + Math.abs(t.amount), 0);
  const { formatCurrency } = await import("../formatters/responseFormatter");
  let resp = `Cartão: *Gastos no cartão ${cardFilter} - ${getPeriodLabel(period)}*\n\n`;
  resp += `Valor: *Total: ${formatCurrency(total)}*\n\n`;
  transactions
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((t) => {
      resp += `- *${t.description}*\n  ${formatCurrency(Math.abs(t.amount))} - ${t.date}\n\n`;
    });
  return resp;
}


async function handleIncomeQuery(
  userId: string,
  parameters: Record<string, any>
): Promise<string> {
  const period = parameters.period || "month";
  const limit: number | undefined = parameters.limit
    ? Number(parameters.limit)
    : undefined;

  if (limit) {
    const { startDate, endDate } = getPeriodDates(period);
    const transactions = await getRecentTransactions(
      userId,
      limit,
      "income",
      undefined,
      startDate,
      endDate
    );
    return formatTransactionList(
      transactions,
      "income",
      `Últimos ${limit} recebimentos`
    );
  }

  const { startDate, endDate } = getPeriodDates(period);
  const transactions = await getTransactionsByPeriod(userId, startDate, endDate);
  return formatIncomeSummary(transactions, getPeriodLabel(period));
}

async function handleBalanceQuery(
  userId: string,
  parameters: Record<string, any>
): Promise<string> {
  const period = parameters.period || "month";
  const { startDate, endDate } = getPeriodDates(period);

  const transactions = await getTransactionsByPeriod(userId, startDate, endDate);

  const { startDate: prevStart, endDate: prevEnd } = getPeriodDates("last_month");
  const prevTransactions = await getTransactionsByPeriod(userId, prevStart, prevEnd);
  const pendingBills = await getPendingBills(userId);

  return formatDetailedBalance(
    transactions,
    prevTransactions,
    pendingBills,
    getPeriodLabel(period)
  );
}


async function handleCardInvoiceQuery(
  userId: string,
  parameters: Record<string, any>
): Promise<string> {
  const today = new Date();
  const month = parameters.month || today.getMonth() + 1;
  const year = parameters.year || today.getFullYear();


  if (parameters.all_invoices || !parameters.card) {
    const invoices = await getAllCardInvoices(userId, year, month);
    return formatAllCardInvoices(invoices, month, year);
  }


  const cardName = parameters.card;
  const amount = await getCardInvoiceAmount(userId, cardName, year, month);
  return formatCardInvoice(cardName, amount, month, year);
}


async function handleBillsQuery(
  userId: string,
  parameters: Record<string, any>
): Promise<string> {
  const days = parameters.days || 30;

  let bills;
  if (days <= 7) {
    bills = await getUpcomingBills(userId, days);
  } else {
    bills = await getPendingBills(userId);
  }

  return formatBillsList(bills);
}


async function handleInvestmentsQuery(userId: string): Promise<string> {
  const investments = await getInvestments(userId);
  return formatInvestmentsSummary(investments);
}


function getPeriodLabel(period: string): string {
  const labels: Record<string, string> = {
    today: "Hoje",
    week: "Esta Semana",
    month: "Este Mês",
    year: "Este Ano",
    last_month: "Mês Passado",
  };
  return labels[period] || "Período Selecionado";
}

function buildExpenseLabel(
  limit: number,
  category?: string,
  card?: string,
  period?: string
): string {
  let label = `Últimos ${limit} gastos`;
  if (category) label += ` (${category})`;
  if (card) label += ` no ${card}`;
  return label;
}
