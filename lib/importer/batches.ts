export type ImportBatchItem = {
  importBatchId?: string;
  card: string;
  date: string;
  amount: number;
  invoicePaid?: boolean;
};

export type ImportBatchSummary = {
  batchId: string;
  card: string;
  count: number;
  total: number;
  firstDate: string;
  lastDate: string;
  hasPaidItems: boolean;
  canUndo: boolean;
};

export function summarizeImportBatches(
  items: ImportBatchItem[],
): ImportBatchSummary[] {
  const batches = new Map<string, ImportBatchSummary>();

  for (const item of items) {
    if (!item.importBatchId) continue;

    const current = batches.get(item.importBatchId);
    if (!current) {
      batches.set(item.importBatchId, {
        batchId: item.importBatchId,
        card: item.card,
        count: 1,
        total: Math.round(-item.amount * 100) / 100,
        firstDate: item.date,
        lastDate: item.date,
        hasPaidItems: Boolean(item.invoicePaid),
        canUndo: !item.invoicePaid,
      });
      continue;
    }

    current.count += 1;
    current.total = Math.round((current.total - item.amount) * 100) / 100;
    if (item.date < current.firstDate) current.firstDate = item.date;
    if (item.date > current.lastDate) current.lastDate = item.date;
    if (item.invoicePaid) {
      current.hasPaidItems = true;
      current.canUndo = false;
    }
  }

  return [...batches.values()].sort((a, b) =>
    b.lastDate.localeCompare(a.lastDate),
  );
}
