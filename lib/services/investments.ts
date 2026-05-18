import { collection, doc, addDoc, deleteDoc, getDocs, updateDoc, getDoc, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { Investment, InvestmentYield } from '../entities/investment'
import { getAuth } from 'firebase/auth'

export type InvestmentDto = {
  category: string
  balance: number
  liquidez: 'imediata' | 'longo_prazo'
  created_at: string
  rendimentos: InvestmentYield[]
  total_yield: number
  rescued_amount?: number
}

const auth = getAuth()

function getUserCollection() {
  const user = auth.currentUser
  if (!user) throw new Error("User not authenticated")
  return collection(db, `users/${user.uid}/investments`)
}

async function findInvestmentByCategory(category: string): Promise<Investment | null> {
  const user = auth.currentUser
  if (!user) throw new Error("User not authenticated")

  const ref = collection(db, `users/${user.uid}/investments`)
  const q = query(ref, where("category", "==", category))
  const snapshot = await getDocs(q)

  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  return {
    id: doc.id,
    ...doc.data(),
  } as Investment
}

export async function createInvestment(data: InvestmentDto): Promise<Investment> {
  const existing = await findInvestmentByCategory(data.category)

  if (existing) {
    const updated = await updateInvestment(existing.id, {
      ...existing,
      balance: existing.balance + data.balance,
      rendimentos: [...existing.rendimentos, ...data.rendimentos]
    })
    return updated
  }

  const ref = getUserCollection()
  const created = await addDoc(ref, data)
  return {
    id: created.id,
    ...data
  }
}

export async function getInvestments(): Promise<Investment[]> {
  const ref = getUserCollection()
  if (!ref) return []
  const snapshot = await getDocs(ref)

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Investment[]
}

export async function updateInvestment(id: string, data: Partial<Investment>): Promise<Investment> {
  const user = auth.currentUser
  if (!user) throw new Error("User not authenticated")

  const docRef = doc(db, `users/${user.uid}/investments`, id)
  const snapshot = await getDoc(docRef)

  if (!snapshot.exists()) {
    throw new Error("Investment not found!")
  }

  const previousData = snapshot.data() as Omit<Investment, "id">
  await updateDoc(docRef, data)

  return {
    ...previousData,
    ...data,
    id: docRef.id,
  }
}

export async function deleteInvestment(id: string): Promise<void> {
  const user = auth.currentUser
  if (!user) throw new Error("User not authenticated")

  const docRef = doc(db, `users/${user.uid}/investments`, id)
  await deleteDoc(docRef)
}

export async function addInvestmentYield(investmentId: string, yield_value: number, date: string): Promise<Investment> {
  const user = auth.currentUser
  if (!user) throw new Error("User not authenticated")

  const docRef = doc(db, `users/${user.uid}/investments`, investmentId)
  const snapshot = await getDoc(docRef)

  if (!snapshot.exists()) {
    throw new Error("Investment not found!")
  }

  const investment = snapshot.data() as Investment
  const newYield: InvestmentYield = {
    id: Math.random().toString(36).substr(2, 9),
    value: yield_value,
    date: date
  }

  const updatedRendimentos = [...(investment.rendimentos || []), newYield]
  const totalYield = (investment.total_yield || 0) + yield_value
  const newBalance = (investment.balance || 0) + yield_value

  await updateDoc(docRef, {
    rendimentos: updatedRendimentos,
    total_yield: totalYield,
    balance: newBalance
  })

  return {
    ...investment,
    rendimentos: updatedRendimentos,
    total_yield: totalYield,
    balance: newBalance
  }
}

export async function redeemInvestmentBalance(investmentId: string, amount: number): Promise<Investment> {
  const user = auth.currentUser
  if (!user) throw new Error("User not authenticated")

  const docRef = doc(db, `users/${user.uid}/investments`, investmentId)
  const snapshot = await getDoc(docRef)

  if (!snapshot.exists()) {
    throw new Error("Investment not found!")
  }

  const investment = snapshot.data() as Investment
  if ((investment.balance || 0) < amount) {
    throw new Error("Saldo insuficiente para resgate")
  }

  const newBalance = (investment.balance || 0) - amount
  const newRescuedAmount = (investment.rescued_amount || 0) + amount

  await updateDoc(docRef, {
    balance: newBalance,
    rescued_amount: newRescuedAmount
  })

  return {
    ...investment,
    balance: newBalance,
    rescued_amount: newRescuedAmount
  }
}


