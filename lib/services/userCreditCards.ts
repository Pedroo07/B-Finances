import { collection, doc, getDocs, setDoc } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '../firebase'
import { UserCreditCard } from '../entities/userCreditCard'

const auth = getAuth()

function getUserCreditCardCollection() {
  const user = auth.currentUser
  if (!user) throw new Error("User not authenticated")
  return collection(db, `users/${user.uid}/creditCards`)
}

export async function createUserCreditCard(bankKey: string): Promise<UserCreditCard> {
  const user = auth.currentUser
  if (!user) throw new Error("User not authenticated")

  const cardRef = doc(db, `users/${user.uid}/creditCards`, bankKey)
  const data = { bankKey }

  await setDoc(cardRef, data)

  return {
    id: cardRef.id,
    ...data,
  }
}

export async function getUserCreditCards(): Promise<UserCreditCard[]> {
  const cardsRef = getUserCreditCardCollection()
  const foundCards = await getDocs(cardsRef)

  return foundCards.docs.map((cardDoc) => ({
    id: cardDoc.id,
    ...cardDoc.data(),
  })) as UserCreditCard[]
}
