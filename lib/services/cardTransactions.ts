import { collection, doc, addDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { CardTransaction } from '../entities/cardTransaction';
import { getAuth } from 'firebase/auth';

export type CardTransactionDto = {
  description: string;
  category: string;
  date: string;
  amount: number;
  card: string;
};

const auth = getAuth();

function getUserCardCollection() {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  return collection(db, `users/${user.uid}/cardTransactions`);
}

export async function createCardTransaction(data: CardTransactionDto): Promise<CardTransaction> {
  const cardsRef = getUserCardCollection();
  const createdCard = await addDoc(cardsRef, data);
  return {
    id: createdCard.id,
    ...data,
  };
}

export async function deleteCardTransaction(id: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  const docRef = doc(db, `users/${user.uid}/cardTransactions`, id);
  await deleteDoc(docRef);
}

export async function getCardTransaction(): Promise<CardTransaction[]> {
  const cardsRef = getUserCardCollection();
  const foundCard = await getDocs(cardsRef);

  return foundCard.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as CardTransaction[];
}

