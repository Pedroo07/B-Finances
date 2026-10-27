export type CreditCardInvoicePaymentEntry = {
  id: string;
  amount: number;
  paidAt: string;
  transactionId: string;
  rolledOver?: number;
  interest?: number;
};

export type CreditCardInvoicePayment = {
  amountPaid: number;
  paidAt: string;
  transactionId: string;
  payments?: CreditCardInvoicePaymentEntry[];
};

export type UserCreditCard = {
  id: string;
  bankKey: string;
  closingDay?: number;
  dueDay?: number;
  invoices?: Record<string, CreditCardInvoicePayment>;
  removed?: boolean;
};
