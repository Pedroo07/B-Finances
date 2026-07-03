import type {
  ShortTermMemorySnapshot,
  ShortTermMemoryTurn,
} from "../utils/shortTermMemory";

export type FinancialCapability =
  | "income"
  | "expenses"
  | "card_expenses"
  | "category_ranking"
  | "bills"
  | "investments"
  | "balance"
  | "group_by_category"
  | "recurring_expenses"
  | "unusual_expenses"
  | "list_items"
  | "monthly_comparison"
  | "yearly_totals";

export type FinancialGoal =
  | "financial_summary"
  | "year_summary"
  | "category_ranking"
  | "saving_advice"
  | "income_listing"
  | "transaction_listing"
  | "income_total"
  | "expense_total"
  | "largest_expense"
  | "card_expenses"
  | "balance";

export type FinancialScope = "full_finances" | "card" | "cash";

export type ResponseLevel = "direct" | "list" | "summary" | "consulting";

export type PeriodType =
  | "today"
  | "yesterday"
  | "current_week"
  | "last_week"
  | "current_month"
  | "last_month"
  | "specific_month"
  | "current_year"
  | "last_year"
  | "specific_year"
  | "last_n_days";

export type ResolvedPeriod = {
  type: PeriodType;
  startDate: string;
  endDate: string;
  label: string;
  isExplicit: boolean;
  sourceText?: string;
};

export type FinancialFilters = {
  transactionType?: "income" | "expense";
  category?: string;
  limit?: number;
};

export type FinancialPlan = {
  goal: FinancialGoal;
  period: ResolvedPeriod;
  scope: FinancialScope;
  responseLevel: ResponseLevel;
  requiredCapabilities: FinancialCapability[];
  needsClarification: boolean;
  clarificationQuestion: string | null;
  cardName?: string;
  filters?: FinancialFilters;
  context?: {
    isContinuation: boolean;
    correctedScope?: boolean;
    previousGoal?: FinancialGoal;
  };
};

export type FinancialResultContext = {
  itemType:
    | "income"
    | "expense"
    | "card_expense"
    | "category"
    | "summary";
  total?: number;
  listedCount?: number;
  period: ResolvedPeriod;
  scope: FinancialScope;
  cardName?: string;
};

export type FinancialPlannerInput = {
  messageText: string;
  conversationHistory: string;
  sessionState?: unknown;
  shortTermMemory?: ShortTermMemorySnapshot | null;
  lastActionExecuted?: string | null;
  lastResultReturned?: unknown;
  currentDate: Date;
  availableTools: string[];
};

export type FinancialEngineInput = FinancialPlannerInput & {
  userId: string;
};

export type FinancialEngineResult =
  | {
      handled: false;
    }
  | {
      handled: true;
      reply: string;
      plan: FinancialPlan;
      resultContext?: FinancialResultContext;
      memoryParameters: Record<string, unknown>;
    };

export type FinancialMemoryContext = {
  turn: ShortTermMemoryTurn;
  plan?: FinancialPlan;
  resultContext?: FinancialResultContext;
};
