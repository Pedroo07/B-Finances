import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  deleteField,
  getDocs,
  updateDoc,
  writeBatch,
  getDoc,
  query,
  where,
  setDoc,
  runTransaction,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  BillAccount,
  BillAccountRecurrence,
  BillAccountSource,
  MonthlyBillAccountSeries,
} from "../entities/billAccount";
import { getAuth } from "firebase/auth";
import { TransactionDto } from "./transactions";
import { Transaction } from "../entities/transaction";
import {
  getInvoicePeriodKeyForDueDate,
  isValidBillingDay,
} from "../creditCards/billing";
import { UserCreditCard } from "../entities/userCreditCard";

const auth = getAuth();

export type BillAccountDto = {
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
};

function getUserBillAccountsCollection() {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  return collection(db, `users/${user.uid}/billAccounts`);
}

function getUserMonthlyBillAccountSeriesCollection() {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  return collection(db, `users/${user.uid}/billAccountRecurrences`);
}

function getMonthKey(date: string | Date): string {
  if (typeof date === "string") return date.slice(0, 7);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function addMonthsToMonthKey(monthKey: string, numberOfMonths: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + numberOfMonths, 1);
  return getMonthKey(date);
}

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getMonthlyOccurrenceDueDate(
  dueDay: number,
  monthKey: string,
): string {
  const [year, month] = monthKey.split("-").map(Number);
  const day = Math.min(dueDay, getLastDayOfMonth(year, month));
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getMonthlyOccurrenceId(seriesId: string, monthKey: string): string {
  return `monthly_${seriesId}_${monthKey}`;
}

function createMonthlyOccurrence(
  series: MonthlyBillAccountSeries,
  monthKey: string,
): BillAccount {
  return {
    id: getMonthlyOccurrenceId(series.id, monthKey),
    description: series.description,
    amount: series.amount,
    dueDate: getMonthlyOccurrenceDueDate(series.dueDay, monthKey),
    status: "pending",
    recurrence: "monthly",
    recurringSeriesId: series.id,
    recurrenceMonth: monthKey,
    createdAt: series.createdAt,
  };
}

export async function createMonthlyBillAccountSeries(
  data: Pick<BillAccountDto, "description" | "amount" | "dueDate">,
): Promise<BillAccount> {
  const seriesRef = doc(getUserMonthlyBillAccountSeriesCollection());
  const billAccountsRef = getUserBillAccountsCollection();
  const createdAt = new Date().toISOString().split("T")[0];
  const startsOnMonth = getMonthKey(data.dueDate);
  const series: MonthlyBillAccountSeries = {
    id: seriesRef.id,
    description: data.description,
    amount: data.amount,
    dueDay: Number(data.dueDate.slice(-2)),
    startsOn: data.dueDate,
    excludedMonths: [],
    createdAt,
  };
  const firstOccurrence = createMonthlyOccurrence(series, startsOnMonth);
  const batch = writeBatch(db);

  batch.set(seriesRef, series);
  batch.set(doc(billAccountsRef, firstOccurrence.id), firstOccurrence);
  await batch.commit();

  return firstOccurrence;
}

export async function syncMonthlyBillAccountOccurrences(
  referenceDate = new Date(),
): Promise<BillAccount[]> {
  const [seriesSnapshot, billsSnapshot] = await Promise.all([
    getDocs(getUserMonthlyBillAccountSeriesCollection()),
    getDocs(getUserBillAccountsCollection()),
  ]);
  const existingBillIds = new Set(
    billsSnapshot.docs.map((billDoc) => billDoc.id),
  );
  const billsRef = getUserBillAccountsCollection();
  const currentMonth = getMonthKey(referenceDate);
  const generatedBills: BillAccount[] = [];
  let batch = writeBatch(db);
  let operationCount = 0;

  const commitBatch = async () => {
    if (operationCount === 0) return;
    await batch.commit();
    batch = writeBatch(db);
    operationCount = 0;
  };

  for (const seriesDoc of seriesSnapshot.docs) {
    const series = {
      id: seriesDoc.id,
      ...seriesDoc.data(),
      excludedMonths: seriesDoc.data().excludedMonths ?? [],
    } as MonthlyBillAccountSeries;
    const startsOnMonth = getMonthKey(series.startsOn);
    const lastRequiredMonth = [
      addMonthsToMonthKey(currentMonth, 1),
      addMonthsToMonthKey(startsOnMonth, 1),
    ]
      .sort()
      .at(-1)!;

    for (
      let monthKey = startsOnMonth;
      monthKey <= lastRequiredMonth;
      monthKey = addMonthsToMonthKey(monthKey, 1)
    ) {
      const occurrenceId = getMonthlyOccurrenceId(series.id, monthKey);
      if (
        series.excludedMonths.includes(monthKey) ||
        existingBillIds.has(occurrenceId)
      ) {
        continue;
      }

      const occurrence = createMonthlyOccurrence(series, monthKey);
      batch.set(doc(billsRef, occurrence.id), occurrence);
      existingBillIds.add(occurrence.id);
      generatedBills.push(occurrence);
      operationCount += 1;

      if (operationCount === 450) await commitBatch();
    }
  }

  await commitBatch();
  return generatedBills;
}

export type CreditCardInvoiceBillDto = {
  creditCardId: string;
  creditCardInvoicePeriodKey: string;
  description: string;
  amount: number;
  dueDate: string;
  status: "pending" | "paid";
};

export function getCreditCardInvoiceBillId(
  creditCardId: string,
  periodKey: string,
): string {
  return `credit-card-invoice_${creditCardId}_${periodKey}`;
}

export async function findCreditCardInvoiceBill(
  creditCardId: string,
  periodKey: string,
): Promise<BillAccount | null> {
  const billsRef = getUserBillAccountsCollection();
  const snapshot = await getDocs(
    query(
      billsRef,
      where("creditCardId", "==", creditCardId),
      where("creditCardInvoicePeriodKey", "==", periodKey),
    ),
  );

  if (snapshot.empty) return null;

  const invoiceBill = snapshot.docs
    .map(
      (billDoc) =>
        ({
          id: billDoc.id,
          ...billDoc.data(),
        }) as BillAccount,
    )
    .sort((a, b) => {
      if (
        a.source === "credit_card_invoice" &&
        b.source !== "credit_card_invoice"
      )
        return -1;
      if (
        a.source !== "credit_card_invoice" &&
        b.source === "credit_card_invoice"
      )
        return 1;
      return a.createdAt.localeCompare(b.createdAt);
    })[0];

  return invoiceBill;
}

export async function syncCreditCardInvoiceBills(
  invoices: CreditCardInvoiceBillDto[],
): Promise<BillAccount[]> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const syncedBills = await Promise.all(
    invoices.map(async (invoice) => {
      const existingBill = await findCreditCardInvoiceBill(
        invoice.creditCardId,
        invoice.creditCardInvoicePeriodKey,
      );
      const billId =
        existingBill?.id ??
        getCreditCardInvoiceBillId(
          invoice.creditCardId,
          invoice.creditCardInvoicePeriodKey,
        );
      const billRef = doc(db, `users/${user.uid}/billAccounts`, billId);
      const createdAt =
        existingBill?.createdAt ?? new Date().toISOString().split("T")[0];
      const hiddenFromBills = existingBill?.hiddenFromBills ?? false;
      const billData: Omit<BillAccount, "id"> = {
        description: invoice.description,
        amount: invoice.amount,
        dueDate: invoice.dueDate,
        status: invoice.status,
        recurrence: "unique",
        creditCardId: invoice.creditCardId,
        creditCardInvoicePeriodKey: invoice.creditCardInvoicePeriodKey,
        source: "credit_card_invoice",
        hiddenFromBills,
        createdAt,
      };

      await setDoc(billRef, billData, { merge: true });

      return {
        id: billId,
        ...billData,
      };
    }),
  );

  return syncedBills;
}

export async function createBillAccount(
  data: BillAccountDto,
): Promise<BillAccount> {
  const billRef = getUserBillAccountsCollection();
  const createdBill = await addDoc(billRef, {
    ...data,
    createdAt: new Date().toISOString().split("T")[0],
  });

  return {
    id: createdBill.id,
    ...data,
    createdAt: new Date().toISOString().split("T")[0],
  };
}

export async function getBillAccounts(): Promise<BillAccount[]> {
  const billRef = getUserBillAccountsCollection();
  const foundBills = await getDocs(billRef);

  return foundBills.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as BillAccount[];
}

export async function updateBillAccount(
  id: string,
  data: Partial<BillAccountDto>,
): Promise<BillAccount> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const billRef = doc(db, `users/${user.uid}/billAccounts`, id);
  await updateDoc(billRef, data);

  const updatedBill = await getBillAccounts();
  return updatedBill.find((bill) => bill.id === id) || ({} as BillAccount);
}

export async function deleteBillAccount(id: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const billRef = doc(db, `users/${user.uid}/billAccounts`, id);
  await deleteDoc(billRef);
}

export async function deleteMonthlyBillAccountOccurrence(
  id: string,
): Promise<void> {
  const billRef = doc(getUserBillAccountsCollection(), id);
  const billDoc = await getDoc(billRef);

  if (!billDoc.exists()) throw new Error("Bill not found");

  const bill = {
    id: billDoc.id,
    ...billDoc.data(),
  } as BillAccount;

  if (!bill.recurringSeriesId) {
    await deleteDoc(billRef);
    return;
  }

  const seriesRef = doc(
    getUserMonthlyBillAccountSeriesCollection(),
    bill.recurringSeriesId,
  );
  const seriesDoc = await getDoc(seriesRef);

  if (!seriesDoc.exists()) {
    await deleteDoc(billRef);
    return;
  }

  const recurrenceMonth = bill.recurrenceMonth ?? getMonthKey(bill.dueDate);
  const excludedMonths = new Set(
    (seriesDoc.data()?.excludedMonths ?? []) as string[],
  );
  excludedMonths.add(recurrenceMonth);

  const batch = writeBatch(db);
  batch.update(seriesRef, { excludedMonths: [...excludedMonths].sort() });
  batch.delete(billRef);
  await batch.commit();
}

export async function deleteMonthlyBillAccountSeries(
  seriesId: string,
): Promise<void> {
  const billsRef = getUserBillAccountsCollection();
  const seriesRef = doc(getUserMonthlyBillAccountSeriesCollection(), seriesId);
  const occurrencesSnapshot = await getDocs(
    query(billsRef, where("recurringSeriesId", "==", seriesId)),
  );
  const references = [
    ...occurrencesSnapshot.docs.map((billDoc) => doc(billsRef, billDoc.id)),
    seriesRef,
  ];
  let batch = writeBatch(db);
  let operationCount = 0;

  for (const reference of references) {
    batch.delete(reference);
    operationCount += 1;

    if (operationCount === 450) {
      await batch.commit();
      batch = writeBatch(db);
      operationCount = 0;
    }
  }

  if (operationCount > 0) await batch.commit();
}

export async function hideBillAccountFromList(id: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const billRef = doc(db, `users/${user.uid}/billAccounts`, id);
  await updateDoc(billRef, { hiddenFromBills: true });
}

const LEGACY_BILL_PAYMENT_CATEGORIES = new Set(["contas", "fixes"]);

function isLegacyBillPaymentCandidate(
  bill: BillAccount,
  transaction: Transaction,
): boolean {
  const amountMatches =
    Math.round(transaction.amount * 100) ===
    -Math.abs(Math.round(bill.amount * 100));
  const paymentMethod = transaction.paymentMethod ?? "pix";
  const belongsToAnotherBill = Boolean(
    transaction.billAccountId && transaction.billAccountId !== bill.id,
  );
  const predatesBill = Boolean(
    bill.createdAt && transaction.date && transaction.date < bill.createdAt,
  );

  return (
    !bill.creditCardId &&
    !belongsToAnotherBill &&
    !predatesBill &&
    transaction.description === bill.description &&
    amountMatches &&
    transaction.type === "expense" &&
    paymentMethod === "pix" &&
    LEGACY_BILL_PAYMENT_CATEGORIES.has(transaction.category)
  );
}

function dateDistanceInDays(date: string, referenceDate: string): number {
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  const referenceTimestamp = Date.parse(`${referenceDate}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || !Number.isFinite(referenceTimestamp)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.abs(timestamp - referenceTimestamp) / (24 * 60 * 60 * 1000);
}

export function getLegacyBillPaymentCandidates(
  bill: BillAccount,
  transactions: Transaction[],
): Transaction[] {
  if (bill.creditCardId || bill.paymentTransactionId) return [];

  return transactions
    .filter((transaction) => isLegacyBillPaymentCandidate(bill, transaction))
    .sort((a, b) => {
      const distanceDifference =
        dateDistanceInDays(a.date, bill.dueDate) -
        dateDistanceInDays(b.date, bill.dueDate);
      if (distanceDifference !== 0) return distanceDifference;
      return b.date.localeCompare(a.date);
    });
}

export async function payBillAccount(
  id: string,
  paymentDate: string,
): Promise<BillAccount> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const bill = (await getBillAccounts()).find((b) => b.id === id);
  if (!bill) throw new Error("Bill not found");

  const batch = writeBatch(db);
  const transactionRef = doc(collection(db, `users/${user.uid}/transactions`));
  const billRef = doc(db, `users/${user.uid}/billAccounts`, id);
  let shouldCreateTransaction = true;
  let existingInvoiceTransactionId: string | undefined;

  const transactionData: TransactionDto = {
    description: bill.description,
    amount: -Math.abs(bill.amount),
    date: paymentDate,
    category: "contas",
    type: "expense",
    paymentMethod: "pix",
    billAccountId: id,
  };

  if (bill.creditCardId) {
    const cardRef = doc(db, `users/${user.uid}/creditCards`, bill.creditCardId);
    const cardDoc = await getDoc(cardRef);
    const cardData = cardDoc.exists()
      ? (cardDoc.data() as UserCreditCard)
      : null;
    const periodKey =
      bill.creditCardInvoicePeriodKey ??
      (cardData &&
      isValidBillingDay(cardData.closingDay) &&
      isValidBillingDay(cardData.dueDay)
        ? getInvoicePeriodKeyForDueDate(
            bill.dueDate,
            cardData.closingDay,
            cardData.dueDay,
          )
        : paymentDate.slice(0, 7));
    const invoicePayment = cardData?.invoices?.[periodKey];

    if (invoicePayment && invoicePayment.amountPaid >= Math.abs(bill.amount)) {
      shouldCreateTransaction = false;
      existingInvoiceTransactionId = invoicePayment.transactionId;
    }

    const invoiceTransactionId =
      existingInvoiceTransactionId ?? transactionRef.id;

    batch.set(
      cardRef,
      {
        bankKey: bill.creditCardId,
        invoices: {
          [periodKey]: {
            amountPaid: Math.abs(bill.amount),
            paidAt: paymentDate,
            transactionId: invoiceTransactionId,
          },
        },
      },
      { merge: true },
    );
  }

  if (shouldCreateTransaction) {
    batch.set(transactionRef, transactionData);
  }

  const paymentTransactionId =
    existingInvoiceTransactionId ?? transactionRef.id;

  batch.update(billRef, {
    status: "paid",
    paymentTransactionId,
    paidAt: paymentDate,
  });

  await batch.commit();

  return {
    ...bill,
    status: "paid",
    paymentTransactionId,
    paidAt: paymentDate,
  };
}

export type UnpayBillAccountResult = {
  bill: BillAccount;
  removedTransactionIds: string[];
};

export async function unpayBillAccount(
  id: string,
  legacyPaymentTransactionId?: string,
): Promise<UnpayBillAccountResult> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const billRef = doc(db, `users/${user.uid}/billAccounts`, id);
  const linkedLegacyBills = legacyPaymentTransactionId
    ? await getDocs(
        query(
          getUserBillAccountsCollection(),
          where("paymentTransactionId", "==", legacyPaymentTransactionId),
        ),
      )
    : null;
  const isLegacyPaymentLinkedToAnotherBill =
    linkedLegacyBills?.docs.some(
      (currentBillDoc) => currentBillDoc.id !== id,
    ) ?? false;
  let result: UnpayBillAccountResult | null = null;

  await runTransaction(db, async (firestoreTransaction) => {
    const billDoc = await firestoreTransaction.get(billRef);
    if (!billDoc.exists()) throw new Error("Bill not found");

    const bill = {
      id: billDoc.id,
      ...billDoc.data(),
    } as BillAccount;
    let paymentTransactionId = bill.paymentTransactionId;
    let cardRef: ReturnType<typeof doc> | null = null;
    let invoicePeriodKey: string | undefined;
    let hasInvoicePayment = false;

    if (bill.creditCardId) {
      cardRef = doc(db, `users/${user.uid}/creditCards`, bill.creditCardId);
      const cardDoc = await firestoreTransaction.get(cardRef);
      const cardData = cardDoc.exists()
        ? (cardDoc.data() as UserCreditCard)
        : null;
      invoicePeriodKey =
        bill.creditCardInvoicePeriodKey ??
        (cardData &&
        isValidBillingDay(cardData.closingDay) &&
        isValidBillingDay(cardData.dueDay)
          ? getInvoicePeriodKeyForDueDate(
              bill.dueDate,
              cardData.closingDay,
              cardData.dueDay,
            )
          : bill.paidAt?.slice(0, 7));
      const invoicePayment = invoicePeriodKey
        ? cardData?.invoices?.[invoicePeriodKey]
        : undefined;

      paymentTransactionId =
        invoicePayment?.transactionId ?? paymentTransactionId;
      hasInvoicePayment =
        cardDoc.exists() && Boolean(invoicePeriodKey && invoicePayment);
    }

    if (
      !bill.creditCardId &&
      !paymentTransactionId &&
      legacyPaymentTransactionId
    ) {
      const legacyTransactionRef = doc(
        db,
        `users/${user.uid}/transactions`,
        legacyPaymentTransactionId,
      );
      const legacyTransactionDoc =
        await firestoreTransaction.get(legacyTransactionRef);
      const legacyTransaction = legacyTransactionDoc.exists()
        ? ({
            id: legacyTransactionDoc.id,
            ...legacyTransactionDoc.data(),
          } as Transaction)
        : null;

      if (
        !legacyTransaction ||
        !isLegacyBillPaymentCandidate(bill, legacyTransaction) ||
        isLegacyPaymentLinkedToAnotherBill
      ) {
        throw new Error("Legacy bill payment transaction is no longer valid");
      }

      paymentTransactionId = legacyPaymentTransactionId;
    }

    if (cardRef && invoicePeriodKey && hasInvoicePayment) {
      firestoreTransaction.update(cardRef, {
        [`invoices.${invoicePeriodKey}`]: deleteField(),
      });
    }

    if (paymentTransactionId) {
      firestoreTransaction.delete(
        doc(db, `users/${user.uid}/transactions`, paymentTransactionId),
      );
    }

    firestoreTransaction.update(billRef, {
      status: "pending",
      paymentTransactionId: deleteField(),
      paidAt: deleteField(),
    });

    result = {
      bill: {
        ...bill,
        status: "pending",
        paymentTransactionId: undefined,
        paidAt: undefined,
      },
      removedTransactionIds: paymentTransactionId ? [paymentTransactionId] : [],
    };
  });

  if (!result) throw new Error("Unable to undo bill payment");
  return result;
}
