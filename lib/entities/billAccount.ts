export type BillAccountRecurrence = "unique" | "monthly" | "installments";
export type BillAccountSource = "manual" | "credit_card_invoice";

export type BillAccount = {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  status: "pending" | "paid";
  recurrence: BillAccountRecurrence;
  recurringSeriesId?: string;
  recurrenceMonth?: string;
  installments?: number;
  currentInstallment?: number;
  creditCardId?: string;
  creditCardInvoicePeriodKey?: string;
  source?: BillAccountSource;
  hiddenFromBills?: boolean;
  paymentTransactionId?: string;
  paidAt?: string;
  createdAt: string;
};

export type MonthlyBillAccountSeries = {
  id: string;
  description: string;
  amount: number;
  dueDay: number;
  startsOn: string;
  excludedMonths: string[];
  createdAt: string;
};
