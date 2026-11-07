import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCardTransactionDocuments,
  chunkItems,
  getImportInstallmentGroupId,
} from "./persist.ts";
import { createReviewState, reviewReducer } from "./review.ts";

const entry = (overrides = {}) => ({
  date: "2026-10-13",
  description: "Supermercado Leal",
  rawDescription: "Supermercado Leal",
  amount: 98.19,
  kind: "purchase",
  ...overrides,
});

test("converte linhas marcadas em documentos com valor negativo", () => {
  const state = createReviewState(
    [
      entry({ externalId: "fit-1" }),
      entry({
        description: "Pagamento recebido",
        rawDescription: "Pagamento recebido",
        amount: -50,
        kind: "payment",
      }),
    ],
    { rules: [], existing: [] },
  );
  const docs = buildCardTransactionDocuments(state.rows, "Nubank", "batch-1");

  assert.equal(docs.length, 1);
  assert.deepEqual(docs[0], {
    description: "Supermercado Leal",
    category: "foods",
    date: "2026-10-13",
    amount: -98.19,
    card: "Nubank",
    importBatchId: "batch-1",
    importKey: state.rows[0].importKey,
    importExternalId: "fit-1",
  });
});

test("usa os valores editados e grava crédito como valor positivo", () => {
  let state = createReviewState(
    [
      entry({
        description: "Estorno Loja",
        rawDescription: "Estorno Loja",
        amount: -20,
        kind: "refund",
      }),
    ],
    { rules: [], existing: [] },
  );
  state = reviewReducer(state, { type: "toggle", id: "row-0" });
  state = reviewReducer(state, {
    type: "edit",
    id: "row-0",
    patch: { description: "  Reembolso  ", category: "shopping" },
  });
  const [doc] = buildCardTransactionDocuments(state.rows, "Nubank", "b");

  assert.equal(doc.amount, 20);
  assert.equal(doc.description, "Reembolso");
  assert.equal(doc.category, "shopping");
});

test("linha manual não leva chave nem identificador externo", () => {
  let state = createReviewState([], { rules: [], existing: [] });
  state = reviewReducer(state, {
    type: "addManual",
    values: {
      description: "Compra extra",
      date: "2026-10-20",
      amount: 15,
      category: "other",
    },
  });
  const [doc] = buildCardTransactionDocuments(state.rows, "Nubank", "b");

  assert.equal("importKey" in doc, false);
  assert.equal("importExternalId" in doc, false);
  assert.equal(doc.amount, -15);
});

test("parcelas da mesma compra compartilham o grupo entre meses", () => {
  const november = getImportInstallmentGroupId({
    card: "Nubank",
    description: "Bmb *Vivoeasy Lite",
    date: "2026-11-11",
    installmentNumber: 12,
    installmentCount: 12,
  });
  const october = getImportInstallmentGroupId({
    card: "Nubank",
    description: "bmb  *vivoeasy lite",
    date: "2026-10-11",
    installmentNumber: 11,
    installmentCount: 12,
  });
  const other = getImportInstallmentGroupId({
    card: "Nubank",
    description: "Bmb *Vivoeasy Lite",
    date: "2026-10-11",
    installmentNumber: 1,
    installmentCount: 12,
  });

  assert.equal(november, october);
  assert.notEqual(november, other);
  assert.match(november, /^imp-/);
});

test("documentos de parcela levam número, total e grupo", () => {
  const state = createReviewState(
    [
      entry({
        description: "Loja X",
        rawDescription: "Loja X - Parcela 3/10",
        amount: 30,
        installmentNumber: 3,
        installmentCount: 10,
      }),
    ],
    { rules: [], existing: [] },
  );
  const [doc] = buildCardTransactionDocuments(state.rows, "Nubank", "b");

  assert.equal(doc.installmentNumber, 3);
  assert.equal(doc.installmentCount, 10);
  assert.match(doc.installmentGroupId, /^imp-/);
});

test("divide itens em lotes", () => {
  assert.deepEqual(chunkItems([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunkItems([], 2), []);
});
