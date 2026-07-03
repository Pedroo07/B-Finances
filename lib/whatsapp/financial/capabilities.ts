import type {
  FinancialCapability,
  FinancialGoal,
  FinancialPlan,
  FinancialScope,
} from "./types";

const CAPABILITIES_BY_GOAL: Record<FinancialGoal, FinancialCapability[]> = {
  financial_summary: [
    "income",
    "expenses",
    "card_expenses",
    "bills",
    "investments",
    "balance",
    "group_by_category",
  ],
  category_ranking: ["expenses", "card_expenses", "group_by_category"],
  saving_advice: [
    "expenses",
    "card_expenses",
    "recurring_expenses",
    "category_ranking",
    "unusual_expenses",
  ],
  income_listing: ["income", "list_items"],
  transaction_listing: ["expenses", "income", "card_expenses", "list_items"],
  year_summary: [
    "income",
    "expenses",
    "card_expenses",
    "bills",
    "investments",
    "monthly_comparison",
    "yearly_totals",
    "group_by_category",
  ],
  income_total: ["income"],
  expense_total: ["expenses", "card_expenses"],
  largest_expense: ["expenses", "card_expenses", "list_items"],
  card_expenses: ["card_expenses", "group_by_category", "list_items"],
  balance: ["income", "expenses", "card_expenses", "bills", "balance"],
};

export const AVAILABLE_FINANCIAL_CAPABILITIES: FinancialCapability[] = [
  "income",
  "expenses",
  "card_expenses",
  "category_ranking",
  "bills",
  "investments",
  "balance",
  "group_by_category",
  "recurring_expenses",
  "unusual_expenses",
  "list_items",
  "monthly_comparison",
  "yearly_totals",
];

function uniqueCapabilities(
  capabilities: FinancialCapability[],
): FinancialCapability[] {
  return [...new Set(capabilities)];
}

export function capabilitiesForPlan(
  goal: FinancialGoal,
  scope: FinancialScope,
): FinancialCapability[] {
  if (scope === "card") {
    if (goal === "financial_summary") {
      return ["card_expenses", "group_by_category", "list_items"];
    }

    if (
      goal === "expense_total" ||
      goal === "largest_expense" ||
      goal === "category_ranking" ||
      goal === "transaction_listing"
    ) {
      return uniqueCapabilities([
        "card_expenses",
        "group_by_category",
        "list_items",
      ]);
    }
  }

  if (scope === "cash" && goal !== "financial_summary") {
    return CAPABILITIES_BY_GOAL[goal].filter(
      (capability) => capability !== "card_expenses",
    );
  }

  return CAPABILITIES_BY_GOAL[goal];
}

export function withResolvedCapabilities(plan: FinancialPlan): FinancialPlan {
  return {
    ...plan,
    requiredCapabilities: capabilitiesForPlan(plan.goal, plan.scope),
  };
}
