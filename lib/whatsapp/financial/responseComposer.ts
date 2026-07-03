import { formatCurrency } from "../formatters/responseFormatter";
import {
  cardExpenseEntries,
  cashExpenseEntries,
  categoryLabel,
  entriesTotal,
  expenseEntriesForPlan,
  groupByCategory,
  historicalExpenseEntriesForScope,
  incomeEntries,
  lifestyleTotal,
  monthlyTotals,
  recurringInsights,
  safeAmount,
  smallRepeatedInsights,
  sortEntriesByDate,
  unusualCategoryInsights,
  type FinancialEntry,
} from "./analysis";
import type { FinancialDataSet } from "./dataTools";
import type {
  FinancialPlan,
  FinancialResultContext,
  FinancialScope,
} from "./types";

export type ComposedFinancialResponse = {
  reply: string;
  resultContext: FinancialResultContext;
};

function formatDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`;
}

function periodSuffix(plan: FinancialPlan): string {
  const card = plan.scope === "card"
    ? plan.cardName
      ? ` no cartao ${plan.cardName}`
      : " nos cartoes"
    : "";
  return card ? `${card} em ${plan.period.label}` : `em ${plan.period.label}`;
}

function scopeLabel(scope: FinancialScope, cardName?: string): string {
  if (scope === "card") {
    return cardName ? `cartao ${cardName}` : "cartoes";
  }

  if (scope === "cash") return "despesas fora do cartao";
  return "geral";
}

function noDataMessage(plan: FinancialPlan, subject: string): string {
  return `Nao encontrei dados de ${subject} em ${plan.period.label}.`;
}

function resultContext(
  plan: FinancialPlan,
  itemType: FinancialResultContext["itemType"],
  total?: number,
  listedCount?: number,
): FinancialResultContext {
  return {
    itemType,
    total,
    listedCount,
    period: plan.period,
    scope: plan.scope,
    cardName: plan.cardName,
  };
}

function composeDirect(plan: FinancialPlan, data: FinancialDataSet) {
  const expenses = expenseEntriesForPlan(data, plan);
  const incomes = incomeEntries(data.transactions);

  if (plan.goal === "category_ranking") {
    const total = entriesTotal(expenses);
    const [topCategory] = groupByCategory(expenses);

    if (!topCategory || total === 0) {
      return {
        reply: noDataMessage(plan, "gastos"),
        resultContext: resultContext(plan, "category", 0),
      };
    }

    return {
      reply: `Em ${plan.period.label}, sua maior categoria foi ${topCategory.label}, com ${formatCurrency(topCategory.amount)}, representando ${formatPercent(topCategory.percentage)} dos gastos.`,
      resultContext: resultContext(plan, "category", topCategory.amount),
    };
  }

  if (plan.goal === "income_total") {
    const total = entriesTotal(incomes);
    const reply =
      total > 0
        ? `Voce ganhou ${formatCurrency(total)} em ${plan.period.label}.`
        : noDataMessage(plan, "receitas");

    return {
      reply,
      resultContext: resultContext(plan, "income", total),
    };
  }

  if (plan.goal === "expense_total") {
    const total = entriesTotal(expenses);
    const reply =
      total > 0
        ? `Voce gastou ${formatCurrency(total)} ${periodSuffix(plan)}.`
        : noDataMessage(plan, "gastos");

    return {
      reply,
      resultContext: resultContext(
        plan,
        plan.scope === "card" ? "card_expense" : "expense",
        total,
      ),
    };
  }

  if (plan.goal === "largest_expense") {
    const [largest] = [...expenses].sort((a, b) => b.amount - a.amount);

    if (!largest) {
      return {
        reply: noDataMessage(plan, "gastos"),
        resultContext: resultContext(plan, "expense", 0),
      };
    }

    const source =
      largest.source === "card" && largest.cardName
        ? ` no cartao ${largest.cardName}`
        : "";

    return {
      reply: `Seu maior gasto em ${plan.period.label} foi ${largest.description}, de ${formatCurrency(largest.amount)}${source}, em ${formatDate(largest.date)}.`,
      resultContext: resultContext(plan, "expense", largest.amount),
    };
  }

  const incomeTotal = entriesTotal(incomes);
  const expenseTotal = entriesTotal(expenses);
  const balance = incomeTotal - expenseTotal;

  return {
    reply: `Em ${plan.period.label}, suas receitas foram ${formatCurrency(incomeTotal)}, seus gastos foram ${formatCurrency(expenseTotal)} e o saldo ficou em ${formatCurrency(balance)}.`,
    resultContext: resultContext(plan, "summary", balance),
  };
}

function formatEntryLine(entry: FinancialEntry, index: number): string {
  const source =
    entry.source === "card" && entry.cardName ? ` - ${entry.cardName}` : "";
  const sign = entry.type === "income" ? "+" : "-";

  return `${index + 1}. ${entry.description}: ${sign}${formatCurrency(entry.amount)} - ${formatDate(entry.date)} - ${categoryLabel(entry.category)}${source}`;
}

function entriesForList(plan: FinancialPlan, data: FinancialDataSet): FinancialEntry[] {
  if (plan.goal === "income_listing" || plan.filters?.transactionType === "income") {
    return incomeEntries(data.transactions);
  }

  if (plan.filters?.transactionType === "expense" || plan.scope === "card") {
    return expenseEntriesForPlan(data, plan);
  }

  return [
    ...incomeEntries(data.transactions),
    ...expenseEntriesForPlan(data, plan),
  ];
}

function composeList(plan: FinancialPlan, data: FinancialDataSet) {
  const entries = sortEntriesByDate(entriesForList(plan, data));
  const limit = plan.filters?.limit || (plan.goal === "income_listing" ? 20 : 10);
  const visibleEntries = entries.slice(0, limit);
  const total = entriesTotal(entries);

  if (entries.length === 0) {
    const subject = plan.goal === "income_listing" ? "receitas" : "transacoes";
    return {
      reply: noDataMessage(plan, subject),
      resultContext: resultContext(
        plan,
        plan.goal === "income_listing" ? "income" : "expense",
        0,
        0,
      ),
    };
  }

  const title =
    plan.goal === "income_listing"
      ? `Ganhos - ${plan.period.label}`
      : `Transacoes - ${plan.period.label} (${scopeLabel(plan.scope, plan.cardName)})`;
  const lines = [
    `*${title}*`,
    `Total: ${formatCurrency(total)} em ${entries.length} item(ns).`,
    "",
    ...visibleEntries.map(formatEntryLine),
  ];

  if (entries.length > visibleEntries.length) {
    lines.push(`... e mais ${entries.length - visibleEntries.length} item(ns).`);
  }

  return {
    reply: lines.join("\n"),
    resultContext: resultContext(
      plan,
      plan.goal === "income_listing" ? "income" : plan.scope === "card" ? "card_expense" : "expense",
      total,
      entries.length,
    ),
  };
}

function billsTotal(data: FinancialDataSet): number {
  return data.bills.reduce((total, bill) => total + Math.abs(safeAmount(bill.amount)), 0);
}

function investmentsTotal(data: FinancialDataSet): number {
  return data.investments.reduce(
    (total, investment) => total + Math.max(0, safeAmount(investment.balance)),
    0,
  );
}

function appendTopCategories(lines: string[], entries: FinancialEntry[]) {
  const categories = groupByCategory(entries).slice(0, 5);

  lines.push("", "*Principais categorias:*");

  if (categories.length === 0) {
    lines.push("Nao encontrei gastos categorizados nesse periodo.");
    return;
  }

  categories.forEach((category, index) => {
    lines.push(
      `${index + 1}. ${category.label}: ${formatCurrency(category.amount)} (${formatPercent(category.percentage)})`,
    );
  });
}

function composeCardSummary(plan: FinancialPlan, data: FinancialDataSet) {
  const expenses = expenseEntriesForPlan(data, plan);
  const total = entriesTotal(expenses);
  const lines = [
    `*Gastos do ${scopeLabel("card", plan.cardName)} - ${plan.period.label}*`,
  ];

  if (total === 0) {
    lines.push(noDataMessage(plan, "gastos de cartao"));
    return {
      reply: lines.join("\n"),
      resultContext: resultContext(plan, "card_expense", 0),
    };
  }

  lines.push(
    `Total: ${formatCurrency(total)} em ${expenses.length} compra(s).`,
  );
  appendTopCategories(lines, expenses);

  const latest = sortEntriesByDate(expenses).slice(0, 5);
  lines.push("", "*Ultimas compras:*");
  latest.forEach((entry, index) => lines.push(formatEntryLine(entry, index)));

  return {
    reply: lines.join("\n"),
    resultContext: resultContext(plan, "card_expense", total, expenses.length),
  };
}

function composeFinancialSummary(plan: FinancialPlan, data: FinancialDataSet) {
  if (plan.scope === "card") {
    return composeCardSummary(plan, data);
  }

  const incomes = incomeEntries(data.transactions);
  const cashExpenses = cashExpenseEntries(data.transactions);
  const cardExpenses = cardExpenseEntries(data.cardTransactions);
  const expenses = expenseEntriesForPlan(data, plan);
  const incomeTotal = entriesTotal(incomes);
  const cashExpenseTotal = entriesTotal(cashExpenses);
  const cardExpenseTotal = entriesTotal(cardExpenses);
  const expenseTotal = entriesTotal(expenses);
  const balance = incomeTotal - expenseTotal;
  const billTotal = billsTotal(data);
  const investmentTotal = investmentsTotal(data);

  const lines = [
    `*Resumo financeiro - ${plan.period.label}*`,
    `Periodo: ${formatDate(plan.period.startDate)} a ${formatDate(plan.period.endDate)}`,
    "",
    `Receitas: ${incomeTotal > 0 ? formatCurrency(incomeTotal) : "nao encontrei receitas"}`,
    `Despesas: ${expenseTotal > 0 ? formatCurrency(expenseTotal) : "nao encontrei despesas"}`,
    `Saldo do periodo: ${formatCurrency(balance)}`,
    "",
    `Cartoes: ${cardExpenseTotal > 0 ? formatCurrency(cardExpenseTotal) : "nao encontrei gastos de cartao nesse periodo"}`,
    `Despesas fora do cartao: ${cashExpenseTotal > 0 ? formatCurrency(cashExpenseTotal) : "nao encontrei despesas fora do cartao"}`,
    `Contas: ${billTotal > 0 ? `${formatCurrency(billTotal)} em ${data.bills.length} conta(s)` : "nao encontrei contas nesse periodo"}`,
    `Investimentos: ${investmentTotal > 0 ? formatCurrency(investmentTotal) : "nao encontrei investimentos cadastrados"}`,
  ];

  appendTopCategories(lines, expenses);

  return {
    reply: lines.join("\n"),
    resultContext: resultContext(plan, "summary", balance),
  };
}

function composeYearSummary(plan: FinancialPlan, data: FinancialDataSet) {
  const summary = composeFinancialSummary(plan, data);
  const incomes = incomeEntries(data.transactions);
  const expenses = expenseEntriesForPlan(data, plan);
  const monthly = monthlyTotals(incomes, expenses);
  const highestExpenseMonth = [...monthly].sort(
    (a, b) => b.expenses - a.expenses,
  )[0];
  const bestBalanceMonth = [...monthly].sort((a, b) => b.balance - a.balance)[0];
  const extraLines = ["", "*Destaques do ano:*"];

  if (highestExpenseMonth) {
    extraLines.push(
      `Maior mes de gastos: ${highestExpenseMonth.month} com ${formatCurrency(highestExpenseMonth.expenses)}.`,
    );
  }

  if (bestBalanceMonth) {
    extraLines.push(
      `Melhor saldo mensal: ${bestBalanceMonth.month} com ${formatCurrency(bestBalanceMonth.balance)}.`,
    );
  }

  if (!highestExpenseMonth && !bestBalanceMonth) {
    extraLines.push("Nao encontrei meses com dados suficientes para comparar.");
  }

  return {
    reply: `${summary.reply}${extraLines.join("\n")}`,
    resultContext: resultContext(
      plan,
      "summary",
      summary.resultContext.total,
    ),
  };
}

function composeSavingAdvice(plan: FinancialPlan, data: FinancialDataSet) {
  const currentExpenses = expenseEntriesForPlan(data, plan);
  const previousExpenses = [
    ...cashExpenseEntries(data.previousTransactions),
    ...cardExpenseEntries(data.previousCardTransactions, plan.cardName),
  ];
  const historicalExpenses = historicalExpenseEntriesForScope(
    data,
    plan.scope,
    plan.cardName,
  );
  const recurring = recurringInsights(
    data.allBills,
    historicalExpenses,
    plan.period,
  );
  const unusual = unusualCategoryInsights(currentExpenses, previousExpenses);
  const repeated = smallRepeatedInsights(currentExpenses);
  const food = lifestyleTotal(currentExpenses, "food");
  const leisure = lifestyleTotal(currentExpenses, "leisure");
  const transport = lifestyleTotal(currentExpenses, "transport");
  const subscriptions = lifestyleTotal(currentExpenses, "subscriptions");
  const variableCategories = groupByCategory(currentExpenses)
    .filter((item) => item.category !== "fixes")
    .slice(0, 3);
  const lines = [`*Onde economizar - ${plan.period.label}*`];

  if (currentExpenses.length === 0) {
    lines.push(noDataMessage(plan, "gastos"));
    return {
      reply: lines.join("\n"),
      resultContext: resultContext(plan, "expense", 0),
    };
  }

  lines.push("", "Voce pode comecar revisando:");

  const suggestions: string[] = [];
  const recurringTotal = recurring.reduce((total, item) => total + item.amount, 0);
  if (recurringTotal > 0) {
    const topRecurring = recurring
      .slice(0, 3)
      .map((item) => `${item.label} (${formatCurrency(item.amount)})`)
      .join(", ");
    suggestions.push(
      `Recorrencias: ${formatCurrency(recurringTotal)} mapeados. Principais: ${topRecurring}.`,
    );
  }

  if (food > 0) {
    suggestions.push(`Alimentacao/delivery: ${formatCurrency(food)} no periodo.`);
  }

  if (leisure > 0) {
    suggestions.push(`Lazer: ${formatCurrency(leisure)} no periodo.`);
  }

  if (transport > 0) {
    suggestions.push(`Transporte: ${formatCurrency(transport)} no periodo.`);
  }

  if (subscriptions > 0) {
    suggestions.push(`Assinaturas/mensalidades: ${formatCurrency(subscriptions)} no periodo.`);
  }

  if (unusual.length > 0) {
    const top = unusual[0];
    suggestions.push(
      `${top.label} cresceu ${formatCurrency(top.difference)} vs ${data.comparisonPeriod.label}. Total atual: ${formatCurrency(top.amount)}.`,
    );
  }

  if (repeated.length > 0) {
    const top = repeated[0];
    suggestions.push(
      `Compras pequenas repetidas: ${top.label} apareceu ${top.count} vezes, somando ${formatCurrency(top.total)}.`,
    );
  }

  if (suggestions.length === 0 && variableCategories.length > 0) {
    variableCategories.forEach((category) => {
      suggestions.push(
        `${category.label}: ${formatCurrency(category.amount)} (${formatPercent(category.percentage)} dos gastos).`,
      );
    });
  }

  suggestions.slice(0, 5).forEach((suggestion, index) => {
    lines.push(`${index + 1}. ${suggestion}`);
  });

  lines.push(
    "",
    "Proxima acao util: montar uma meta mensal em cima dessas categorias.",
  );

  return {
    reply: lines.join("\n"),
    resultContext: resultContext(plan, "expense", entriesTotal(currentExpenses)),
  };
}

export function composeFinancialResponse(
  plan: FinancialPlan,
  data: FinancialDataSet,
): ComposedFinancialResponse {
  if (plan.needsClarification) {
    return {
      reply:
        plan.clarificationQuestion ||
        "Pode me dizer um pouco melhor o que voce quer consultar?",
      resultContext: resultContext(plan, "summary"),
    };
  }

  if (plan.responseLevel === "direct") return composeDirect(plan, data);
  if (plan.responseLevel === "list") return composeList(plan, data);
  if (plan.responseLevel === "consulting") return composeSavingAdvice(plan, data);
  if (plan.goal === "year_summary") return composeYearSummary(plan, data);
  if (plan.goal === "card_expenses") return composeCardSummary(plan, data);
  return composeFinancialSummary(plan, data);
}
