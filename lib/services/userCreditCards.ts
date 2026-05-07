import { collection, deleteDoc, doc, getDocs, setDoc, writeBatch } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '../firebase'
import { CreditCardInvoicePayment, UserCreditCard } from '../entities/userCreditCard'
import { Transaction } from '../entities/transaction'

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
  const data = { bankKey, invoices: {} }

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

export async function deleteUserCreditCard(bankKey: string): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error("User not authenticated")

  const cardRef = doc(db, `users/${user.uid}/creditCards`, bankKey)
  await deleteDoc(cardRef)
}

export type PayCreditCardInvoiceDto = {
  bankKey: string
  periodKey: string
  amountPaid: number
  paidAt: string
}

export async function payCreditCardInvoice(data: PayCreditCardInvoiceDto): Promise<{
  card: UserCreditCard
  transaction: Transaction
}> {
  const user = auth.currentUser
  if (!user) throw new Error("User not authenticated")

  const normalizedAmount = Math.abs(data.amountPaid)
  const cardRef = doc(db, `users/${user.uid}/creditCards`, data.bankKey)
  const transactionRef = doc(collection(db, `users/${user.uid}/transactions`))

  const invoicePayment: CreditCardInvoicePayment = {
    amountPaid: normalizedAmount,
    paidAt: data.paidAt,
    transactionId: transactionRef.id,
  }

  const transactionData: Omit<Transaction, 'id'> = {
    description: `Fatura do cartao ${data.bankKey}`,
    date: data.paidAt,
    amount: -normalizedAmount,
    category: 'Credit Card',
    type: 'expense',
  }

  const batch = writeBatch(db)

  batch.set(cardRef, {
    bankKey: data.bankKey,
    invoices: {
      [data.periodKey]: invoicePayment,
    },
  }, { merge: true })

  batch.set(transactionRef, transactionData)

  await batch.commit()

  return {
    card: {
      id: cardRef.id,
      bankKey: data.bankKey,
      invoices: {
        [data.periodKey]: invoicePayment,
      },
    },
    transaction: {
      id: transactionRef.id,
      ...transactionData,
    },
  }
}
