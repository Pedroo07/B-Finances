import { collection, doc, addDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { CardTransaction } from '../entities/cardTransaction';
import { getAuth } from 'firebase/auth';
import { buildInstallmentSchedule } from '../creditCards/installments';

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

export type CardInstallmentTransactionDto = {
  description: string;
  category: string;
  purchaseDate: string;
  totalAmount: number;
  card: string;
  installmentCount: number;
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

export async function createCardInstallmentTransactions(
  data: CardInstallmentTransactionDto,
): Promise<CardTransaction[]> {
  const schedule = buildInstallmentSchedule(data);
  const cardsRef = getUserCardCollection();
  const batch = writeBatch(db);
  const firstRef = doc(cardsRef);
  const transactionRefs = schedule.map((_, index) => index === 0 ? firstRef : doc(cardsRef));
  const installmentGroupId = firstRef.id;

  const transactions = schedule.map((installment, index) => {
    const transaction: Omit<CardTransaction, 'id'> = {
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

    return {
      id: transactionRefs[index].id,
      ...transaction,
    };
  });

  await batch.commit();
  return transactions;
}

export async function deleteCardTransaction(id: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  const docRef = doc(db, `users/${user.uid}/cardTransactions`, id);
  await deleteDoc(docRef);
}

export async function deleteCardTransactions(ids: string[]): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");

  const uniqueIds = [...new Set(ids)];
  const batch = writeBatch(db);
  uniqueIds.forEach((id) => {
    batch.delete(doc(db, `users/${user.uid}/cardTransactions`, id));
  });
  await batch.commit();
}

export async function getCardTransaction(): Promise<CardTransaction[]> {
  const cardsRef = getUserCardCollection();
  const foundCard = await getDocs(cardsRef);

  return foundCard.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as CardTransaction[];
}

