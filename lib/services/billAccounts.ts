import { collection, doc, addDoc, deleteDoc, getDocs, updateDoc, writeBatch, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { BillAccount, BillAccountRecurrence } from '../entities/billAccount'
import { getAuth } from 'firebase/auth'
import { createTransaction, TransactionDto } from './transactions'

const auth = getAuth()

export type BillAccountDto = {
  description: string
  amount: number
  dueDate: string
  status: 'pending' | 'paid'
  recurrence: BillAccountRecurrence
  installments?: number
  currentInstallment?: number
  creditCardId?: string
}

const getInvoicePeriodKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`

function getUserBillAccountsCollection() {
  const user = auth.currentUser
  if (!user) throw new Error('User not authenticated')
  return collection(db, `users/${user.uid}/billAccounts`)
}

export async function createBillAccount(data: BillAccountDto): Promise<BillAccount> {
  const billRef = getUserBillAccountsCollection()
  const createdBill = await addDoc(billRef, {
    ...data,
    createdAt: new Date().toISOString().split('T')[0],
  })

  return {
    id: createdBill.id,
    ...data,
    createdAt: new Date().toISOString().split('T')[0],
  }
}

export async function getBillAccounts(): Promise<BillAccount[]> {
  const billRef = getUserBillAccountsCollection()
  const foundBills = await getDocs(billRef)

  return foundBills.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as BillAccount[]
}

export async function updateBillAccount(id: string, data: Partial<BillAccountDto>): Promise<BillAccount> {
  const user = auth.currentUser
  if (!user) throw new Error('User not authenticated')

  const billRef = doc(db, `users/${user.uid}/billAccounts`, id)
  await updateDoc(billRef, data)

  const updatedBill = await getBillAccounts()
  return updatedBill.find((bill) => bill.id === id) || ({} as BillAccount)
}

export async function deleteBillAccount(id: string): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error('User not authenticated')

  const billRef = doc(db, `users/${user.uid}/billAccounts`, id)
  await deleteDoc(billRef)
}

export async function payBillAccount(id: string, paymentDate: string): Promise<BillAccount> {
  const user = auth.currentUser
  if (!user) throw new Error('User not authenticated')

  const bill = (await getBillAccounts()).find((b) => b.id === id)
  if (!bill) throw new Error('Bill not found')

  const batch = writeBatch(db)
  const transactionRef = doc(collection(db, `users/${user.uid}/transactions`))
  const billRef = doc(db, `users/${user.uid}/billAccounts`, id)

  const transactionData: TransactionDto = {
    description: bill.description,
    amount: -Math.abs(bill.amount),
    date: paymentDate,
    category: 'contas',
    type: 'expense',
    paymentMethod: 'pix',
  }

  batch.set(transactionRef, transactionData)
  batch.update(billRef, { status: 'paid' })

  if (bill.creditCardId) {
    const [year, month, day] = paymentDate.split('-').map(Number)
    const periodKey = getInvoicePeriodKey(year, month)
    const cardRef = doc(db, `users/${user.uid}/creditCards`, bill.creditCardId)

    batch.set(cardRef, {
      bankKey: bill.creditCardId,
      invoices: {
        [periodKey]: {
          amountPaid: Math.abs(bill.amount),
          paidAt: paymentDate,
          transactionId: transactionRef.id,
        },
      },
    }, { merge: true })
  }

  await batch.commit()

  return {
    ...bill,
    status: 'paid',
  }
}
