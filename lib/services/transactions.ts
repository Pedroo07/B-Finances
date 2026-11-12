import {
  collection,
  doc,
  addDoc,
  getDoc,
  deleteDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import { Transaction } from "../entities/transaction";
import { getAuth } from "firebase/auth";
import { getCachedData, invalidateCachedData, setCachedData } from "./clientCache";

export type TransactionDto = {
  description: string;
  date: string;
  amount: number;
  category: string;
  type: string;
  paymentMethod: string;
  billAccountId?: string;
};
const auth = getAuth();

function getUserCollection() {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  return collection(db, `users/${user.uid}/transactions`);
}

export async function createTransaction(
  data: TransactionDto,
): Promise<Transaction> {
  const user = auth.currentUser;
  const cardsRef = getUserCollection();
  const createdCard = await addDoc(cardsRef, data);
  const created: Transaction = {
    id: createdCard.id,
    ...data,
  };
  const cached = getCachedData<Transaction[]>("transactions", user?.uid);
  if (cached) {
    setCachedData("transactions", [created, ...cached], user?.uid);
  } else {
    invalidateCachedData("transactions", user?.uid);
  }
  return created;
}
export async function deleteTransaction(id: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const docRef = doc(db, `users/${user.uid}/transactions`, id);
  await deleteDoc(docRef);
  const cached = getCachedData<Transaction[]>("transactions", user.uid);
  if (cached) {
    setCachedData(
      "transactions",
      cached.filter((item) => item.id !== id),
      user.uid,
    );
  } else {
    invalidateCachedData("transactions", user.uid);
  }
}

export async function getTransaction(): Promise<Transaction[]> {
  const user = auth.currentUser;
  const cardsRef = getUserCollection();
  if (!cardsRef) return [];
  const foundCard = await getDocs(cardsRef);

  const items = foundCard.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      paymentMethod: data.paymentMethod ?? "pix",
    };
  }) as Transaction[];

  setCachedData("transactions", items, user?.uid);
  return items;
}

export async function updateTransaction(
  id: string,
  data: Transaction,
): Promise<Transaction> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const docRef = doc(db, `users/${user.uid}/transactions`, id);
  const foundCard = await getDoc(docRef);

  if (!foundCard.exists()) {
    throw new Error("Trasaction not found!");
  }

  const previousData = foundCard.data() as Omit<Transaction, "id">;
  await updateDoc(docRef, data);

  const updated: Transaction = {
    ...previousData,
    ...data,
    id: docRef.id,
  };
  const cached = getCachedData<Transaction[]>("transactions", user.uid);
  if (cached) {
    setCachedData(
      "transactions",
      cached.map((item) => (item.id === id ? updated : item)),
      user.uid,
    );
  } else {
    invalidateCachedData("transactions", user.uid);
  }
  return updated;
}
