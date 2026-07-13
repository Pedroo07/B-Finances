import type {
  BFinanceCommandResult,
  BFinancePeriod,
  CommandBillItem,
  CommandInvestmentItem,
  CommandTransactionItem,
} from "./types";
import { formatCategoryWithEmoji } from "@/lib/whatsapp/categories";

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  if (!year || !month || !day) return date;
  return `${day}/${month}/${year}`;
}

function formatPeriod(period: BFinancePeriod): string {
  if (period.type === "all") return "todo o período";
  if (period.type === "current_invoice" && !period.startDate) return "fatura atual";
  if (period.type === "today") return "hoje";
  if (period.type === "yesterday") return "ontem";

  if (period.month && period.year) {
    return `${MONTH_NAMES[period.month - 1]}/${period.year}`;
  }

  if (period.year && period.type === "current_year") return String(period.year);
  if (period.year && period.type === "specific_year") return String(period.year);

  if (period.startDate && period.endDate) {
    return `${formatDate(period.startDate)} a ${formatDate(period.endDate)}`;
  }

  return "período selecionado";
}

function getOrigin(item: CommandTransactionItem): string {
  if (item.source === "card_transaction") {
    return item.cardName ? `Cartão ${item.cardName}` : "Cartão";
  }

  if (item.type === "income") return "Receita";
  if (item.paymentMethod === "pix") return "Pix";
  if (item.paymentMethod === "debit") return "Débito";
  if (item.paymentMethod === "cash") return "Dinheiro";
  return "Transação";
}

function formatTransactionLine(
  item: CommandTransactionItem,
  index: number,
): string {
  const amount = item.type === "income" ? Math.abs(item.amount) : -Math.abs(item.amount);
  if (item.source === "card_transaction") {
    return `${index + 1}. ${formatDate(item.date)} - ${item.description} - ${formatCurrency(amount)} - ${formatCategoryWithEmoji(item.category)}`;
  }

  return `${index + 1}. ${formatDate(item.date)} - ${item.description} - ${formatCurrency(amount)} - ${formatCategoryWithEmoji(item.category)} - ${getOrigin(item)}`;
}

function formatNoData(): string {
  return "Não encontrei dados para esse período.";
}

function formatTransactionList(result: Extract<BFinanceCommandResult, { kind: "transaction_list" }>): string {
  if (result.items.length === 0) return formatNoData();

  const lines = result.items.map(formatTransactionLine);
  const totalLine =
    result.command.transactionType === "income"
      ? `Total de receitas: ${formatCurrency(result.totals.income)}`
      : result.command.transactionType === "expense"
        ? `Total de despesas: ${formatCurrency(result.totals.expense)}`
        : `Saldo dos itens: ${formatCurrency(result.totals.balance)}`;

  return [
    `📋 *${result.title} - ${formatPeriod(result.period)}*`,
    `💰 ${totalLine}`,
    "",
    ...lines,
  ].join("\n");
}

function formatTransactionTotal(result: Extract<BFinanceCommandResult, { kind: "transaction_total" }>): string {
  if (result.items.length === 0) return formatNoData();

  const period = formatPeriod(result.period);

  if (result.command.transactionType === "income") {
    return `Você recebeu ${formatCurrency(result.totals.income)} em ${period}.`;
  }

  if (result.command.transactionType === "all") {
    return `Em ${period}, você recebeu ${formatCurrency(result.totals.income)} e gastou ${formatCurrency(result.totals.expense)}. Saldo: ${formatCurrency(result.totals.balance)}.`;
  }

  if (
    result.command.scope?.includeCardTransactions &&
    !result.command.scope.includeNormalTransactions
  ) {
    const cardLabel = result.command.scope.cardName
      ? ` no cartão ${result.command.scope.cardName}`
      : " no cartão";
    return `Você gastou ${formatCurrency(result.totals.cardExpense)}${cardLabel} em ${period}.`;
  }

  return `Você gastou ${formatCurrency(result.totals.expense)} em ${period}.`;
}

function formatBillLine(bill: CommandBillItem): string {
  return `${bill.description} - ${formatCurrency(bill.amount)} - vence em ${formatDate(bill.dueDate)}`;
}

function formatInvestmentLine(investment: CommandInvestmentItem): string {
  return `${investment.category}: ${formatCurrency(investment.balance)} (rendimentos ${formatCurrency(investment.totalYield)})`;
}

function formatFinancialSummary(result: Extract<BFinanceCommandResult, { kind: "financial_summary" }>): string {
  const pendingBillsTotal = result.pendingBills.reduce(
    (sum, bill) => sum + bill.amount,
    0,
  );
  const investmentTotal = result.investments.reduce(
    (sum, investment) => sum + investment.balance,
    0,
  );

  const lines = [
    `Resumo financeiro - ${formatPeriod(result.period)}`,
    `Receitas: ${formatCurrency(result.totals.income)}`,
    `Despesas normais: ${formatCurrency(result.totals.normalExpense)}`,
    `Despesas de cartão: ${formatCurrency(result.totals.cardExpense)}`,
    `Saldo: ${formatCurrency(result.totals.balance)}`,
    `Contas pendentes: ${formatCurrency(pendingBillsTotal)} (${result.pendingBills.length})`,
    `Investimentos: ${formatCurrency(investmentTotal)}`,
  ];

  if (result.pendingBills.length > 0) {
    lines.push("");
    lines.push("Próximas contas:");
    lines.push(...result.pendingBills.slice(0, 5).map(formatBillLine));
  }

  if (result.investments.length > 0) {
    lines.push("");
    lines.push("Investimentos:");
    lines.push(...result.investments.slice(0, 5).map(formatInvestmentLine));
  }

  return lines.join("\n");
}

function formatInvoiceSummary(result: Extract<BFinanceCommandResult, { kind: "invoice_summary" }>): string {
  if (result.invoices.length === 0 || result.total <= 0.01) {
    return `Não encontrei faturas em aberto para ${formatPeriod(result.period)}.`;
  }

  if (result.invoices.length === 1) {
    const invoice = result.invoices[0];
    return `Fatura do ${invoice.cardName} em ${formatPeriod(result.period)}: ${formatCurrency(invoice.amount)}.`;
  }

  const lines = [
    `Faturas - ${formatPeriod(result.period)}`,
    `Total: ${formatCurrency(result.total)}`,
    "",
    ...result.invoices
      .sort((a, b) => b.amount - a.amount)
      .map((invoice) => `${invoice.cardName}: ${formatCurrency(invoice.amount)}`),
  ];

  return lines.join("\n");
}

function formatCategoryRanking(result: Extract<BFinanceCommandResult, { kind: "category_ranking" }>): string {
  if (result.rankings.length === 0) return formatNoData();

  return [
    `📊 *${result.title} - ${formatPeriod(result.period)}*`,
    `💰 Total: ${formatCurrency(result.total)}`,
    "",
    ...result.rankings.map((item, index) => {
      const percentage =
        result.total > 0 ? ` (${((item.total / result.total) * 100).toFixed(1)}%)` : "";
      return `${index + 1}. ${formatCategoryWithEmoji(item.label)} - ${formatCurrency(item.total)} - ${item.count} item(ns)${percentage}`;
    }),
  ].join("\n");
}

function formatBillList(result: Extract<BFinanceCommandResult, { kind: "bill_list" }>): string {
  if (result.bills.length === 0) {
    return "Você não tem contas pendentes.";
  }

  return [
    `Contas a pagar - total ${formatCurrency(result.total)}`,
    "",
    ...result.bills
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .map(formatBillLine),
  ].join("\n");
}

function formatInvestments(result: Extract<BFinanceCommandResult, { kind: "investment_summary" }>): string {
  if (result.investments.length === 0) {
    return "Você ainda não tem investimentos cadastrados.";
  }

  return [
    `Investimentos: ${formatCurrency(result.totalBalance)}`,
    `Rendimentos: ${formatCurrency(result.totalYield)}`,
    "",
    ...result.investments.map(formatInvestmentLine),
  ].join("\n");
}

function formatCreated(result: Extract<BFinanceCommandResult, { kind: "transaction_created" }>): string {
  const item = result.item;
  const typeLabel = item.type === "income" ? "Receita" : "Despesa";
  const origin = getOrigin(item);
  const amount = item.installmentCount && item.installmentCount > 1 && item.totalAmount
    ? item.totalAmount
    : Math.abs(item.amount);
  const installmentLine = item.installmentCount && item.installmentCount > 1
    ? `📆 ${item.installmentCount}x de ${formatCurrency(Math.abs(item.amount))}`
    : null;
  return [
    `✅ *${typeLabel} adicionada*`,
    `${formatCategoryWithEmoji(item.category)} · ${item.description}`,
    `💰 ${formatCurrency(amount)} · ${formatDate(item.date)}`,
    installmentLine,
    origin,
  ].filter(Boolean).join("\n");
}

export function formatBFinanceResponse(result: BFinanceCommandResult): string {
  if (!result.success) return result.message;

  switch (result.kind) {
    case "transaction_list":
      return formatTransactionList(result);
    case "transaction_total":
      return formatTransactionTotal(result);
    case "financial_summary":
      return formatFinancialSummary(result);
    case "invoice_summary":
      return formatInvoiceSummary(result);
    case "category_ranking":
      return formatCategoryRanking(result);
    case "bill_list":
      return formatBillList(result);
    case "investment_summary":
      return formatInvestments(result);
    case "transaction_created":
      return formatCreated(result);
    case "ready_message":
      return result.message;
    default:
      return "Não consegui montar a resposta final.";
  }
}
