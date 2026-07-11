import { Transaction } from "@/lib/services/admin/transactionsAdmin";
import { CardTransaction } from "@/lib/services/admin/cardTransactionsAdmin";
import { BillAccount } from "@/lib/services/admin/billAccountsAdmin";
import { Investment } from "@/lib/services/admin/investmentsAdmin";
import { formatDate } from "../utils/dateParser";
import {
  formatCategoryWithEmoji,
  getCategoryLabel,
} from "@/lib/whatsapp/categories";


export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}


export function formatTransactionList(
  transactions: Transaction[],
  type: "expense" | "income",
  label: string
): string {
  if (transactions.length === 0) {
    return type === "expense"
      ? `💸 Nenhum gasto encontrado para: ${label}`
      : `💰 Nenhuma receita encontrada para: ${label}`;
  }

  const emoji = type === "expense" ? "💸" : "💰";
  let response = `${emoji} *${label}*\n\n`;

  transactions.forEach((t, i) => {
    const sign = type === "expense" ? "-" : "+";
    response += `${i + 1}. *${t.description}*\n`;
    response += `   ${sign} ${formatCurrency(Math.abs(t.amount))}\n`;
    response += `   📅 ${formatDate(t.date)}\n`;
    if (t.category) {
      response += `   🏷️ ${getCategoryLabel(t.category)}\n`;
    }
    response += "\n";
  });

  return response.trimEnd();
}


export function formatExpensesSummary(
  transactions: Transaction[],
  period: string
): string {
  const expenses = transactions.filter((t) => t.type === "expense");
  const total = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);

  if (expenses.length === 0) {
    return `📊 Você não teve gastos em: *${period}*`;
  }

  const byCategory: Record<string, number> = {};
  expenses.forEach((t) => {
    const cat = t.category || "other";
    byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount);
  });

  let response = `💸 *Gastos — ${period}*\n\n`;
  response += `💰 *Total: ${formatCurrency(total)}*\n\n`;
  response += `📊 *Por Categoria:*\n`;

  Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, amount]) => {
      const percentage = ((amount / total) * 100).toFixed(1);
      response += `• ${formatCategoryWithEmoji(cat)}: ${formatCurrency(amount)} (${percentage}%)\n`;
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
    return `📊 Você não teve receitas em: *${period}*`;
  }

  const byCategory: Record<string, number> = {};
  incomes.forEach((t) => {
    const cat = t.category || "other";
    byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount);
  });

  let response = `💰 *Receitas — ${period}*\n\n`;
  response += `✅ *Total: ${formatCurrency(total)}*\n\n`;
  response += `📊 *Por Categoria:*\n`;

  Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, amount]) => {
      response += `• ${formatCategoryWithEmoji(cat)}: ${formatCurrency(amount)}\n`;
    });

  return response;
}

export function formatDetailedBalance(
  transactions: Transaction[],
  prevTransactions: Transaction[],
  pendingBills: BillAccount[],
  period: string
): string {
  const incomes = transactions.filter((t) => t.type === "income");
  const expenses = transactions.filter((t) => t.type === "expense");

  const totalIncome = incomes.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalExpense = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const balance = totalIncome - totalExpense;

  const prevIncome = prevTransactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const prevExpense = prevTransactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Math.abs(t.amount), 0);

  const incomeChange =
    prevIncome > 0 ? ((totalIncome - prevIncome) / prevIncome) * 100 : null;
  const expenseChange =
    prevExpense > 0
      ? ((totalExpense - prevExpense) / prevExpense) * 100
      : null;

  const balanceEmoji = balance >= 0 ? "✅" : "⚠️";
  const incomeArrow =
    incomeChange === null ? "" : incomeChange >= 0 ? "📈" : "📉";
  const expenseArrow =
    expenseChange === null ? "" : expenseChange >= 0 ? "📈" : "📉";

  let response = `${balanceEmoji} *Resumo Financeiro — ${period}*\n\n`;

  response += `━━━━━━━━━━━━━━━━\n`;
  response += `💵 *Saldo do mês: ${formatCurrency(balance)}*\n`;
  response += `━━━━━━━━━━━━━━━━\n\n`;

  response += `💰 *Receitas: ${formatCurrency(totalIncome)}*`;
  if (incomeChange !== null) {
    response += ` ${incomeArrow} ${incomeChange >= 0 ? "+" : ""}${incomeChange.toFixed(1)}% vs mês anterior`;
  }
  response += `\n`;

  const incomeByCategory: Record<string, number> = {};
  incomes.forEach((t) => {
    const cat = t.category || "other";
    incomeByCategory[cat] = (incomeByCategory[cat] || 0) + Math.abs(t.amount);
  });
  Object.entries(incomeByCategory)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, amount]) => {
      const pct = totalIncome > 0 ? ((amount / totalIncome) * 100).toFixed(0) : 0;
      response += `  • ${formatCategoryWithEmoji(cat)}: ${formatCurrency(amount)} (${pct}%)\n`;
    });

  response += `\n`;

  response += `💸 *Despesas: ${formatCurrency(totalExpense)}*`;
  if (expenseChange !== null) {
    response += ` ${expenseArrow} ${expenseChange >= 0 ? "+" : ""}${expenseChange.toFixed(1)}% vs mês anterior`;
  }
  response += `\n`;

  const expenseByCategory: Record<string, number> = {};
  expenses.forEach((t) => {
    const cat = t.category || "other";
    expenseByCategory[cat] =
      (expenseByCategory[cat] || 0) + Math.abs(t.amount);
  });
  Object.entries(expenseByCategory)
    .sort(([, a], [, b]) => b - a)
    .forEach(([cat, amount]) => {
      const pct =
        totalExpense > 0
          ? ((amount / totalExpense) * 100).toFixed(0)
          : 0;
      response += `  • ${formatCategoryWithEmoji(cat)}: ${formatCurrency(amount)} (${pct}%)\n`;
    });

  response += `\n`;

  if (pendingBills.length > 0) {
    const totalBills = pendingBills.reduce((s, b) => s + b.amount, 0);
    response += `📋 *Contas a pagar: ${formatCurrency(totalBills)}* (${pendingBills.length} conta${pendingBills.length > 1 ? "s" : ""})\n`;
    pendingBills
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5)
      .forEach((b) => {
        const daysUntil = Math.ceil(
          (new Date(b.dueDate).getTime() - Date.now()) / 86400000
        );
        const urgency = daysUntil <= 3 ? "🔴" : daysUntil <= 7 ? "🟡" : "🟢";
        response += `  ${urgency} ${b.description}: ${formatCurrency(b.amount)} (${formatDate(b.dueDate)})\n`;
      });
    if (pendingBills.length > 5) {
      response += `  _... e mais ${pendingBills.length - 5} conta${pendingBills.length - 5 > 1 ? "s" : ""}_\n`;
    }
  } else {
    response += `✅ *Nenhuma conta pendente!*\n`;
  }

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
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
  ];

  const emoji = amount > 0 ? "💳" : "✅";
  const status = amount > 0 ? "a pagar" : "paga";

  return `${emoji} *Fatura ${cardName}*\n\n📅 ${monthNames[month - 1]}/${year}\n💰 Valor ${status}: ${formatCurrency(amount)}`;
}

export function formatAllCardInvoices(
  invoices: { cardName: string; amount: number }[],
  month: number,
  year: number
): string {
  const monthNames = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro",
  ];

  if (invoices.length === 0) {
    return `✅ *Nenhuma fatura em aberto* para ${monthNames[month - 1]}/${year}!`;
  }

  const total = invoices.reduce((s, i) => s + i.amount, 0);
  let response = `💳 *Faturas em aberto — ${monthNames[month - 1]}/${year}*\n\n`;

  invoices
    .sort((a, b) => b.amount - a.amount)
    .forEach((inv) => {
      response += `• *${inv.cardName}*: ${formatCurrency(inv.amount)}\n`;
    });

  response += `\n💰 *Total: ${formatCurrency(total)}*`;

  return response;
}

// ─── Bills ────────────────────────────────────────────────────────────────────

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

// ─── Investments ──────────────────────────────────────────────────────────────

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
    response += `• *${formatCategoryWithEmoji(inv.category)}*\n`;
    response += `  Saldo: ${formatCurrency(inv.balance)}\n`;
    response += `  Rendimento: ${formatCurrency(inv.total_yield || 0)} (+${yieldPercentage}%)\n`;
    response += `  Liquidez: ${inv.liquidez === "imediata" ? "Imediata" : "Longo Prazo"}\n\n`;
  });

  return response;
}

// ─── Delete Confirmation ──────────────────────────────────────────────────────

export function formatDeleteConfirmation(
  items: (Transaction | CardTransaction)[]
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
• "Liste meus últimos 5 gastos"
• "Últimos 3 lucros"
• "Gastos com alimentação"
• "Gastos no cartão Inter"
• "Quais minhas faturas em aberto?"
• "Fatura do cartão Nubank"
• "Próximas contas"
• "Meus investimentos"
• "Resumo financeiro do mês"

🧭 *Consultoria*
• "Estou gastando muito?"
• "Onde posso economizar?"
• "Por que meu saldo caiu?"
• "Consigo comprar um notebook de 5000 reais?"
• "Quais meus gastos incomuns?"

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

export function formatTransactionsList(
  transactions: Transaction[],
  limit?: number
): string {
  const items = limit ? transactions.slice(0, limit) : transactions;
  if (items.length === 0) return "Nenhuma transação encontrada.";

  let response = `📋 *Transações* (${transactions.length} encontrada${transactions.length > 1 ? "s" : ""})\n\n`;

  items.forEach((t) => {
    const emoji = t.type === "income" ? "💰" : "💸";
    response += `${emoji} *${t.description}*\n`;
    response += `   ${formatCurrency(t.amount)} • ${formatDate(t.date)}\n`;
    response += `   Categoria: ${getCategoryLabel(t.category)}\n\n`;
  });

  if (limit && transactions.length > limit) {
    response += `_... e mais ${transactions.length - limit} transações_`;
  }

  return response;
}
