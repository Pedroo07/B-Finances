import { db } from "@/lib/firebaseAdmin";
import { buildInstallmentSchedule } from "@/lib/creditCards/installments";

export type CardTransactionDto = {
  description: string;
  category: string;
  date: string;
  amount: number;
  card: string;
  installmentGroupId?: string;
  installmentNumber?: number;
  installmentCount?: number;
};

export type CardTransaction = CardTransactionDto & {
  id: string;
};

export type CardInstallmentTransactionDto = {
  description: string;
  category: string;
  purchaseDate: string;
  totalAmount: number;
  card: string;
  installmentCount: number;
};

export async function createCardTransaction(
  userId: string,
  data: CardTransactionDto
): Promise<CardTransaction> {
  const docRef = await db
    .collection(`users/${userId}/cardTransactions`)
    .add(data);

  return {
    id: docRef.id,
    ...data,
  };
}

export async function createCardInstallmentTransactions(
  userId: string,
  data: CardInstallmentTransactionDto,
): Promise<CardTransaction[]> {
  const schedule = buildInstallmentSchedule(data);
  const collection = db.collection(`users/${userId}/cardTransactions`);
  const batch = db.batch();
  const firstRef = collection.doc();
  const transactionRefs = schedule.map((_, index) =>
    index === 0 ? firstRef : collection.doc()
  );
  const installmentGroupId = firstRef.id;

  const transactions = schedule.map((installment, index) => {
    const transaction: CardTransactionDto = {
      description: data.description,
      category: data.category,
      date: installment.date,
      amount: -installment.amount,
      card: data.card,
      installmentGroupId,
      installmentNumber: installment.installmentNumber,
      installmentCount: installment.installmentCount,
    };

    batch.set(transactionRefs[index], transaction);
    return { id: transactionRefs[index].id, ...transaction };
  });

  await batch.commit();
  return transactions;
}

export async function getCardTransactions(
  userId: string
): Promise<CardTransaction[]> {
  const snapshot = await db
    .collection(`users/${userId}/cardTransactions`)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as CardTransaction[];
}

export async function getCardTransactionsByCard(
  userId: string,
  card: string,
  startDate?: string,
  endDate?: string
): Promise<CardTransaction[]> {
  let query = db
    .collection(`users/${userId}/cardTransactions`)
    .where("card", "==", card);

  if (startDate) {
    query = query.where("date", ">=", startDate);
  }
  if (endDate) {
    query = query.where("date", "<=", endDate);
  }

  const snapshot = await query.get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as CardTransaction[];
}

export async function deleteCardTransaction(
  userId: string,
  transactionId: string
): Promise<void> {
  await db
    .collection(`users/${userId}/cardTransactions`)
    .doc(transactionId)
    .delete();
}

export async function findCardTransactionByDescription(
  userId: string,
  description: string,
  daysBack: number = 30
): Promise<CardTransaction[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const startDateStr = startDate.toISOString().split("T")[0];

  const snapshot = await db
    .collection(`users/${userId}/cardTransactions`)
    .where("date", ">=", startDateStr)
    .get();

  const descLower = description.toLowerCase();

  return snapshot.docs
    .filter((doc) => {
      const data = doc.data();
      return data.description?.toLowerCase().includes(descLower);
    })
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as CardTransaction[];
}
