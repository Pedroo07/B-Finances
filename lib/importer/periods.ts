import { getInvoicePeriodKeyForDate } from "../creditCards/billing.ts";
import type { ReviewRow } from "./review.ts";

export function isRowInPeriods(
  row: ReviewRow,
  periodKeys: Set<string>,
  closingDay: number,
  dueDay: number,
): boolean {
  if (periodKeys.size === 0) return false;

  try {
    return periodKeys.has(
      getInvoicePeriodKeyForDate(row.values.date, closingDay, dueDay),
    );
  } catch {
    return false;
  }
}

export function getRowIdsInPeriods(
  rows: ReviewRow[],
  periodKeys: Set<string>,
  closingDay: number,
  dueDay: number,
): Set<string> {
  const result = new Set<string>();
  if (periodKeys.size === 0) return result;

  for (const row of rows) {
    if (isRowInPeriods(row, periodKeys, closingDay, dueDay)) {
      result.add(row.id);
    }
  }

  return result;
}

export function countIncludedRowsInPeriods(
  rows: ReviewRow[],
  periodKeys: Set<string>,
  closingDay: number,
  dueDay: number,
): number {
  if (periodKeys.size === 0) return 0;

  return rows.filter(
    (row) =>
      row.included && isRowInPeriods(row, periodKeys, closingDay, dueDay),
  ).length;
}
