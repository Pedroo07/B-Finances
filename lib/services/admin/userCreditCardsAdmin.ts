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
import {
  getCreditCardBankKey,
  getCreditCardName,
} from "@/lib/creditCards/catalog";
import {
  appendInvoicePayment,
  buildInvoicePaymentEntry,
  computeInvoiceBalance,
  getInvoicePeriodsWithBalance,
  roundMoney,
} from "@/lib/creditCards/invoiceBalance";
import type { CreditCardInvoicePayment } from "@/lib/entities/userCreditCard";

export type { CreditCardInvoicePayment };

export class InvoicePaymentRejectedError extends Error {
  readonly reason: "already_paid" | "exceeds_balance";
  readonly remaining: number;

  constructor(reason: "already_paid" | "exceeds_balance", remaining: number) {
    super(`Invoice payment rejected: ${reason}`);
    this.reason = reason;
    this.remaining = remaining;
  }
}

export type CardInvoicePaymentResult = {
  paid: number;
  rolledOver: number;
  periodKey: string;
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

export type CardInvoiceSummary = {
  cardName: string;
  periodKey: string;
  dueDate: string;
  amount: number;
};

function getCreditCardInvoiceBillId(
  creditCardId: string,
  periodKey: string,
): string {
  return `credit-card-invoice_${creditCardId}_${periodKey}`;
}

async function findCreditCardInvoiceBill(
  userId: string,
  creditCardId: string,
  periodKey: string,
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
      if (
        a.data.source === "credit_card_invoice" &&
        b.data.source !== "credit_card_invoice"
      )
        return -1;
      if (
        a.data.source !== "credit_card_invoice" &&
        b.data.source === "credit_card_invoice"
      )
        return 1;
      return String(a.data.createdAt ?? "").localeCompare(
        String(b.data.createdAt ?? ""),
      );
    })[0];
}

export async function getUserCreditCards(
  userId: string,
): Promise<UserCreditCard[]> {
  const snapshot = await db.collection(`users/${userId}/creditCards`).get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as UserCreditCard[];
}

async function resolveCreditCard(
  userId: string,
  cardName: string,
): Promise<ResolvedCreditCard> {
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

function assertCardBillingConfigured(
  card: UserCreditCard,
): asserts card is UserCreditCard & {
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
  endDate?: string,
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
  month?: number,
): Promise<string> {
  if (year && month) {
    return getInvoicePeriodKey(year, month);
  }

  const transactions = await getTransactionsForResolvedCard(
    userId,
    transactionCardName,
  );
  const purchasesByPeriod = transactions.reduce<Record<string, number>>(
    (totals, transaction) => {
      const periodKey = getInvoicePeriodKeyForDate(
        transaction.date,
        card.closingDay,
        card.dueDay,
      );
      totals[periodKey] =
        (totals[periodKey] || 0) + Math.abs(transaction.amount);
      return totals;
    },
    {},
  );

  const openPeriods = getInvoicePeriodsWithBalance(
    card.invoices,
    Object.keys(purchasesByPeriod),
  )
    .map((periodKey) => ({
      periodKey,
      dueDate: getInvoiceDueDate(periodKey, card.closingDay, card.dueDay),
      amount: computeInvoiceBalance({
        purchases: purchasesByPeriod[periodKey] || 0,
        invoices: card.invoices,
        periodKey,
      }).remaining,
    }))
    .filter(({ amount }) => amount > 0.01)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const nextDuePeriod = openPeriods.find(
    ({ dueDate }) => dueDate >= paymentDate,
  );
  if (nextDuePeriod) {
    return nextDuePeriod.periodKey;
  }

  const latestOpenPeriod = openPeriods.at(-1);
  if (latestOpenPeriod) {
    return latestOpenPeriod.periodKey;
  }

  return getInvoicePeriodKeyForDueDate(
    paymentDate,
    card.closingDay,
    card.dueDay,
  );
}

export async function getCardInvoiceAmount(
  userId: string,
  cardName: string,
  year: number,
  month: number,
): Promise<number> {
  return (await getCardInvoiceSummary(userId, cardName, year, month)).amount;
}

export async function getCardInvoiceSummary(
  userId: string,
  cardName: string,
  year: number,
  month: number,
): Promise<CardInvoiceSummary> {
  const { card, transactionCardName } = await resolveCreditCard(
    userId,
    cardName,
  );
  assertCardBillingConfigured(card);

  const periodKey = getInvoicePeriodKey(year, month);
  const { startDate, endDate } = getInvoiceDateRange(
    periodKey,
    card.closingDay,
    card.dueDay,
  );

  const transactions = await getTransactionsForResolvedCard(
    userId,
    transactionCardName,
    startDate,
    endDate,
  );

  const purchases = transactions.reduce(
    (sum, transaction) => sum + Math.abs(transaction.amount),
    0,
  );

  const amount = computeInvoiceBalance({
    purchases,
    invoices: card.invoices,
    periodKey,
  }).remaining;

  return {
    cardName: getCreditCardName(card.bankKey ?? card.id),
    periodKey,
    dueDate: getInvoiceDueDate(periodKey, card.closingDay, card.dueDay),
    amount,
  };
}

export async function getCurrentCardInvoiceTransactions(
  userId: string,
  cardName: string,
  todayDate: string = new Date().toISOString().split("T")[0],
): Promise<CardInvoiceTransactionsResult> {
  const { card, transactionCardName } = await resolveCreditCard(
    userId,
    cardName,
  );
  assertCardBillingConfigured(card);

  const periodKey = await resolvePaymentPeriodKey(
    userId,
    transactionCardName,
    card,
    todayDate,
  );
  const { startDate, endDate } = getInvoiceDateRange(
    periodKey,
    card.closingDay,
    card.dueDay,
  );
  const transactions = await getTransactionsForResolvedCard(
    userId,
    transactionCardName,
    startDate,
    endDate,
  );
  const purchases = transactions.reduce(
    (sum, transaction) => sum + Math.abs(transaction.amount),
    0,
  );
  const balance = computeInvoiceBalance({
    purchases,
    invoices: card.invoices,
    periodKey,
  });

  return {
    cardName: getCreditCardName(card.bankKey ?? card.id),
    periodKey,
    startDate,
    endDate,
    dueDate: getInvoiceDueDate(periodKey, card.closingDay, card.dueDay),
    amount: balance.remaining,
    transactions,
  };
}

export async function payCardInvoice(
  userId: string,
  cardName: string,
  amount: number,
  paymentDate: string,
  options: { year?: number; month?: number; interest?: number } = {},
): Promise<CardInvoicePaymentResult> {
  const { docId, transactionCardName, card } = await resolveCreditCard(
    userId,
    cardName,
  );
  assertCardBillingConfigured(card);

  const periodKey = await resolvePaymentPeriodKey(
    userId,
    transactionCardName,
    card,
    paymentDate,
    options.year,
    options.month,
  );
  const { startDate, endDate } = getInvoiceDateRange(
    periodKey,
    card.closingDay,
    card.dueDay,
  );
  const periodTransactions = await getTransactionsForResolvedCard(
    userId,
    transactionCardName,
    startDate,
    endDate,
  );
  const purchases = periodTransactions.reduce(
    (sum, transaction) => sum + Math.abs(transaction.amount),
    0,
  );

  const existingInvoiceBill = await findCreditCardInvoiceBill(
    userId,
    docId,
    periodKey,
  );
  const invoiceBillId =
    existingInvoiceBill?.id ?? getCreditCardInvoiceBillId(docId, periodKey);
  const transactionRef = db.collection(`users/${userId}/transactions`).doc();
  const cardRef = db.collection(`users/${userId}/creditCards`).doc(docId);
  const billRef = db
    .collection(`users/${userId}/billAccounts`)
    .doc(invoiceBillId);
  const existingBillData = existingInvoiceBill?.data;

  return db.runTransaction(async (firestoreTransaction) => {
    const cardDoc = await firestoreTransaction.get(cardRef);
    const invoices = (cardDoc.data()?.invoices ?? {}) as Record<
      string,
      CreditCardInvoicePayment
    >;
    const balance = computeInvoiceBalance({ purchases, invoices, periodKey });

    if (balance.remaining <= 0.005) {
      throw new InvoicePaymentRejectedError("already_paid", 0);
    }
    if (roundMoney(Math.abs(amount)) > balance.remaining + 0.005) {
      throw new InvoicePaymentRejectedError(
        "exceeds_balance",
        balance.remaining,
      );
    }

    const entry = buildInvoicePaymentEntry({
      amount: Math.abs(amount),
      remaining: balance.remaining,
      paidAt: paymentDate,
      transactionId: transactionRef.id,
      interest: options.interest,
    });

    firestoreTransaction.set(transactionRef, {
      description: `Fatura do cartão ${cardName}${entry.rolledOver ? " (parcial)" : ""}`,
      date: paymentDate,
      amount: -entry.amount,
      category: "Credit Card",
      type: "expense",
      paymentMethod: "pix",
      billAccountId: invoiceBillId,
    });

    firestoreTransaction.set(
      cardRef,
      {
        bankKey: card.bankKey ?? docId,
        invoices: {
          [periodKey]: appendInvoicePayment(invoices[periodKey], entry),
        },
      },
      { merge: true },
    );

    firestoreTransaction.set(
      billRef,
      {
        description:
          existingBillData?.description ??
          `Fatura do cartão ${getCreditCardName(card.bankKey ?? docId)}`,
        amount: balance.total,
        dueDate:
          existingBillData?.dueDate ??
          getInvoiceDueDate(periodKey, card.closingDay, card.dueDay),
        status: "paid",
        recurrence: "unique",
        creditCardId: docId,
        creditCardInvoicePeriodKey: periodKey,
        source: "credit_card_invoice",
        hiddenFromBills: existingBillData?.hiddenFromBills ?? false,
        paymentTransactionId: transactionRef.id,
        paidAt: paymentDate,
        createdAt:
          existingBillData?.createdAt ??
          new Date().toISOString().split("T")[0],
      },
      { merge: true },
    );

    return {
      paid: entry.amount,
      rolledOver: entry.rolledOver ?? 0,
      periodKey,
    };
  });
}

export async function getAllCardInvoices(
  userId: string,
  year: number,
  month: number,
): Promise<CardInvoiceSummary[]> {
  const cards = await getUserCreditCards(userId);
  const results: CardInvoiceSummary[] = [];

  for (const card of cards) {
    if (
      !isValidBillingDay(card.closingDay) ||
      !isValidBillingDay(card.dueDay)
    ) {
      continue;
    }

    const invoice = await getCardInvoiceSummary(
      userId,
      card.bankKey ?? card.id,
      year,
      month,
    );
    if (invoice.amount > 0.01) {
      results.push(invoice);
    }
  }

  return results.sort((a, b) => {
    const dueDateComparison = a.dueDate.localeCompare(b.dueDate);
    return dueDateComparison || a.cardName.localeCompare(b.cardName);
  });
}

export async function getOpenCardInvoices(
  userId: string,
  todayDate: string,
): Promise<CardInvoiceSummary[]> {
  const [cards, transactions] = await Promise.all([
    getUserCreditCards(userId),
    getCardTransactions(userId),
  ]);
  return selectCurrentOpenCardInvoices(
    buildOpenCardInvoices(cards, transactions),
    todayDate,
  );
}

export function selectCurrentOpenCardInvoices(
  invoices: CardInvoiceSummary[],
  todayDate: string,
): CardInvoiceSummary[] {
  const invoicesByCard = invoices.reduce<Record<string, CardInvoiceSummary[]>>(
    (groups, invoice) => {
      (groups[invoice.cardName] ??= []).push(invoice);
      return groups;
    },
    {},
  );

  return Object.values(invoicesByCard)
    .map((cardInvoices) => {
      const orderedInvoices = [...cardInvoices].sort((a, b) =>
        a.dueDate.localeCompare(b.dueDate),
      );
      return (
        orderedInvoices.find((invoice) => invoice.dueDate >= todayDate) ??
        orderedInvoices.at(-1)!
      );
    })
    .sort((a, b) => {
      const dueDateComparison = a.dueDate.localeCompare(b.dueDate);
      return dueDateComparison || a.cardName.localeCompare(b.cardName);
    });
}

export function buildOpenCardInvoices(
  cards: UserCreditCard[],
  transactions: CardTransaction[],
): CardInvoiceSummary[] {
  const results: CardInvoiceSummary[] = [];

  for (const card of cards) {
    if (
      !isValidBillingDay(card.closingDay) ||
      !isValidBillingDay(card.dueDay)
    ) {
      continue;
    }

    const closingDay = card.closingDay;
    const dueDay = card.dueDay;
    const cardIdentifier = card.bankKey ?? card.id;
    const targetBankKey = getCreditCardBankKey(card.bankKey ?? card.id);
    const totalsByPeriod = transactions.reduce<Record<string, number>>(
      (totals, transaction) => {
        const transactionBankKey = getCreditCardBankKey(transaction.card);
        const cardMatches = targetBankKey
          ? targetBankKey === transactionBankKey
          : getCreditCardName(transaction.card) ===
            getCreditCardName(cardIdentifier);
        if (!cardMatches) return totals;

        const periodKey = getInvoicePeriodKeyForDate(
          transaction.date,
          closingDay,
          dueDay,
        );
        totals[periodKey] =
          (totals[periodKey] || 0) + Math.abs(transaction.amount);
        return totals;
      },
      {},
    );

    for (const periodKey of getInvoicePeriodsWithBalance(
      card.invoices,
      Object.keys(totalsByPeriod),
    )) {
      const amount = computeInvoiceBalance({
        purchases: totalsByPeriod[periodKey] || 0,
        invoices: card.invoices,
        periodKey,
      }).remaining;
      if (amount <= 0.01) continue;

      results.push({
        cardName: getCreditCardName(card.bankKey ?? card.id),
        periodKey,
        dueDate: getInvoiceDueDate(periodKey, closingDay, dueDay),
        amount,
      });
    }
  }

  return results.sort((a, b) => {
    const dueDateComparison = a.dueDate.localeCompare(b.dueDate);
    if (dueDateComparison !== 0) return dueDateComparison;
    const cardComparison = a.cardName.localeCompare(b.cardName);
    return cardComparison || a.periodKey.localeCompare(b.periodKey);
  });
}
