import { db } from "@/lib/firebaseAdmin";

export type TransactionDto = {
  description: string;
  date: string;
  amount: number;
  category: string;
  type: string;
  paymentMethod: string;
};

export type Transaction = TransactionDto & {
  id: string;
};

export async function createTransaction(
  userId: string,
  data: TransactionDto
): Promise<Transaction> {
  const docRef = await db
    .collection(`users/${userId}/transactions`)
    .add(data);

  return {
    id: docRef.id,
    ...data,
  };
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
  const snapshot = await db
    .collection(`users/${userId}/transactions`)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Transaction[];
}

export async function getTransactionsByPeriod(
  userId: string,
  startDate: string,
  endDate: string
): Promise<Transaction[]> {
  const snapshot = await db
    .collection(`users/${userId}/transactions`)
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Transaction[];
}

export async function getTransactionsByCategory(
  userId: string,
  category: string,
  startDate?: string,
  endDate?: string
): Promise<Transaction[]> {
  let query = db
    .collection(`users/${userId}/transactions`)
    .where("category", "==", category);

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
  })) as Transaction[];
}

export async function deleteTransaction(
  userId: string,
  transactionId: string
): Promise<void> {
  await db
    .collection(`users/${userId}/transactions`)
    .doc(transactionId)
    .delete();
}

export async function findTransactionByDescription(
  userId: string,
  description: string,
  daysBack: number = 30
): Promise<Transaction[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);
  const startDateStr = startDate.toISOString().split("T")[0];

  const snapshot = await db
    .collection(`users/${userId}/transactions`)
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
    })) as Transaction[];
}
