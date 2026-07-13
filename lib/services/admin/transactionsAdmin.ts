import { db } from "@/lib/firebaseAdmin";
import type {
  DocumentData,
  DocumentSnapshot,
  Query,
} from "firebase-admin/firestore";
import { getBrasiliaDate } from "@/lib/whatsapp/utils/brasiliaDate";

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
  createdAt?: string;
};

function mapTransactionSnapshot(
  snapshot: DocumentSnapshot<DocumentData>,
): Transaction {
  const data = snapshot.data();
  if (!data) {
    throw new Error(`Transação ${snapshot.id} não encontrada.`);
  }

  return {
    ...data,
    id: snapshot.id,
    createdAt: snapshot.createTime?.toDate().toISOString(),
  } as Transaction;
}

export async function createTransaction(
  userId: string,
  data: TransactionDto
): Promise<Transaction> {
  const docRef = await db
    .collection(`users/${userId}/transactions`)
    .add(data);

  return mapTransactionSnapshot(await docRef.get());
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
  const snapshot = await db
    .collection(`users/${userId}/transactions`)
    .get();

  return snapshot.docs.map(mapTransactionSnapshot);
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

  return snapshot.docs.map(mapTransactionSnapshot);
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

  return snapshot.docs.map(mapTransactionSnapshot);
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

export async function updateTransaction(
  userId: string,
  transactionId: string,
  data: Partial<TransactionDto>,
): Promise<void> {
  await db
    .collection(`users/${userId}/transactions`)
    .doc(transactionId)
    .update(data);
}

export async function findTransactionByDescription(
  userId: string,
  description: string,
  daysBack: number = 30
): Promise<Transaction[]> {
  const startDate = getBrasiliaDate();
  startDate.setDate(startDate.getDate() - daysBack);
  const startDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;

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
    .map(mapTransactionSnapshot);
}

export async function getRecentTransactions(
  userId: string,
  limit: number,
  type?: "income" | "expense",
  categoryFilter?: string,
  startDate?: string,
  endDate?: string
): Promise<Transaction[]> {
  let query: Query<DocumentData> = db.collection(`users/${userId}/transactions`);

  if (startDate) query = query.where("date", ">=", startDate);
  if (endDate) query = query.where("date", "<=", endDate);
  if (type) query = query.where("type", "==", type);
  if (categoryFilter) query = query.where("category", "==", categoryFilter);

  const snapshot = await query.get();

  return snapshot.docs
    .map(mapTransactionSnapshot)
    .sort((a, b) => {
      const createdAtCompare = (b.createdAt ?? "").localeCompare(
        a.createdAt ?? "",
      );
      if (createdAtCompare !== 0) return createdAtCompare;
      return b.date.localeCompare(a.date);
    })
    .slice(0, limit);
}

export async function getTransactionsByPeriodAndCategory(
  userId: string,
  startDate: string,
  endDate: string,
  category: string
): Promise<Transaction[]> {
  const snapshot = await db
    .collection(`users/${userId}/transactions`)
    .where("date", ">=", startDate)
    .where("date", "<=", endDate)
    .where("category", "==", category)
    .get();

  return snapshot.docs.map(mapTransactionSnapshot);
}

