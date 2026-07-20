import { db } from "@/lib/firebaseAdmin";
import {
  getCardTransactions,
  type CardTransaction,
} from "./cardTransactionsAdmin";
import {
  getInvoiceDateRange,
  getInvoiceDueDate,
  getInvoicePeriodKey,
  getInvoicePeriodKeyForDate,
  getInvoicePeriodKeyForDueDate,
  isValidBillingDay,
} from "@/lib/creditCards/billing";
import { getCreditCardBankKey, getCreditCardName } from "@/lib/creditCards/catalog";

export type CreditCardInvoicePayment = {
  amountPaid: number;
  paidAt: string;
  transactionId: string;
};

export type UserCreditCard = {
  id: string;
  bankKey: string;
  closingDay?: number;
  dueDay?: number;
  invoices: Record<string, CreditCardInvoicePayment>;
};

type ResolvedCreditCard = {
  docId: string;
  transactionCardName: string;
  card: UserCreditCard;
};

export type CardInvoiceTransactionsResult = {
  cardName: string;
  periodKey: string;
  startDate: string;
  endDate: string;
  dueDate: string;
  amount: number;
  transactions: CardTransaction[];
};

function getCreditCardInvoiceBillId(creditCardId: string, periodKey: string): string {
  return `credit-card-invoice_${creditCardId}_${periodKey}`;
}

async function findCreditCardInvoiceBill(
  userId: string,
  creditCardId: string,
  periodKey: string
) {
  const snapshot = await db
    .collection(`users/${userId}/billAccounts`)
    .where("creditCardId", "==", creditCardId)
    .where("creditCardInvoicePeriodKey", "==", periodKey)
    .get();

  if (snapshot.empty) return null;

  return snapshot.docs
    .map((doc) => ({
      id: doc.id,
      data: doc.data(),
    }))
    .sort((a, b) => {
      if (a.data.source === "credit_card_invoice" && b.data.source !== "credit_card_invoice") return -1;
      if (a.data.source !== "credit_card_invoice" && b.data.source === "credit_card_invoice") return 1;
      return String(a.data.createdAt ?? "").localeCompare(String(b.data.createdAt ?? ""));
    })[0];
}

export async function getUserCreditCards(
  userId: string
): Promise<UserCreditCard[]> {
  const snapshot = await db
    .collection(`users/${userId}/creditCards`)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as UserCreditCard[];
}

async function resolveCreditCard(userId: string, cardName: string): Promise<ResolvedCreditCard> {
  const bankKey = getCreditCardBankKey(cardName);
  const docId = bankKey ?? cardName;
  const transactionCardName = getCreditCardName(cardName);
  const cardDoc = await db
    .collection(`users/${userId}/creditCards`)
    .doc(docId)
    .get();

  if (!cardDoc.exists) {
    throw new Error(`Credit card not found: ${cardName}`);
  }

  return {
    docId: cardDoc.id,
    transactionCardName,
    card: {
      id: cardDoc.id,
      ...cardDoc.data(),
    } as UserCreditCard,
  };
}

function assertCardBillingConfigured(card: UserCreditCard): asserts card is UserCreditCard & {
  closingDay: number;
  dueDay: number;
} {
  if (!isValidBillingDay(card.closingDay) || !isValidBillingDay(card.dueDay)) {
    throw new Error(`Credit card billing is not configured: ${card.id}`);
  }
}

async function getTransactionsForResolvedCard(
  userId: string,
  transactionCardName: string,
  startDate?: string,
  endDate?: string
): Promise<CardTransaction[]> {
  const targetBankKey = getCreditCardBankKey(transactionCardName);
  const transactions = await getCardTransactions(userId);

  return transactions.filter((transaction) => {
    const transactionBankKey = getCreditCardBankKey(transaction.card);
    const cardMatches = targetBankKey
      ? transactionBankKey === targetBankKey
      : transaction.card === transactionCardName;
    const afterStart = !startDate || transaction.date >= startDate;
    const beforeEnd = !endDate || transaction.date <= endDate;

    return cardMatches && afterStart && beforeEnd;
  });
}

async function resolvePaymentPeriodKey(
  userId: string,
  transactionCardName: string,
  card: UserCreditCard & { closingDay: number; dueDay: number },
  paymentDate: string,
  year?: number,
  month?: number
): Promise<string> {
  if (year && month) {
    return getInvoicePeriodKey(year, month);
  }

  const transactions = await getTransactionsForResolvedCard(userId, transactionCardName);
  const totalsByPeriod = transactions.reduce<Record<string, number>>((totals, transaction) => {
    const periodKey = getInvoicePeriodKeyForDate(transaction.date, card.closingDay, card.dueDay);
    totals[periodKey] = (totals[periodKey] || 0) + Math.abs(transaction.amount);
    return totals;
  }, {});

  const openPeriods = Object.entries(totalsByPeriod)
    .map(([periodKey, total]) => ({
      periodKey,
      dueDate: getInvoiceDueDate(periodKey, card.closingDay, card.dueDay),
      amount: total - (card.invoices?.[periodKey]?.amountPaid || 0),
    }))
    .filter(({ amount }) => amount > 0.01)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const nextDuePeriod = openPeriods.find(({ dueDate }) => dueDate >= paymentDate);
  if (nextDuePeriod) {
    return nextDuePeriod.periodKey;
  }

  const latestOpenPeriod = openPeriods.at(-1);
  if (latestOpenPeriod) {
    return latestOpenPeriod.periodKey;
  }

  return getInvoicePeriodKeyForDueDate(paymentDate, card.closingDay, card.dueDay);
}

export async function getCardInvoiceAmount(
  userId: string,
  cardName: string,
  year: number,
  month: number
): Promise<number> {
  const { card, transactionCardName } = await resolveCreditCard(userId, cardName);
  assertCardBillingConfigured(card);

  const periodKey = getInvoicePeriodKey(year, month);
  const { startDate, endDate } = getInvoiceDateRange(periodKey, card.closingDay, card.dueDay);

  const transactions = await getTransactionsForResolvedCard(
    userId,
    transactionCardName,
    startDate,
    endDate
  );

  const total = transactions.reduce(
    (sum, transaction) => sum + Math.abs(transaction.amount),
    0
  );

  const payment = card.invoices?.[periodKey];
  if (payment) {
    return total - payment.amountPaid;
  }

  return total;
}

export async function getCurrentCardInvoiceTransactions(
  userId: string,
  cardName: string,
  todayDate: string = new Date().toISOString().split("T")[0]
): Promise<CardInvoiceTransactionsResult> {
  const { card, transactionCardName } = await resolveCreditCard(userId, cardName);
  assertCardBillingConfigured(card);

  const periodKey = await resolvePaymentPeriodKey(
    userId,
    transactionCardName,
    card,
    todayDate
  );
  const { startDate, endDate } = getInvoiceDateRange(
    periodKey,
    card.closingDay,
    card.dueDay
  );
  const transactions = await getTransactionsForResolvedCard(
    userId,
    transactionCardName,
    startDate,
    endDate
  );
  const total = transactions.reduce(
    (sum, transaction) => sum + Math.abs(transaction.amount),
    0
  );
  const paidAmount = card.invoices?.[periodKey]?.amountPaid || 0;

  return {
    cardName: getCreditCardName(card.bankKey ?? card.id),
    periodKey,
    startDate,
    endDate,
    dueDate: getInvoiceDueDate(periodKey, card.closingDay, card.dueDay),
    amount: Math.max(total - paidAmount, 0),
    transactions,
  };
}

export async function payCardInvoice(
  userId: string,
  cardName: string,
  amount: number,
  paymentDate: string,
  options: { year?: number; month?: number } = {}
): Promise<void> {
  const { docId, transactionCardName, card } = await resolveCreditCard(userId, cardName);
  assertCardBillingConfigured(card);

  const periodKey = await resolvePaymentPeriodKey(
    userId,
    transactionCardName,
    card,
    paymentDate,
    options.year,
    options.month
  );

  const existingInvoiceBill = await findCreditCardInvoiceBill(userId, docId, periodKey);
  const invoiceBillId = existingInvoiceBill?.id ?? getCreditCardInvoiceBillId(docId, periodKey);
  const transactionRef = db
    .collection(`users/${userId}/transactions`)
    .doc();
  const cardRef = db.collection(`users/${userId}/creditCards`).doc(docId);
  const billRef = db
    .collection(`users/${userId}/billAccounts`)
    .doc(invoiceBillId);
  const existingBillData = existingInvoiceBill?.data;
  const batch = db.batch();

  batch.set(transactionRef, {
    description: `Fatura do cartão ${cardName}`,
    date: paymentDate,
    amount: -Math.abs(amount),
    category: "Credit Card",
    type: "expense",
    paymentMethod: "pix",
    billAccountId: invoiceBillId,
  });

  batch.set(cardRef, {
    bankKey: card.bankKey ?? docId,
    invoices: {
      [periodKey]: {
        amountPaid: Math.abs(amount),
        paidAt: paymentDate,
        transactionId: transactionRef.id,
      },
    },
  }, { merge: true });

  batch.set(
    billRef,
    {
      description: existingBillData?.description ?? `Fatura do cartão ${getCreditCardName(card.bankKey ?? docId)}`,
      amount: Math.abs(amount),
      dueDate: existingBillData?.dueDate ?? getInvoiceDueDate(periodKey, card.closingDay, card.dueDay),
      status: "paid",
      recurrence: "unique",
      creditCardId: docId,
      creditCardInvoicePeriodKey: periodKey,
      source: "credit_card_invoice",
      hiddenFromBills: existingBillData?.hiddenFromBills ?? false,
      paymentTransactionId: transactionRef.id,
      paidAt: paymentDate,
      createdAt: existingBillData?.createdAt ?? new Date().toISOString().split("T")[0],
    },
    { merge: true }
  );

  await batch.commit();
}

export async function getAllCardInvoices(
  userId: string,
  year: number,
  month: number
): Promise<{ cardName: string; amount: number }[]> {
  const cards = await getUserCreditCards(userId);
  const results: { cardName: string; amount: number }[] = [];

  for (const card of cards) {
    if (!isValidBillingDay(card.closingDay) || !isValidBillingDay(card.dueDay)) {
      continue;
    }

    const amount = await getCardInvoiceAmount(userId, card.bankKey ?? card.id, year, month);
    if (amount > 0.01) {
      results.push({ cardName: getCreditCardName(card.bankKey ?? card.id), amount });
    }
  }

  return results;
}

