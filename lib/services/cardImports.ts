import {
  collection,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../firebase";
import {
  buildCardTransactionDocuments,
  chunkItems,
  IMPORT_BATCH_SIZE,
} from "../importer/persist";
import type { ReviewRow } from "../importer/review";

export type ImportCardTransactionsResult = {
  batchId: string;
  total: number;
  importedCount: number;
  errorMessage?: string;
};

const auth = getAuth();

function getCardTransactionsCollection() {
  const user = auth.currentUser;
  if (!user) throw new Error("User not authenticated");
  return collection(db, `users/${user.uid}/cardTransactions`);
}

export function createImportBatchId(): string {
  return doc(getCardTransactionsCollection()).id;
}

export async function importCardTransactions(params: {
  rows: ReviewRow[];
  card: string;
  batchId: string;
}): Promise<ImportCardTransactionsResult> {
  const documents = buildCardTransactionDocuments(
    params.rows,
    params.card,
    params.batchId,
  );
  const cardsRef = getCardTransactionsCollection();
  let importedCount = 0;

  for (const chunk of chunkItems(documents, IMPORT_BATCH_SIZE)) {
    try {
      const batch = writeBatch(db);
      chunk.forEach((document) => batch.set(doc(cardsRef), document));
      await batch.commit();
      importedCount += chunk.length;
    } catch (error) {
      return {
        batchId: params.batchId,
        total: documents.length,
        importedCount,
        errorMessage:
          error instanceof Error
            ? error.message
            : "Falha ao gravar lançamentos",
      };
    }
  }

  return {
    batchId: params.batchId,
    total: documents.length,
    importedCount,
  };
}

export async function deleteCardImportBatch(batchId: string): Promise<number> {
  const cardsRef = getCardTransactionsCollection();
  const snapshot = await getDocs(
    query(cardsRef, where("importBatchId", "==", batchId)),
  );

  let deleted = 0;
  for (const chunk of chunkItems(snapshot.docs, IMPORT_BATCH_SIZE)) {
    const batch = writeBatch(db);
    chunk.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}
