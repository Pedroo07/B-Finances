import { db } from "@/lib/firebaseAdmin";

export type InvestmentYield = {
  id: string;
  value: number;
  date: string;
};

export type InvestmentDto = {
  category: string;
  balance: number;
  liquidez: "imediata" | "longo_prazo";
  created_at: string;
  rendimentos: InvestmentYield[];
  total_yield: number;
  rescued_amount?: number;
};

export type Investment = InvestmentDto & {
  id: string;
};

export async function getInvestments(userId: string): Promise<Investment[]> {
  const snapshot = await db
    .collection(`users/${userId}/investments`)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Investment[];
}

export async function createInvestment(
  userId: string,
  data: InvestmentDto
): Promise<Investment> {
  const docRef = await db
    .collection(`users/${userId}/investments`)
    .add(data);

  return {
    id: docRef.id,
    ...data,
  };
}

export async function redeemInvestmentBalance(
  userId: string,
  investmentId: string,
  amount: number
): Promise<Investment> {
  const investmentRef = db.collection(`users/${userId}/investments`).doc(investmentId);
  const investmentDoc = await investmentRef.get();

  if (!investmentDoc.exists) {
    throw new Error("Investimento não encontrado!");
  }

  const investment = investmentDoc.data() as Investment;

  if (investment.balance < amount) {
    throw new Error("Saldo insuficiente para resgate!");
  }

  const newBalance = investment.balance - amount;
  const newRescuedAmount = (investment.rescued_amount || 0) + amount;

  await investmentRef.update({
    balance: newBalance,
    rescued_amount: newRescuedAmount,
  });

  return {
    ...investment,
    balance: newBalance,
    rescued_amount: newRescuedAmount,
  };
}

export async function getInvestmentByCategory(
  userId: string,
  category: string
): Promise<Investment | null> {
  const snapshot = await db
    .collection(`users/${userId}/investments`)
    .where("category", "==", category)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as Investment;
}

export async function getTotalInvested(userId: string): Promise<number> {
  const investments = await getInvestments(userId);
  return investments.reduce((total, inv) => total + (inv.balance || 0), 0);
}
