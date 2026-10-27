import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";
import {
  CreditCardInvoicePayment,
  UserCreditCard,
} from "../entities/userCreditCard";
import { Transaction } from "../entities/transaction";
import { getInvoiceDueDate, isValidBillingDay } from "../creditCards/billing";
import { getCreditCardBankKey, getCreditCardName } from "../creditCards/catalog";
import {
  appendInvoicePayment,
  buildInvoicePaymentEntry,
  computeInvoiceBalance,
} from "../creditCards/invoiceBalance";
import {
  findCreditCardInvoiceBill,
  getCreditCardInvoiceBillId,
} from "./billAccounts";
import { markCardTransactionsAsPaid } from "./cardTransactions";

const auth = getAuth();

function getUserCreditCardCollection() {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  return collection(db, `users/${user.uid}/creditCards`);
}

export type UserCreditCardBillingDto = {
  closingDay: number;
  dueDay: number;
};

function assertValidBilling(data: UserCreditCardBillingDto): void {
  if (!isValidBillingDay(data.closingDay) || !isValidBillingDay(data.dueDay)) {
    throw new Error("Credit card billing days must be between 1 and 31");
  }
}

async function hydrateInvoicesFromHistory(
  userId: string,
  bankKey: string,
  existingInvoices: Record<string, CreditCardInvoicePayment>,
): Promise<Record<string, CreditCardInvoicePayment>> {
  const mergedInvoices: Record<string, CreditCardInvoicePayment> = {
    ...existingInvoices,
  };

  try {
    // 1. Inspeciona billAccounts pagas deste cartão
    const billsRef = collection(db, `users/${userId}/billAccounts`);
    const billsSnap = await getDocs(
      query(
        billsRef,
        where("creditCardId", "==", bankKey),
        where("status", "==", "paid"),
      ),
    );

    for (const bDoc of billsSnap.docs) {
      const bData = bDoc.data();
      const periodKey = bData.creditCardInvoicePeriodKey;
      if (periodKey && !mergedInvoices[periodKey]) {
        const amount = Number(bData.amount) || 0;
        const paidAt =
          bData.paidAt ||
          bData.dueDate ||
          new Date().toISOString().split("T")[0];
        const txId = bData.paymentTransactionId || bDoc.id;
        mergedInvoices[periodKey] = {
          amountPaid: amount,
          paidAt,
          transactionId: txId,
          payments: [
            {
              id: bDoc.id,
              amount,
              paidAt,
              transactionId: txId,
            },
          ],
        };
      }
    }

    // 2. Inspeciona cardTransactions pagas deste cartão
    const cardTxRef = collection(db, `users/${userId}/cardTransactions`);
    const cardTxSnap = await getDocs(cardTxRef);

    const paidTxByPeriod: Record<
      string,
      { total: number; paidAt: string; txId: string }
    > = {};
    for (const txDoc of cardTxSnap.docs) {
      const txData = txDoc.data();
      if (
        getCreditCardBankKey(txData.card) === bankKey &&
        txData.invoicePaid &&
        txData.invoicePeriodKey
      ) {
        const pk = txData.invoicePeriodKey;
        if (!paidTxByPeriod[pk]) {
          paidTxByPeriod[pk] = {
            total: 0,
            paidAt:
              txData.invoicePaidAt || new Date().toISOString().split("T")[0],
            txId: txData.invoicePaymentTransactionId || txDoc.id,
          };
        }
        paidTxByPeriod[pk].total += Math.abs(Number(txData.amount) || 0);
      }
    }

    for (const [pk, summary] of Object.entries(paidTxByPeriod)) {
      if (!mergedInvoices[pk]) {
        mergedInvoices[pk] = {
          amountPaid: summary.total,
          paidAt: summary.paidAt,
          transactionId: summary.txId,
          payments: [
            {
              id: summary.txId,
              amount: summary.total,
              paidAt: summary.paidAt,
              transactionId: summary.txId,
            },
          ],
        };
      }
    }
  } catch (err) {
    console.warn("Could not hydrate invoices from history:", err);
  }

  return mergedInvoices;
}

export async function createUserCreditCard(
  bankKey: string,
  billing: UserCreditCardBillingDto,
): Promise<UserCreditCard> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  assertValidBilling(billing);

  const cardRef = doc(db, `users/${user.uid}/creditCards`, bankKey);
  const existingCard = await getDoc(cardRef);
  let existingInvoices = existingCard.exists()
    ? ((existingCard.data() as UserCreditCard).invoices ?? {})
    : {};

  // Auto-recupera histórico de faturas pagas caso invoices esteja vazio/incompleto
  existingInvoices = await hydrateInvoicesFromHistory(
    user.uid,
    bankKey,
    existingInvoices,
  );

  const data = {
    bankKey,
    closingDay: billing.closingDay,
    dueDay: billing.dueDay,
    invoices: existingInvoices,
  };

  await setDoc(cardRef, { ...data, removed: false }, { merge: true });

  return {
    id: cardRef.id,
    ...data,
  };
}

export async function getUserCreditCards(): Promise<UserCreditCard[]> {
  const cardsRef = getUserCreditCardCollection();
  const foundCards = await getDocs(cardsRef);
  const user = auth.currentUser;

  const cards = (
    foundCards.docs.map((cardDoc) => ({
      id: cardDoc.id,
      ...cardDoc.data(),
    })) as UserCreditCard[]
  ).filter((card) => !card.removed);

  if (user) {
    for (const card of cards) {
      const currentInvoices = card.invoices ?? {};
      const hydrated = await hydrateInvoicesFromHistory(
        user.uid,
        card.bankKey,
        currentInvoices,
      );
      if (Object.keys(hydrated).length > Object.keys(currentInvoices).length) {
        card.invoices = hydrated;
        const cardRef = doc(db, `users/${user.uid}/creditCards`, card.bankKey);
        setDoc(cardRef, { invoices: hydrated }, { merge: true }).catch(
          () => {},
        );
      }
    }
  }

  return cards;
}

export async function updateUserCreditCardBilling(
  bankKey: string,
  billing: UserCreditCardBillingDto,
): Promise<UserCreditCard> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  assertValidBilling(billing);

  const cardRef = doc(db, `users/${user.uid}/creditCards`, bankKey);
  const data = {
    bankKey,
    closingDay: billing.closingDay,
    dueDay: billing.dueDay,
  };

  await setDoc(cardRef, data, { merge: true });

  return {
    id: cardRef.id,
    ...data,
  };
}

export async function deleteUserCreditCard(bankKey: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const cardRef = doc(db, `users/${user.uid}/creditCards`, bankKey);
  // Apenas oculta o cartão: o histórico de pagamentos das faturas é mantido.
  await setDoc(cardRef, { removed: true }, { merge: true });
}

export type PayCreditCardInvoiceDto = {
  bankKey: string;
  periodKey: string;
  /** Valor efetivamente pago agora (pode ser parcial). */
  amountPaid: number;
  paidAt: string;
  /** Soma das compras do período (sem saldo rolado). */
  periodPurchases: number;
  /** Juros/encargos opcionais; só valem em pagamento parcial. */
  interest?: number;
};

export async function payCreditCardInvoice(
  data: PayCreditCardInvoiceDto,
): Promise<{
  card: UserCreditCard;
  transaction: Transaction;
}> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const cardRef = doc(db, `users/${user.uid}/creditCards`, data.bankKey);
  const existingInvoiceBill = await findCreditCardInvoiceBill(
    data.bankKey,
    data.periodKey,
  );
  const invoiceBillId =
    existingInvoiceBill?.id ??
    getCreditCardInvoiceBillId(data.bankKey, data.periodKey);
  const invoiceBillRef = doc(
    db,
    `users/${user.uid}/billAccounts`,
    invoiceBillId,
  );
  const transactionRef = doc(collection(db, `users/${user.uid}/transactions`));

  const normalizedAmount = Math.abs(data.amountPaid);
  const cardName = getCreditCardName(data.bankKey);
  let resolvedClosingDay: number | undefined;
  let resolvedDueDay: number | undefined;

  const result = await runTransaction(db, async (firestoreTransaction) => {
    const cardDoc = await firestoreTransaction.get(cardRef);
    const cardData = cardDoc.exists()
      ? (cardDoc.data() as UserCreditCard)
      : null;
    const invoices = cardData?.invoices ?? {};
    resolvedClosingDay = cardData?.closingDay;
    resolvedDueDay = cardData?.dueDay;

    const balance = computeInvoiceBalance({
      purchases: data.periodPurchases,
      invoices,
      periodKey: data.periodKey,
    });
    const entry = buildInvoicePaymentEntry({
      amount: normalizedAmount,
      remaining: balance.remaining,
      paidAt: data.paidAt,
      transactionId: transactionRef.id,
      interest: data.interest,
    });
    const updatedPayment = appendInvoicePayment(
      invoices[data.periodKey],
      entry,
    );
    const isPartial = Boolean(entry.rolledOver);
    const transactionData: Omit<Transaction, "id"> = {
      description: `Fatura do cartao ${cardName}${isPartial ? " (parcial)" : ""}`,
      date: data.paidAt,
      amount: -entry.amount,
      category: "Credit Card",
      type: "expense",
      paymentMethod: "pix",
      billAccountId: invoiceBillId,
    };
    const invoiceBillDueDate =
      cardData &&
      isValidBillingDay(cardData.closingDay) &&
      isValidBillingDay(cardData.dueDay)
        ? getInvoiceDueDate(
            data.periodKey,
            cardData.closingDay,
            cardData.dueDay,
          )
        : null;

    firestoreTransaction.set(
      cardRef,
      {
        bankKey: data.bankKey,
        invoices: { [data.periodKey]: updatedPayment },
      },
      { merge: true },
    );
    firestoreTransaction.set(transactionRef, transactionData);
    firestoreTransaction.set(
      invoiceBillRef,
      {
        description:
          existingInvoiceBill?.description ?? `Fatura do cartao ${cardName}`,
        amount: balance.total,
        ...(invoiceBillDueDate && { dueDate: invoiceBillDueDate }),
        status: "paid",
        recurrence: "unique",
        creditCardId: data.bankKey,
        creditCardInvoicePeriodKey: data.periodKey,
        source: "credit_card_invoice",
        hiddenFromBills: existingInvoiceBill?.hiddenFromBills ?? false,
        paymentTransactionId: transactionRef.id,
        paidAt: data.paidAt,
        createdAt:
          existingInvoiceBill?.createdAt ??
          new Date().toISOString().split("T")[0],
      },
      { merge: true },
    );

    return {
      card: {
        id: cardRef.id,
        bankKey: data.bankKey,
        invoices: { [data.periodKey]: updatedPayment },
      },
      transaction: { id: transactionRef.id, ...transactionData },
    };
  });

  if (
    isValidBillingDay(resolvedClosingDay) &&
    isValidBillingDay(resolvedDueDay)
  ) {
    try {
      await markCardTransactionsAsPaid({
        bankKey: data.bankKey,
        periodKey: data.periodKey,
        paymentTransactionId: transactionRef.id,
        paidAt: data.paidAt,
        closingDay: resolvedClosingDay,
        dueDay: resolvedDueDay,
        periodLabel: `Fatura ${data.periodKey}`,
      });
    } catch (err) {
      console.error("Error marking card transactions as paid:", err);
    }
  }

  return result;
}
