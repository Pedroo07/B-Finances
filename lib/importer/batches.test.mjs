import assert from "node:assert/strict";
import test from "node:test";

import { summarizeImportBatches } from "./batches.ts";

test("agrupa itens por lote e soma o total gasto", () => {
  const batches = summarizeImportBatches([
    { importBatchId: "a", card: "Nubank", date: "2026-10-01", amount: -10.5 },
    { importBatchId: "a", card: "Nubank", date: "2026-10-09", amount: -20 },
    { importBatchId: "b", card: "Inter", date: "2026-11-02", amount: -5 },
    { card: "Nubank", date: "2026-10-03", amount: -99 },
  ]);

  assert.equal(batches.length, 2);
  assert.equal(batches[0].batchId, "b");
  assert.deepEqual(batches[1], {
    batchId: "a",
    card: "Nubank",
    count: 2,
    total: 30.5,
    firstDate: "2026-10-01",
    lastDate: "2026-10-09",
    hasPaidItems: false,
    canUndo: true,
  });
});

test("lote com item de fatura paga não pode ser desfeito", () => {
  const [batch] = summarizeImportBatches([
    { importBatchId: "a", card: "Nubank", date: "2026-10-01", amount: -10 },
    {
      importBatchId: "a",
      card: "Nubank",
      date: "2026-10-02",
      amount: -10,
      invoicePaid: true,
    },
  ]);

  assert.equal(batch.hasPaidItems, true);
  assert.equal(batch.canUndo, false);
});

test("lista vazia quando não há itens importados", () => {
  assert.deepEqual(
    summarizeImportBatches([
      { card: "Nubank", date: "2026-10-01", amount: -1 },
    ]),
    [],
  );
});
