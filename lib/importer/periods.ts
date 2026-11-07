import { getInvoicePeriodKeyForDate } from "../creditCards/billing.ts";
import type { ReviewRow } from "./review.ts";

export function countIncludedRowsInPeriods(
  rows: ReviewRow[],
  periodKeys: Set<string>,
  closingDay: number,
  dueDay: number,
): number {
  if (periodKeys.size === 0) return 0;

  return rows.filter((row) => {
    if (!row.included) return false;

    try {
      return periodKeys.has(
        getInvoicePeriodKeyForDate(row.values.date, closingDay, dueDay),
      );
    } catch {
      return false;
    }
  }).length;
}
