import type {
  CreditCardInvoicePayment,
  CreditCardInvoicePaymentEntry,
} from "../entities/userCreditCard";

type InvoicesMap = Record<string, CreditCardInvoicePayment> | undefined;

const EPSILON = 0.005;

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getPreviousPeriodKey(periodKey: string): string {
  const [year, month] = periodKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getNextPeriodKey(periodKey: string): string {
  const [year, month] = periodKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Lista de pagamentos; dados legados (sem `payments`) viram uma entrada única. */
export function getInvoicePayments(
  payment: CreditCardInvoicePayment | undefined,
): CreditCardInvoicePaymentEntry[] {
  if (!payment) return [];
  if (payment.payments) return payment.payments;
  if (!(payment.amountPaid > 0)) return [];

  return [
    {
      id: payment.transactionId,
      amount: payment.amountPaid,
      paidAt: payment.paidAt,
      transactionId: payment.transactionId,
    },
  ];
}

export function getInvoiceCarryIn(
  invoices: InvoicesMap,
  periodKey: string,
): number {
  const previous = invoices?.[getPreviousPeriodKey(periodKey)];
  return roundMoney(
    getInvoicePayments(previous).reduce(
      (sum, entry) => sum + (entry.rolledOver ?? 0) + (entry.interest ?? 0),
      0,
    ),
  );
}

export type InvoiceBalance = {
  total: number;
  purchases: number;
  carryIn: number;
  settled: number;
  paid: number;
  remaining: number;
  isPaid: boolean;
  payments: CreditCardInvoicePaymentEntry[];
};

export function computeInvoiceBalance(params: {
  purchases: number;
  invoices: InvoicesMap;
  periodKey: string;
}): InvoiceBalance {
  const payments = getInvoicePayments(params.invoices?.[params.periodKey]);
  const carryIn = getInvoiceCarryIn(params.invoices, params.periodKey);
  const purchases = roundMoney(params.purchases);
  const total = roundMoney(purchases + carryIn);
  const paid = roundMoney(payments.reduce((sum, p) => sum + p.amount, 0));
  const settled = roundMoney(
    payments.reduce((sum, p) => sum + p.amount + (p.rolledOver ?? 0), 0),
  );
  const remaining = roundMoney(Math.max(total - settled, 0));

  return {
    total,
    purchases,
    carryIn,
    settled,
    paid,
    remaining,
    isPaid: total > 0 && remaining <= EPSILON,
    payments,
  };
}

export function buildInvoicePaymentEntry(params: {
  amount: number;
  remaining: number;
  paidAt: string;
  transactionId: string;
  interest?: number;
}): CreditCardInvoicePaymentEntry {
  const amount = roundMoney(params.amount);
  const remaining = roundMoney(params.remaining);
  const interest = roundMoney(params.interest ?? 0);

  if (remaining <= EPSILON) throw new Error("Invoice is already paid");
  if (!(amount > 0)) throw new Error("Payment amount must be greater than 0");
  if (amount > remaining + EPSILON) {
    throw new Error("Payment amount is greater than the invoice balance");
  }
  if (interest < 0) throw new Error("Interest cannot be negative");

  const rolledOver = roundMoney(Math.max(remaining - amount, 0));
  if (rolledOver <= EPSILON && interest > 0) {
    throw new Error("Interest can only be added to a partial payment");
  }

  return {
    id: params.transactionId,
    amount,
    paidAt: params.paidAt,
    transactionId: params.transactionId,
    ...(rolledOver > EPSILON && { rolledOver }),
    ...(rolledOver > EPSILON && interest > 0 && { interest }),
  };
}

function summarize(
  entries: CreditCardInvoicePaymentEntry[],
): CreditCardInvoicePayment {
  const last = entries.at(-1);
  return {
    amountPaid: roundMoney(entries.reduce((sum, e) => sum + e.amount, 0)),
    paidAt: last?.paidAt ?? "",
    transactionId: last?.transactionId ?? "",
    payments: entries,
  };
}

export function appendInvoicePayment(
  existing: CreditCardInvoicePayment | undefined,
  entry: CreditCardInvoicePaymentEntry,
): CreditCardInvoicePayment {
  return summarize([...getInvoicePayments(existing), entry]);
}

/** Retorna null quando não sobra nenhum pagamento. */
export function removeInvoicePayment(
  existing: CreditCardInvoicePayment | undefined,
  entryId: string,
): CreditCardInvoicePayment | null {
  const remainingEntries = getInvoicePayments(existing).filter(
    (entry) => entry.id !== entryId && entry.transactionId !== entryId,
  );
  return remainingEntries.length > 0 ? summarize(remainingEntries) : null;
}

/** Períodos que precisam de fatura: com compras ou com saldo rolado de entrada. */
export function getInvoicePeriodsWithBalance(
  invoices: InvoicesMap,
  purchasePeriodKeys: Iterable<string>,
): string[] {
  const keys = new Set(purchasePeriodKeys);
  for (const periodKey of Object.keys(invoices ?? {})) {
    if (getInvoiceCarryIn(invoices, getNextPeriodKey(periodKey)) > 0) {
      keys.add(getNextPeriodKey(periodKey));
    }
  }
  return [...keys].sort();
}
