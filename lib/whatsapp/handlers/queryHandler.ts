import { IntentType } from "../intents/intentTypes";
import {
  getTransactionsByPeriod,
} from "@/lib/services/admin/transactionsAdmin";
import { getCardInvoiceAmount } from "@/lib/services/admin/userCreditCardsAdmin";
import {
  getPendingBills,
  getUpcomingBills,
} from "@/lib/services/admin/billAccountsAdmin";
import { getInvestments } from "@/lib/services/admin/investmentsAdmin";
import {
  formatExpensesSummary,
  formatIncomeSummary,
  formatBalanceSummary,
  formatCardInvoice,
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
        return "❌ Não consegui processar sua consulta.";
    }
  } catch (error) {
    console.error("Erro ao processar consulta:", error);
    return "❌ Ocorreu um erro ao processar sua consulta. Tente novamente.";
  }
}

async function handleExpensesQuery(
  userId: string,
  parameters: Record<string, any>
): Promise<string> {
  const period = parameters.period || "month";
  const { startDate, endDate } = getPeriodDates(period);

  const transactions = await getTransactionsByPeriod(userId, startDate, endDate);

  return formatExpensesSummary(transactions, getPeriodLabel(period));
}

async function handleIncomeQuery(
  userId: string,
  parameters: Record<string, any>
): Promise<string> {
  const period = parameters.period || "month";
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

  return formatBalanceSummary(transactions, getPeriodLabel(period));
}

async function handleCardInvoiceQuery(
  userId: string,
  parameters: Record<string, any>
): Promise<string> {
  const cardName = parameters.card;

  if (!cardName) {
    return "❌ Por favor, especifique qual cartão você quer consultar (ex: Nubank, Inter, PicPay).";
  }

  const today = new Date();
  const month = parameters.month || today.getMonth() + 1;
  const year = parameters.year || today.getFullYear();

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
