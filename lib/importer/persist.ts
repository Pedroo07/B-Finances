import { normalizeForMatch } from "./normalize.ts";
import type { ReviewRow } from "./review.ts";

export const IMPORT_BATCH_SIZE = 400;

export type ImportedCardTransactionDocument = {
  description: string;
  category: string;
  date: string;
  amount: number;
  card: string;
  installmentGroupId?: string;
  installmentNumber?: number;
  installmentCount?: number;
  importBatchId: string;
  importKey?: string;
  importExternalId?: string;
};

function hashText(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
}

function getPurchaseMonth(date: string, installmentNumber: number): string {
  const [year, month] = date.split("-").map(Number);
  const origin = new Date(
    Date.UTC(year, month - 1 - (installmentNumber - 1), 1),
  );
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${origin.getUTCFullYear()}-${pad(origin.getUTCMonth() + 1)}`;
}

export function getImportInstallmentGroupId(params: {
  card: string;
  description: string;
  date: string;
  installmentNumber: number;
  installmentCount: number;
}): string {
  const key = [
    normalizeForMatch(params.card),
    normalizeForMatch(params.description),
    params.installmentCount,
    getPurchaseMonth(params.date, params.installmentNumber),
  ].join("|");

  return `imp-${hashText(key)}`;
}

export function buildCardTransactionDocuments(
  rows: ReviewRow[],
  card: string,
  batchId: string,
): ImportedCardTransactionDocument[] {
  return rows
    .filter((row) => row.included)
    .map((row) => {
      const { values } = row;
      const hasInstallment =
        values.installmentNumber !== undefined &&
        values.installmentCount !== undefined;
      const amount = Math.round(-values.amount * 100) / 100;

      return {
        description: values.description.trim(),
        category: values.category,
        date: values.date,
        amount: amount === 0 ? 0 : amount,
        card,
        ...(hasInstallment && {
          installmentGroupId: getImportInstallmentGroupId({
            card,
            description: values.description,
            date: values.date,
            installmentNumber: values.installmentNumber as number,
            installmentCount: values.installmentCount as number,
          }),
          installmentNumber: values.installmentNumber,
          installmentCount: values.installmentCount,
        }),
        importBatchId: batchId,
        ...(row.importKey && { importKey: row.importKey }),
        ...(row.original?.externalId && {
          importExternalId: row.original.externalId,
        }),
      };
    });
}

export function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
