import { db } from "@/lib/firebaseAdmin";
import { getInvoicePeriodKeyForDueDate, isValidBillingDay } from "@/lib/creditCards/billing";

export type BillAccount = {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  status: "pending" | "paid";
  recurrence: "unique" | "monthly" | "installments" | {
    type: "none" | "monthly" | "yearly";
    interval?: number;
  };
  installments?: number;
  currentInstallment?: number;
  creditCardId?: string;
  creditCardInvoicePeriodKey?: string;
  source?: "manual" | "credit_card_invoice";
  hiddenFromBills?: boolean;
  paymentTransactionId?: string;
  paidAt?: string;
  createdAt: string;
};

export async function getBillAccounts(userId: string): Promise<BillAccount[]> {
  const snapshot = await db
    .collection(`users/${userId}/billAccounts`)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as BillAccount[];
}

export async function getPendingBills(userId: string): Promise<BillAccount[]> {
  const snapshot = await db
    .collection(`users/${userId}/billAccounts`)
    .where("status", "==", "pending")
    .get();

  return snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }) as BillAccount)
    .filter((bill) => !bill.hiddenFromBills);
}

export async function getUpcomingBills(
  userId: string,
  days: number = 7
): Promise<BillAccount[]> {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);

  const todayStr = today.toISOString().split("T")[0];
  const futureDateStr = futureDate.toISOString().split("T")[0];

  const snapshot = await db
    .collection(`users/${userId}/billAccounts`)
    .where("status", "==", "pending")
    .where("dueDate", ">=", todayStr)
    .where("dueDate", "<=", futureDateStr)
    .get();

  return snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }) as BillAccount)
    .filter((bill) => !bill.hiddenFromBills);
}

export async function payBillAccount(
  userId: string,
  billId: string,
  paymentDate: string
): Promise<void> {
  const billRef = db.collection(`users/${userId}/billAccounts`).doc(billId);
  const billDoc = await billRef.get();

  if (!billDoc.exists) {
    throw new Error("Conta não encontrada");
  }

  const billData = billDoc.data() as BillAccount;
  const batch = db.batch();
  const transactionRef = db.collection(`users/${userId}/transactions`).doc();
  let shouldCreateTransaction = true;
  let paymentTransactionId = transactionRef.id;

  const transactionData = {
    description: billData.description,
    amount: -Math.abs(billData.amount),
    date: paymentDate,
    category: "fixes",
    type: "expense",
    paymentMethod: "pix",
    billAccountId: billId,
  };

  if (billData.creditCardId) {
    const cardRef = db.collection(`users/${userId}/creditCards`).doc(billData.creditCardId);
    const cardDoc = await cardRef.get();
    const cardData = cardDoc.exists ? cardDoc.data() as {
      bankKey?: string;
      closingDay?: number;
      dueDay?: number;
      invoices?: Record<string, { amountPaid: number; paidAt: string; transactionId: string }>;
    } : null;
    const periodKey = billData.creditCardInvoicePeriodKey
      ?? (cardData && isValidBillingDay(cardData.closingDay) && isValidBillingDay(cardData.dueDay)
        ? getInvoicePeriodKeyForDueDate(billData.dueDate, cardData.closingDay, cardData.dueDay)
        : paymentDate.slice(0, 7));
    const invoicePayment = cardData?.invoices?.[periodKey];
    const transactionId = invoicePayment?.transactionId ?? transactionRef.id;
    paymentTransactionId = transactionId;

    if (invoicePayment && invoicePayment.amountPaid >= Math.abs(billData.amount)) {
      shouldCreateTransaction = false;
    }

    batch.set(cardRef, {
      bankKey: cardData?.bankKey ?? billData.creditCardId,
      invoices: {
        [periodKey]: {
          amountPaid: Math.abs(billData.amount),
          paidAt: paymentDate,
          transactionId,
        },
      },
    }, { merge: true });
  }

  if (shouldCreateTransaction) {
    batch.set(transactionRef, transactionData);
  }

  batch.update(billRef, {
    status: "paid",
    paymentTransactionId,
    paidAt: paymentDate,
  });
  await batch.commit();
}

export async function findBillByDescription(
  userId: string,
  description: string
): Promise<BillAccount[]> {
  const snapshot = await db
    .collection(`users/${userId}/billAccounts`)
    .where("status", "==", "pending")
    .get();

  const descLower = description.toLowerCase();

  return snapshot.docs
    .filter((doc) => {
      const data = doc.data();
      return !data.hiddenFromBills && data.description?.toLowerCase().includes(descLower);
    })
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as BillAccount[];
}
