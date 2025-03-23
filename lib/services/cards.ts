import { collection, doc, addDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase'
import { Card } from '../entities/card';

type CreateCardDto = {
    name: string
}

const cardsRef = collection(db, "cards")

export async function createCard(data: CreateCardDto): Promise<Card> {
    const createdCard = await addDoc(cardsRef, data)
    return {
        id: createdCard.id,
        ...data

    }
}
export async function deleteCard(id: string): Promise<void> {
    const docRef = doc(db, 'cards', id)
    await deleteDoc(docRef)

}
export async function getCard(id: string): Promise<Card> {
    const docRef = doc(db, 'cards', id)

    const foundCard = await getDoc(docRef)

    if (!foundCard.exists()) {
        throw new Error("Not found card document!")
    }

    const data = foundCard.data() as Omit<Card, "id">

    return {
        id: id,
        ...data
    }
}

