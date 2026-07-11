import {
  AVAILABLE_FINANCIAL_CAPABILITIES,
  capabilitiesForPlan,
} from "./capabilities";
import { findCreditCardNameInText } from "@/lib/creditCards/catalog";
import { resolveFinancialPeriod } from "./periodResolver";
import { CATEGORY_ALIASES } from "@/lib/whatsapp/categories";
import type {
  FinancialEngineInput,
  FinancialFilters,
  FinancialGoal,
  FinancialMemoryContext,
  FinancialPlan,
  FinancialPlannerInput,
  FinancialResultContext,
  FinancialScope,
  ResponseLevel,
  ResolvedPeriod,
} from "./types";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function hasAny(normalized: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(normalized));
}

function hasAmount(normalized: string): boolean {
  return /\b(?:r\$\s*)?\d+(?:[.,]\d{1,2})?\b/.test(normalized);
}

function isMutationRequest(normalized: string): boolean {
  if (/\b(deletar|delete|excluir|exclua|remover|remova)\b/.test(normalized)) {
    return true;
  }

  if (/\b(ativar|desativar)\b.*\b(alertas?|notificacoes?)\b/.test(normalized)) {
    return true;
  }

  const hasQuestionIntent =
    /\b(quanto|qual|quais|onde|como|por que|porque|resumo|liste|listar|mostre|analise|consulta|consultar)\b/.test(
      normalized,
    );

  if (
    !hasQuestionIntent &&
    hasAmount(normalized) &&
    /\b(gastei|comprei|paguei|recebi|ganhei|adicione|adicionar|cadastre|lancei)\b/.test(
      normalized,
    )
  ) {
    return true;
  }

  if (
    !hasQuestionIntent &&
    /\b(pagar|pague|paguei)\b.*\b(conta|boleto|fatura)\b/.test(normalized)
  ) {
    return true;
  }

  if (
    !hasQuestionIntent &&
    /\b(resgatar|resgate|aplicar|investir)\b/.test(normalized)
  ) {
    return true;
  }

  return false;
}

function extractCardName(messageText: string): string | undefined {
  return findCreditCardNameInText(messageText) ?? undefined;
}

function extractLimit(normalized: string): number | undefined {
  const match =
    normalized.match(/\bultim[oa]s?\s+(\d{1,2})\b/) ||
    normalized.match(/\blist[ae]?\s+(?:meus|minhas)?\s*(\d{1,2})\b/) ||
    normalized.match(/\b(\d{1,2})\s+(?:gastos|ganhos|receitas|transacoes)\b/);

  if (!match) return undefined;

  const limit = Number(match[1]);
  return Number.isFinite(limit) && limit > 0 ? Math.min(limit, 50) : undefined;
}

function extractCategory(normalized: string): string | undefined {
  return CATEGORY_ALIASES.find((item) =>
    item.terms.some((term) => new RegExp(`\\b${term}\\b`).test(normalized)),
  )?.category;
}

function latestFinancialMemory(
  input: FinancialPlannerInput,
): FinancialMemoryContext | undefined {
  const turns = input.shortTermMemory?.turns || [];

  for (const turn of [...turns].reverse()) {
    const rawPlan = turn.parameters.financialPlan;
    const rawResultContext = turn.parameters.financialResultContext;

    if (turn.toolName === "financial_engine" && rawPlan) {
      return {
        turn,
        plan: rawPlan as FinancialPlan,
        resultContext: rawResultContext as FinancialResultContext | undefined,
      };
    }

    if (turn.toolName === "query_transactions") {
      const type = turn.parameters.type;
      const period = resolveFinancialPeriod({
        messageText:
          typeof turn.parameters.period === "string"
            ? turn.parameters.period
            : "",
        currentDate: input.currentDate,
      });
      const goal = type === "income" ? "income_listing" : "transaction_listing";
      const scope = turn.parameters.card_filter ? "card" : "full_finances";

      return {
        turn,
        plan: buildPlan({
          goal,
          period,
          scope,
          responseLevel: "list",
          cardName:
            typeof turn.parameters.card_filter === "string"
              ? turn.parameters.card_filter
              : undefined,
          filters: {
            transactionType: type === "income" ? "income" : "expense",
          },
          isContinuation: true,
        }),
        resultContext: {
          itemType: type === "income" ? "income" : "expense",
          period,
          scope,
          cardName:
            typeof turn.parameters.card_filter === "string"
              ? turn.parameters.card_filter
              : undefined,
        },
      };
    }
  }

  return undefined;
}

function isContinuation(normalized: string): boolean {
  return (
    /^(e|agora|tambem|do|da|dos|das|no|na|nos|nas|nao)\b/.test(normalized) ||
    /^(liste|lista|listar|mostre)\s*(os|as|eles|elas)?$/.test(normalized) ||
    /\b(liste-os|lista-os|mostre-os|nao do cartao|do geral|mes passado|ano todo)\b/.test(
      normalized,
    )
  );
}

function isFinancialCandidate(normalized: string): boolean {
  return hasAny(normalized, [
    /\b(resumo|balanco|financas|financeiro)\b/,
    /\b(gastos?|despesas?|compras?|receitas?|ganhos?|saldo)\b/,
    /\b(categoria|categorias|economizar|economia|consultoria|analise)\b/,
    /\b(cartao|cartoes|credito)\b/,
    /\b(transacoes|lancamentos)\b/,
  ]) || findCreditCardNameInText(normalized) !== null;
}

function detectScope(
  normalized: string,
  cardName: string | undefined,
  goal: FinancialGoal,
  previousScope?: FinancialScope,
): FinancialScope {
  if (/\b(nao do cartao|do geral|geral|financas|financeiro|tudo|todos)\b/.test(normalized)) {
    return "full_finances";
  }

  if (
    cardName ||
    /\b(cartao|cartoes|credito)\b/.test(normalized) ||
    (previousScope === "card" && !/\b(geral|financas|financeiro)\b/.test(normalized))
  ) {
    return "card";
  }

  if (goal === "financial_summary" || goal === "year_summary") {
    return "full_finances";
  }

  return previousScope || "full_finances";
}

function classifyGoal(
  normalized: string,
  period: ResolvedPeriod,
  scope: FinancialScope,
): FinancialGoal | null {
  if (
    hasAny(normalized, [
      /\bonde posso economizar\b/,
      /\beconomizar\b/,
      /\bestou gastando muito\b/,
      /\bgastando muito\b/,
      /\bpor que meu saldo caiu\b/,
      /\banalise completa\b/,
      /\bconsultoria\b/,
      /\bsugestoes?\b/,
    ])
  ) {
    return "saving_advice";
  }

  if (
    hasAny(normalized, [
      /\bcom qual categoria\b/,
      /\bcategoria.*\b(gastei mais|maior|mais gastei)\b/,
      /\b(gastei mais|maior gasto).*\bcategoria\b/,
      /\bmaiores categorias\b/,
      /\branking\b/,
    ])
  ) {
    return "category_ranking";
  }

  if (
    hasAny(normalized, [
      /\bliste?\b.*\b(ganhos?|receitas?|entradas?)\b/,
      /\bmostre\b.*\b(ganhos?|receitas?|entradas?)\b/,
      /\bultim[oa]s?\b.*\b(ganhos?|receitas?|entradas?)\b/,
    ])
  ) {
    return "income_listing";
  }

  if (
    hasAny(normalized, [
      /\bliste?\b.*\b(gastos?|despesas?|compras?|transacoes?)\b/,
      /\bmostre\b.*\b(gastos?|despesas?|compras?|transacoes?)\b/,
      /\bultim[oa]s?\b.*\b(gastos?|despesas?|compras?|transacoes?)\b/,
    ])
  ) {
    return "transaction_listing";
  }

  if (
    hasAny(normalized, [
      /\bmaior gasto\b/,
      /\bmaior despesa\b/,
      /\bmaior compra\b/,
      /\bqual foi meu maior\b/,
    ])
  ) {
    return "largest_expense";
  }

  if (hasAny(normalized, [/\bquanto\b.*\b(ganhei|recebi|receita|receitas|entrada)\b/])) {
    return "income_total";
  }

  if (hasAny(normalized, [/\bquanto\b.*\b(gastei|gasto|despesa|despesas)\b/])) {
    return "expense_total";
  }

  if (scope === "card" && hasAny(normalized, [/\b(gastos?|compras?|despesas?)\b/])) {
    return "card_expenses";
  }

  if (hasAny(normalized, [/\bsaldo\b/])) {
    return "balance";
  }

  if (hasAny(normalized, [/\bresumo financeiro\b/, /\bcomo estao minhas financas\b/, /\bminhas financas\b/, /\bcomo foi meu mes\b/, /\bbalanco do mes\b/])) {
    return period.type === "current_year" ||
      period.type === "specific_year" ||
      period.type === "last_year"
      ? "year_summary"
      : "financial_summary";
  }

  if (
    hasAny(normalized, [/\bresumo\b/, /\bbalanco\b/]) &&
    (period.type === "current_year" ||
      period.type === "specific_year" ||
      period.type === "last_year")
  ) {
    return "year_summary";
  }

  return null;
}

function responseLevelForGoal(
  goal: FinancialGoal,
  normalized: string,
): ResponseLevel {
  if (goal === "saving_advice") return "consulting";
  if (goal === "income_listing" || goal === "transaction_listing") return "list";
  if (
    goal === "category_ranking" ||
    goal === "income_total" ||
    goal === "expense_total" ||
    goal === "largest_expense"
  ) {
    return "direct";
  }
  if (/\b(liste|listar|mostre|ultim[oa]s)\b/.test(normalized)) return "list";
  return "summary";
}

function filtersForGoal(
  goal: FinancialGoal,
  normalized: string,
): FinancialFilters | undefined {
  const filters: FinancialFilters = {};
  const limit = extractLimit(normalized);
  const category = extractCategory(normalized);

  if (limit) filters.limit = limit;
  if (category) filters.category = category;

  if (goal === "income_listing" || goal === "income_total") {
    filters.transactionType = "income";
  }

  if (
    goal === "transaction_listing" ||
    goal === "expense_total" ||
    goal === "largest_expense" ||
    goal === "card_expenses"
  ) {
    filters.transactionType = "expense";
  }

  return Object.keys(filters).length > 0 ? filters : undefined;
}

function buildPlan(input: {
  goal: FinancialGoal;
  period: ResolvedPeriod;
  scope: FinancialScope;
  responseLevel: ResponseLevel;
  cardName?: string;
  filters?: FinancialFilters;
  isContinuation?: boolean;
  correctedScope?: boolean;
  previousGoal?: FinancialGoal;
}): FinancialPlan {
  return {
    goal: input.goal,
    period: input.period,
    scope: input.scope,
    responseLevel: input.responseLevel,
    requiredCapabilities: capabilitiesForPlan(input.goal, input.scope),
    needsClarification: false,
    clarificationQuestion: null,
    cardName: input.cardName,
    filters: input.filters,
    context: {
      isContinuation: Boolean(input.isContinuation),
      correctedScope: input.correctedScope,
      previousGoal: input.previousGoal,
    },
  };
}

function goalForListContinuation(
  resultContext: FinancialResultContext | undefined,
  previousPlan: FinancialPlan,
): FinancialGoal {
  if (resultContext?.itemType === "income") return "income_listing";
  if (
    resultContext?.itemType === "expense" ||
    resultContext?.itemType === "card_expense"
  ) {
    return "transaction_listing";
  }
  if (previousPlan.goal === "income_total") return "income_listing";
  return "transaction_listing";
}

function buildContinuationPlan(
  input: FinancialPlannerInput,
  memory: FinancialMemoryContext,
): FinancialPlan | null {
  if (!memory.plan) return null;

  const normalized = normalizeText(input.messageText);
  const listContinuation =
    /^(liste|lista|listar|mostre)\s*(os|as|eles|elas)?$/.test(normalized) ||
    /\b(liste-os|lista-os|mostre-os)\b/.test(normalized);
  const correctedScope = /\b(nao do cartao|do geral|geral)\b/.test(normalized);
  const period = resolveFinancialPeriod({
    messageText: input.messageText,
    currentDate: input.currentDate,
    fallbackPeriod: memory.plan.period,
  });
  const cardName = extractCardName(input.messageText) || memory.plan.cardName;
  let goal = listContinuation
    ? goalForListContinuation(memory.resultContext, memory.plan)
    : memory.plan.goal;
  let responseLevel: ResponseLevel = listContinuation
    ? "list"
    : memory.plan.responseLevel;
  let scope = detectScope(normalized, cardName, goal, memory.plan.scope);

  if (correctedScope && memory.plan.scope === "card") {
    scope = "full_finances";
    if (memory.plan.goal === "card_expenses") {
      goal = "expense_total";
      responseLevel = "summary";
    }
  }

  const filters: FinancialFilters = {
    ...memory.plan.filters,
    ...filtersForGoal(goal, normalized),
  };

  if (goal === "income_listing") {
    filters.transactionType = "income";
  }

  if (goal === "transaction_listing" && !filters.transactionType) {
    filters.transactionType =
      memory.resultContext?.itemType === "income" ? "income" : "expense";
  }

  return buildPlan({
    goal,
    period,
    scope,
    responseLevel,
    cardName: scope === "card" ? cardName : undefined,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    isContinuation: true,
    correctedScope,
    previousGoal: memory.plan.goal,
  });
}

export function planFinancialResponse(
  input: FinancialEngineInput | FinancialPlannerInput,
): FinancialPlan | null {
  const normalized = normalizeText(input.messageText);
  const memory = latestFinancialMemory(input);

  if (isMutationRequest(normalized)) {
    return null;
  }

  if (memory && isContinuation(normalized)) {
    const continuationPlan = buildContinuationPlan(input, memory);
    if (continuationPlan) return continuationPlan;
  }

  if (!isFinancialCandidate(normalized)) {
    return null;
  }

  if (/\bfatura\b/.test(normalized) && !/\b(gastos?|compras?|liste|listar|mostre)\b/.test(normalized)) {
    return null;
  }

  const period = resolveFinancialPeriod({
    messageText: input.messageText,
    currentDate: input.currentDate,
  });
  const cardName = extractCardName(input.messageText);
  const provisionalScope =
    cardName || /\b(cartao|cartoes|credito)\b/.test(normalized)
      ? "card"
      : "full_finances";
  const provisionalGoal = classifyGoal(normalized, period, provisionalScope);

  if (!provisionalGoal) {
    return null;
  }

  const scope = detectScope(normalized, cardName, provisionalGoal);
  const goal =
    provisionalGoal === "financial_summary" &&
    (period.type === "current_year" ||
      period.type === "specific_year" ||
      period.type === "last_year")
      ? "year_summary"
      : provisionalGoal;
  const responseLevel = responseLevelForGoal(goal, normalized);

  const plan = buildPlan({
    goal,
    period,
    scope,
    responseLevel,
    cardName: scope === "card" ? cardName : undefined,
    filters: filtersForGoal(goal, normalized),
  });

  console.log("Financial Planner input tools:", {
    availableTools: input.availableTools,
    capabilities: AVAILABLE_FINANCIAL_CAPABILITIES,
    lastActionExecuted: input.lastActionExecuted,
  });

  return plan;
}
