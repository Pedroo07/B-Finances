import { collection, doc, addDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase'
import { CardTransaction } from '../entities/cardTransaction';

export type CardTransactionDto = {
    description: string
    method: string
    date: string
    amount: number
}

const cardsRef = collection(db, "cardTransactions")

export async function createCardTransaction(data: CardTransactionDto): Promise<CardTransaction> {
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
export async function getCardTransaction(): Promise<CardTransaction[]> {
     const docRef = collection(db, 'cardTransactions')
    
        const foundCard = await getDocs(docRef)
    
        return foundCard.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as CardTransaction[]
    }

