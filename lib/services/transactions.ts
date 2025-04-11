import { collection, doc, addDoc, getDoc, deleteDoc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase'
import { Transaction } from '../entities/transaction';

export type TransactionDto = {
    description: string
    date: string
    amount: number
    category: string
    type: string
}

const cardsRef = collection(db, "transactions")

export async function createTransaction(data: TransactionDto): Promise<Transaction> {
    const createdCard = await addDoc(cardsRef, data)
    return {
        id: createdCard.id,
        ...data

    }
}
export async function deleteTransaction(id: string): Promise<void> {
    const docRef = doc(db, 'transactions', id)
    await deleteDoc(docRef)

}
export async function getTransaction(): Promise<Transaction[]> {
    const docRef = collection(db, 'transactions')

    const foundCard = await getDocs(docRef)

    return foundCard.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    })) as Transaction[]
}
export async function updateTransaction(id: string, data: Transaction): Promise<Transaction> {
    const docRef = doc(db, 'transactions', id)

    const foundCard = await getDoc(docRef)

    if (!foundCard.exists()) {
        throw new Error("Not found transactions document!")
    }
    const previousData = foundCard.data() as Omit<Transaction, "id">
    await updateDoc(docRef, data)

    const transaction = Object.assign(
        previousData,
        data,
        {
            id: docRef.id
        }
    )
    return transaction
}