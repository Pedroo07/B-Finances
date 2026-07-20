import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, writeBatch } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '../firebase'
import { CreditCardInvoicePayment, UserCreditCard } from '../entities/userCreditCard'
import { Transaction } from '../entities/transaction'
import { getInvoiceDueDate, isValidBillingDay } from '../creditCards/billing'
import { getCreditCardName } from '../creditCards/catalog'
import { findCreditCardInvoiceBill, getCreditCardInvoiceBillId } from './billAccounts'

const auth = getAuth()

function getUserCreditCardCollection() {
  const user = auth.currentUser
  if (!user) throw new Error("User not authenticated")
  return collection(db, `users/${user.uid}/creditCards`)
}

export type UserCreditCardBillingDto = {
  closingDay: number
  dueDay: number
}

function assertValidBilling(data: UserCreditCardBillingDto): void {
  if (!isValidBillingDay(data.closingDay) || !isValidBillingDay(data.dueDay)) {
    throw new Error('Credit card billing days must be between 1 and 31')
  }
}

export async function createUserCreditCard(bankKey: string, billing: UserCreditCardBillingDto): Promise<UserCreditCard> {
  const user = auth.currentUser
  if (!user) throw new Error("User not authenticated")

  assertValidBilling(billing)

  const cardRef = doc(db, `users/${user.uid}/creditCards`, bankKey)
  const data = { bankKey, closingDay: billing.closingDay, dueDay: billing.dueDay, invoices: {} }

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

export async function updateUserCreditCardBilling(bankKey: string, billing: UserCreditCardBillingDto): Promise<UserCreditCard> {
  const user = auth.currentUser
  if (!user) throw new Error("User not authenticated")

  assertValidBilling(billing)

  const cardRef = doc(db, `users/${user.uid}/creditCards`, bankKey)
  const data = {
    bankKey,
    closingDay: billing.closingDay,
    dueDay: billing.dueDay,
  }

  await setDoc(cardRef, data, { merge: true })

  return {
    id: cardRef.id,
    ...data,
  }
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
  const cardDoc = await getDoc(cardRef)
  const cardData = cardDoc.exists() ? cardDoc.data() as UserCreditCard : null
  const existingInvoiceBill = await findCreditCardInvoiceBill(data.bankKey, data.periodKey)
  const invoiceBillId = existingInvoiceBill?.id ?? getCreditCardInvoiceBillId(data.bankKey, data.periodKey)
  const invoiceBillRef = doc(db, `users/${user.uid}/billAccounts`, invoiceBillId)
  const transactionRef = doc(collection(db, `users/${user.uid}/transactions`))

  const invoicePayment: CreditCardInvoicePayment = {
    amountPaid: normalizedAmount,
    paidAt: data.paidAt,
    transactionId: transactionRef.id,
  }

  const transactionData: Omit<Transaction, 'id'> = {
    description: `Fatura do cartao ${getCreditCardName(data.bankKey)}`,
    date: data.paidAt,
    amount: -normalizedAmount,
    category: 'Credit Card',
    type: 'expense',
    paymentMethod: 'pix',
    billAccountId: invoiceBillId,
  }

  const batch = writeBatch(db)

  batch.set(cardRef, {
    bankKey: data.bankKey,
    invoices: {
      [data.periodKey]: invoicePayment,
    },
  }, { merge: true })

  batch.set(transactionRef, transactionData)

  const invoiceBillDueDate = cardData
    && isValidBillingDay(cardData.closingDay)
    && isValidBillingDay(cardData.dueDay)
    ? getInvoiceDueDate(data.periodKey, cardData.closingDay, cardData.dueDay)
    : null

  batch.set(invoiceBillRef, {
    description: existingInvoiceBill?.description ?? transactionData.description,
    amount: normalizedAmount,
    ...(invoiceBillDueDate && {
      dueDate: invoiceBillDueDate,
    }),
    status: 'paid',
    recurrence: 'unique',
    creditCardId: data.bankKey,
    creditCardInvoicePeriodKey: data.periodKey,
    source: 'credit_card_invoice',
    hiddenFromBills: existingInvoiceBill?.hiddenFromBills ?? false,
    paymentTransactionId: transactionRef.id,
    paidAt: data.paidAt,
    createdAt: existingInvoiceBill?.createdAt ?? new Date().toISOString().split('T')[0],
  }, { merge: true })

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
