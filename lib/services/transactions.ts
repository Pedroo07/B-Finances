import { collection, doc, addDoc, getDoc, deleteDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase'
import { Transaction } from '../entities/transaction';
import { getAuth } from 'firebase/auth';

export type TransactionDto = {
    description: string
    date: string
    amount: number
    category: string
    type: string
}
const auth = getAuth()

function getUserCollection() {
const user = auth.currentUser
 if (!user) throw new Error("User not authenticated");
 return collection(db, `users/${user.uid}/transactions`)
}

export async function createTransaction(data: TransactionDto): Promise<Transaction> {
    const cardsRef = getUserCollection()
    const createdCard = await addDoc(cardsRef, data)
    return {
        id: createdCard.id,
        ...data

    }
}
export async function deleteTransaction(id: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const docRef = doc(db, `users/${user.uid}/transactions`, id);
  await deleteDoc(docRef);
}

export async function getTransaction(): Promise<Transaction[]> {
  const cardsRef = getUserCollection();
  if (!cardsRef) return [];
  const foundCard = await getDocs(cardsRef);

  return foundCard.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Transaction[];
}

export async function updateTransaction(id: string, data: Transaction): Promise<Transaction> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const docRef = doc(db, `users/${user.uid}/transactions`, id);
  const foundCard = await getDoc(docRef);

  if (!foundCard.exists()) {
    throw new Error("Trasaction not found!");
  }

  const previousData = foundCard.data() as Omit<Transaction, "id">;
  await updateDoc(docRef, data);

  return {
    ...previousData,
    ...data,
    id: docRef.id,
  };
}