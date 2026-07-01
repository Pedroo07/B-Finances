import { db } from "@/lib/firebaseAdmin";
import { getCardTransactionsByCard } from "./cardTransactionsAdmin";

export type CreditCardInvoicePayment = {
  amountPaid: number;
  paidAt: string;
  transactionId: string;
};

export type UserCreditCard = {
  id: string;
  bankKey: string;
  invoices: Record<string, CreditCardInvoicePayment>;
};

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

export async function getCardInvoiceAmount(
  userId: string,
  cardName: string,
  year: number,
  month: number
): Promise<number> {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${endDay}`;

  const transactions = await getCardTransactionsByCard(
    userId,
    cardName,
    startDate,
    endDate
  );

  const total = transactions.reduce(
    (sum, transaction) => sum + Math.abs(transaction.amount),
    0
  );

  const periodKey = `${year}-${String(month).padStart(2, "0")}`;
  const cardDoc = await db
    .collection(`users/${userId}/creditCards`)
    .doc(cardName)
    .get();

  if (cardDoc.exists) {
    const cardData = cardDoc.data() as UserCreditCard;
    const payment = cardData.invoices?.[periodKey];
    if (payment) {
      return total - payment.amountPaid;
    }
  }

  return total;
}

export async function payCardInvoice(
  userId: string,
  cardName: string,
  amount: number,
  paymentDate: string
): Promise<void> {
  const [year, month] = paymentDate.split("-").map(Number);
  const periodKey = `${year}-${String(month).padStart(2, "0")}`;

  const transactionRef = await db
    .collection(`users/${userId}/transactions`)
    .add({
      description: `Fatura do cartão ${cardName}`,
      date: paymentDate,
      amount: -Math.abs(amount),
      category: "Credit Card",
      type: "expense",
      paymentMethod: "pix",
    });

  const cardRef = db.collection(`users/${userId}/creditCards`).doc(cardName);
  
  await cardRef.set(
    {
      bankKey: cardName,
      invoices: {
        [periodKey]: {
          amountPaid: Math.abs(amount),
          paidAt: paymentDate,
          transactionId: transactionRef.id,
        },
      },
    },
    { merge: true }
  );
}

export async function getAllCardInvoices(
  userId: string,
  year: number,
  month: number
): Promise<{ cardName: string; amount: number }[]> {
  const cards = await getUserCreditCards(userId);
  const results: { cardName: string; amount: number }[] = [];

  for (const card of cards) {
    const amount = await getCardInvoiceAmount(userId, card.id, year, month);
    if (amount > 0.01) {
      results.push({ cardName: card.id, amount });
    }
  }

  return results;
}

