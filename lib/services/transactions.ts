import { collection, doc, addDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase'
import { Transaction } from '../entities/transaction';

type TransactionDto = {
    description: string
    method: string
    date: string
    amount: number
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
export async function getTransaction(id: string): Promise<Transaction> {
    const docRef = doc(db, 'transactions', id)

    const foundCard = await getDoc(docRef)

    if (!foundCard.exists()) {
        throw new Error("Not found card document!")
    }

    const data = foundCard.data() as Omit<Transaction, "id">

    return {
        id: id,
        ...data
    }
}