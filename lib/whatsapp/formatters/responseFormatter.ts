import { Transaction } from "@/lib/services/admin/transactionsAdmin";
import { CardTransaction } from "@/lib/services/admin/cardTransactionsAdmin";
import { BillAccount } from "@/lib/services/admin/billAccountsAdmin";
import { Investment } from "@/lib/services/admin/investmentsAdmin";
import { formatDate } from "../utils/dateParser";

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatTransactionsList(
  transactions: Transaction[],
  limit?: number
): string {
  if (transactions.length === 0) {
    return "Nenhuma transação encontrada.";
  }

  const items = limit ? transactions.slice(0, limit) : transactions;
  let response = `📋 *Transações* (${transactions.length} encontrada${transactions.length > 1 ? "s" : ""})\n\n`;

  items.forEach((t, index) => {
    const emoji = t.type === "income" ? "💰" : "💸";
    response += `${emoji} *${t.description}*\n`;
    response += `   ${formatCurrency(t.amount)} • ${formatDate(t.date)}\n`;
    response += `   Categoria: ${translateCategory(t.category)}\n\n`;
  });

  if (limit && transactions.length > limit) {
    response += `_... e mais ${transactions.length - limit} transações_`;
  }

  return response;
}

export function formatExpensesSummary(
  transactions: Transaction[],
  period: string
): string {
  const expenses = transactions.filter((t) => t.type === "expense");
  const total = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  if (expenses.length === 0) {
    return `📊 Você não teve gastos no período: ${period}`;
  }

  const byCategory: Record<string, number> = {};
  expenses.forEach((t) => {
    const cat = t.category || "other";
    byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount);
  });

  let response = `💸 *Gastos - ${period}*\n\n`;
  response += `💰 *Total: ${formatCurrency(total)}*\n\n`;
  response += `📊 *Por Categoria:*\n`;

  Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, amount]) => {
      const percentage = ((amount / total) * 100).toFixed(1);
      response += `• ${translateCategory(cat)}: ${formatCurrency(amount)} (${percentage}%)\n`;
    });

  return response;
}

export function formatIncomeSummary(
  transactions: Transaction[],
  period: string
): string {
  const incomes = transactions.filter((t) => t.type === "income");
  const total = incomes.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  if (incomes.length === 0) {
    return `📊 Você não teve receitas no período: ${period}`;
  }

  const byCategory: Record<string, number> = {};
  incomes.forEach((t) => {
    const cat = t.category || "other";
    byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount);
  });

  let response = `💰 *Receitas - ${period}*\n\n`;
  response += `✅ *Total: ${formatCurrency(total)}*\n\n`;
  response += `📊 *Por Categoria:*\n`;

  Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, amount]) => {
      response += `• ${translateCategory(cat)}: ${formatCurrency(amount)}\n`;
    });

  return response;
}

export function formatBalanceSummary(
  transactions: Transaction[],
  period: string
): string {
  const incomes = transactions.filter((t) => t.type === "income");
  const expenses = transactions.filter((t) => t.type === "expense");

  const totalIncome = incomes.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const totalExpense = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  const balance = totalIncome - totalExpense;

  const emoji = balance >= 0 ? "✅" : "⚠️";

  let response = `${emoji} *Resumo Financeiro - ${period}*\n\n`;
  response += `💰 Receitas: ${formatCurrency(totalIncome)}\n`;
  response += `💸 Despesas: ${formatCurrency(totalExpense)}\n`;
  response += `━━━━━━━━━━━━━━━━\n`;
  response += `${emoji} *Saldo: ${formatCurrency(balance)}*\n`;

  return response;
}

export function formatCardInvoice(
  cardName: string,
  amount: number,
  month: number,
  year: number
): string {
  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
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

  const emoji = amount > 0 ? "💳" : "✅";
  const status = amount > 0 ? "a pagar" : "paga";

  return `${emoji} *Fatura ${cardName}*\n\n📅 ${monthNames[month - 1]}/${year}\n💰 Valor ${status}: ${formatCurrency(amount)}`;
}

export function formatBillsList(bills: BillAccount[]): string {
  if (bills.length === 0) {
    return "✅ Você não tem contas pendentes!";
  }

  let response = `📋 *Contas a Pagar* (${bills.length})\n\n`;

  bills
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .forEach((bill) => {
      const daysUntil = Math.ceil(
        (new Date(bill.dueDate).getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const urgency = daysUntil <= 3 ? "🔴" : daysUntil <= 7 ? "🟡" : "🟢";

      response += `${urgency} *${bill.description}*\n`;
      response += `   ${formatCurrency(bill.amount)}\n`;
      response += `   Vencimento: ${formatDate(bill.dueDate)}`;

      if (daysUntil === 0) {
        response += ` *(HOJE)*`;
      } else if (daysUntil === 1) {
        response += ` *(AMANHÃ)*`;
      } else if (daysUntil > 0) {
        response += ` (${daysUntil} dias)`;
      } else {
        response += ` *(VENCIDA)*`;
      }

      response += `\n\n`;
    });

  return response;
}

export function formatInvestmentsSummary(investments: Investment[]): string {
  if (investments.length === 0) {
    return "📊 Você ainda não tem investimentos cadastrados.";
  }

  const totalBalance = investments.reduce((sum, inv) => sum + inv.balance, 0);
  const totalYield = investments.reduce(
    (sum, inv) => sum + (inv.total_yield || 0),
    0
  );

  let response = `💎 *Seus Investimentos*\n\n`;
  response += `💰 *Total Investido: ${formatCurrency(totalBalance)}*\n`;
  response += `📈 *Rendimento Total: ${formatCurrency(totalYield)}*\n\n`;
  response += `📊 *Por Categoria:*\n\n`;

  investments.forEach((inv) => {
    const yieldPercentage =
      inv.balance > 0 ? ((inv.total_yield / inv.balance) * 100).toFixed(2) : "0";
    response += `• *${translateCategory(inv.category)}*\n`;
    response += `  Saldo: ${formatCurrency(inv.balance)}\n`;
    response += `  Rendimento: ${formatCurrency(inv.total_yield || 0)} (+${yieldPercentage}%)\n`;
    response += `  Liquidez: ${inv.liquidez === "imediata" ? "Imediata" : "Longo Prazo"}\n\n`;
  });

  return response;
}

export function formatDeleteConfirmation(
  items: (Transaction | CardTransaction)[],
  type: "transaction" | "card"
): string {
  if (items.length === 0) {
    return "❌ Nenhuma transação encontrada com essa descrição nos últimos 30 dias.";
  }

  if (items.length === 1) {
    const item = items[0];
    return `🗑️ *Confirmar exclusão?*\n\n📝 ${item.description}\n💰 ${formatCurrency(item.amount)}\n📅 ${formatDate(item.date)}\n\n_Responda "sim" para confirmar ou "não" para cancelar._`;
  }

  let response = `🔍 Encontrei ${items.length} transações:\n\n`;
  items.forEach((item, index) => {
    response += `${index + 1}. ${item.description} - ${formatCurrency(item.amount)} (${formatDate(item.date)})\n`;
  });
  response += `\n_Qual você deseja deletar? Responda com o número._`;

  return response;
}

export function formatHelpMessage(): string {
  return `🤖 *Assistente Financeiro B-Finances*

Eu posso te ajudar com:

📝 *Adicionar*
• "Gastei 50 reais com pizza"
• "Recebi meu salário de 3000"
• "Comprei com cartão Nubank"

📊 *Consultar*
• "Quanto gastei esse mês?"
• "Gastos com comida"
• "Fatura do cartão Nubank"
• "Próximas contas"
• "Meus investimentos"
• "Resumo financeiro"

🗑️ *Deletar*
• "Deletar gasto com pizza"
• "Remover compra do cartão"

💰 *Pagar*
• "Pagar conta de luz"
• "Paguei fatura do cartão Nubank"

🔔 *Notificações*
• "Desativar alertas"
• "Ativar notificações"

_Fale naturalmente comigo! 😊_`;
}

function translateCategory(category: string): string {
  const categoryMap: Record<string, string> = {
    salary: "Salário",
    extra: "Extra",
    other: "Outros",
    fixes: "Fixas",
    foods: "Alimentação",
    entertainment: "Lazer",
    cdb: "CDB",
    imoveis: "Imóveis",
    cripto: "Cripto",
    acoes: "Ações",
    fundos: "Fundos",
  };

  return categoryMap[category] || category;
}
