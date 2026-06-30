import { db } from "@/lib/firebaseAdmin";

export type BillAccount = {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  status: "pending" | "paid";
  recurrence: {
    type: "none" | "monthly" | "yearly";
    interval?: number;
  };
  installments?: number;
  currentInstallment?: number;
  creditCardId?: string;
  createdAt: string;
};

export async function getBillAccounts(userId: string): Promise<BillAccount[]> {
  const snapshot = await db
    .collection(`users/${userId}/billAccounts`)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as BillAccount[];
}

export async function getPendingBills(userId: string): Promise<BillAccount[]> {
  const snapshot = await db
    .collection(`users/${userId}/billAccounts`)
    .where("status", "==", "pending")
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as BillAccount[];
}

export async function getUpcomingBills(
  userId: string,
  days: number = 7
): Promise<BillAccount[]> {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);

  const todayStr = today.toISOString().split("T")[0];
  const futureDateStr = futureDate.toISOString().split("T")[0];

  const snapshot = await db
    .collection(`users/${userId}/billAccounts`)
    .where("status", "==", "pending")
    .where("dueDate", ">=", todayStr)
    .where("dueDate", "<=", futureDateStr)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as BillAccount[];
}

export async function payBillAccount(
  userId: string,
  billId: string,
  paymentDate: string
): Promise<void> {
  const billRef = db.collection(`users/${userId}/billAccounts`).doc(billId);
  const billDoc = await billRef.get();

  if (!billDoc.exists) {
    throw new Error("Conta não encontrada");
  }

  const billData = billDoc.data() as BillAccount;

  await db.collection(`users/${userId}/transactions`).add({
    description: billData.description,
    amount: -Math.abs(billData.amount),
    date: paymentDate,
    category: "fixes",
    type: "expense",
    paymentMethod: "pix",
  });

  await billRef.update({ status: "paid" });
}

export async function findBillByDescription(
  userId: string,
  description: string
): Promise<BillAccount[]> {
  const snapshot = await db
    .collection(`users/${userId}/billAccounts`)
    .where("status", "==", "pending")
    .get();

  const descLower = description.toLowerCase();

  return snapshot.docs
    .filter((doc) => {
      const data = doc.data();
      return data.description?.toLowerCase().includes(descLower);
    })
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as BillAccount[];
}
