export type BFinanceAction =
  | "query"
  | "create"
  | "update"
  | "delete"
  | "pay"
  | "help"
  | "clarify";

export type BFinanceResource =
  | "transaction"
  | "card_transaction"
  | "invoice"
  | "bill"
  | "investment"
  | "summary"
  | "settings";

export type BFinanceOperation =
  | "list"
  | "total"
  | "summary"
  | "ranking"
  | "detail"
  | "mark_as_paid";

export type BFinanceTransactionType = "expense" | "income" | "all";

export type BFinancePeriodType =
  | "all"
  | "today"
  | "yesterday"
  | "current_week"
  | "last_week"
  | "next_week"
  | "current_month"
  | "last_month"
  | "current_year"
  | "last_year"
  | "specific_month"
  | "specific_year"
  | "last_n_days"
  | "date_range"
  | "current_invoice";

export type BFinancePaymentMethod = "cash" | "pix" | "debit" | "credit_card";

export type BFinanceUpdateField =
  | "description"
  | "amount"
  | "date"
  | "category"
  | "paymentMethod";

export type BFinanceUpdateReference = "recent" | "latest";

export type BFinanceCommandUpdate = {
  field?: BFinanceUpdateField | null;
  value?: string | number | null;
  reference?: BFinanceUpdateReference | null;
  targetText?: string | null;
};

export type BFinanceOrderBy =
  | "date_desc"
  | "date_asc"
  | "amount_desc"
  | "amount_asc"
  | "created_desc";

export type BFinancePeriod = {
  raw?: string | null;
  type: BFinancePeriodType;
  startDate?: string | null;
  endDate?: string | null;
  month?: number | null;
  year?: number | null;
  days?: number | null;
  isExplicit: boolean;
};

export type BFinanceScope = {
  includeNormalTransactions: boolean;
  includeCardTransactions: boolean;
  cardName?: string | null;
  excludeCardTransactions?: boolean;
  paymentMethod?: BFinancePaymentMethod | null;
  excludePaymentMethod?: BFinancePaymentMethod | null;
};

export type BFinanceFilters = {
  category?: string | null;
  description?: string | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  amount?: number | null;
  limit?: number | null;
  orderBy?: BFinanceOrderBy;
};

export type BFinanceCommandData = {
  description?: string | null;
  amount?: number | null;
  category?: string | null;
  date?: string | null;
  cardName?: string | null;
  paymentMethod?: string | null;
  installmentCount?: number | null;
  installmentRequested?: boolean;
};

export type BFinanceClarification = {
  question: string;
  missingFields: string[];
};

export type BFinanceCommand = {
  action: BFinanceAction;
  resource: BFinanceResource;
  operation?: BFinanceOperation;
  transactionType?: BFinanceTransactionType;
  period?: BFinancePeriod;
  scope?: BFinanceScope;
  filters?: BFinanceFilters;
  data?: BFinanceCommandData;
  update?: BFinanceCommandUpdate;
  clarification?: BFinanceClarification;
  confidence: number;
};

export type CommandNormalizerContext = {
  previousCommand?: BFinanceCommand | null;
};

export type CommandTransactionItem = {
  id: string;
  source: "transaction" | "card_transaction";
  description: string;
  date: string;
  amount: number;
  category?: string | null;
  type: "expense" | "income";
  paymentMethod?: string | null;
  cardName?: string | null;
  installmentNumber?: number | null;
  installmentCount?: number | null;
  totalAmount?: number | null;
  createdAt?: string | null;
};

export type CommandTotals = {
  income: number;
  normalExpense: number;
  cardExpense: number;
  expense: number;
  balance: number;
  count: number;
};

export type CommandInvoiceItem = {
  cardName: string;
  amount: number;
  dueDate: string;
  periodKey: string;
};

export type CommandCardBreakdownItem = {
  cardName: string;
  total: number;
  count: number;
};

export type CommandBillItem = {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  status: string;
};

export type CommandInvestmentItem = {
  id: string;
  category: string;
  balance: number;
  totalYield: number;
  liquidity?: string;
};

export type CommandRankingItem = {
  label: string;
  total: number;
  count: number;
};

export type BFinanceCommandResult =
  | {
      success: true;
      kind: "transaction_list";
      command: BFinanceCommand;
      title: string;
      period: BFinancePeriod;
      totals: CommandTotals;
      items: CommandTransactionItem[];
    }
  | {
      success: true;
      kind: "transaction_total";
      command: BFinanceCommand;
      title: string;
      period: BFinancePeriod;
      totals: CommandTotals;
      items: CommandTransactionItem[];
    }
  | {
      success: true;
      kind: "financial_summary";
      command: BFinanceCommand;
      title: string;
      period: BFinancePeriod;
      totals: CommandTotals;
      cardBreakdown: CommandCardBreakdownItem[];
      categoryBreakdown: CommandRankingItem[];
      pendingBills: CommandBillItem[];
      investments: CommandInvestmentItem[];
    }
  | {
      success: true;
      kind: "category_ranking";
      command: BFinanceCommand;
      title: string;
      period: BFinancePeriod;
      rankings: CommandRankingItem[];
      total: number;
    }
  | {
      success: true;
      kind: "invoice_summary";
      command: BFinanceCommand;
      title: string;
      mode: "open" | "period";
      period: BFinancePeriod;
      invoices: CommandInvoiceItem[];
      total: number;
    }
  | {
      success: true;
      kind: "bill_list";
      command: BFinanceCommand;
      title: string;
      bills: CommandBillItem[];
      total: number;
    }
  | {
      success: true;
      kind: "investment_summary";
      command: BFinanceCommand;
      title: string;
      investments: CommandInvestmentItem[];
      totalBalance: number;
      totalYield: number;
    }
  | {
      success: true;
      kind: "transaction_created";
      command: BFinanceCommand;
      item: CommandTransactionItem;
    }
  | {
      success: true;
      kind: "ready_message";
      command: BFinanceCommand;
      message: string;
      pendingAction?: unknown;
      updatedItem?: CommandTransactionItem;
    }
  | {
      success: false;
      kind: "clarification" | "error";
      command?: BFinanceCommand;
      message: string;
      missingFields?: string[];
    };
