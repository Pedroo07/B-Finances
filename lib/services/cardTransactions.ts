import { collection, doc, addDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase'
import { CardTransaction } from '../entities/cardTransaction';

type CreateCardTransactionDto = {
    description: string
    method: string
    date: string
    amount: number
}

const cardsRef = collection(db, "cardTransactions")

export async function createCardTransaction(data: CreateCardTransactionDto): Promise<CardTransaction> {
    const createdCard = await addDoc(cardsRef, data)
    return {
        id: createdCard.id,
        ...data

    }
}
export async function deleteCardTransaction(id: string): Promise<void> {
    const docRef = doc(db, 'cardTransactions', id)
    await deleteDoc(docRef)

}
export async function getCardTransaction(id: string): Promise<CardTransaction> {
    const docRef = doc(db, 'cardTransactions', id)

    const foundCard = await getDoc(docRef)

    if (!foundCard.exists()) {
        throw new Error("Not found card document!")
    }

    const data = foundCard.data() as Omit<CardTransaction, "id">

    return {
        id: id,
        ...data
    }
}

