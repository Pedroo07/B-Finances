import assert from "node:assert/strict";
import test from "node:test";

import {
  countSimilarRows,
  countSimilarRowsOutOfSync,
  createReviewState,
  getBlockingErrors,
  isRowEdited,
  reviewReducer,
  summarizeReview,
} from "./review.ts";

const entry = (overrides = {}) => ({
  date: "2026-10-13",
  description: "Supermercado Leal",
  rawDescription: "Supermercado Leal",
  amount: 98.19,
  kind: "purchase",
  ...overrides,
});

const ENTRIES = [
  entry(),
  entry({
    description: "Maria Aparecida",
    rawDescription: "Maria Aparecida",
    amount: 40,
    date: "2026-10-14",
  }),
  entry({
    description: "Maria Aparecida",
    rawDescription: "Maria Aparecida",
    amount: 22,
    date: "2026-10-15",
  }),
  entry({
    description: "Pagamento recebido",
    rawDescription: "Pagamento recebido",
    amount: -526.33,
    kind: "payment",
    date: "2026-10-18",
  }),
  entry({
    description: "Juros do rotativo",
    rawDescription: "Juros do rotativo",
    amount: 0.67,
    kind: "fee",
    date: "2026-10-19",
  }),
];

const create = (overrides = {}) =>
  createReviewState(ENTRIES, { rules: [], existing: [], ...overrides });

test("compras vêm marcadas e pagamentos e encargos desmarcados", () => {
  const { rows } = create();

  assert.deepEqual(
    rows.map((row) => row.included),
    [true, true, true, false, false],
  );
  assert.equal(rows[0].values.category, "foods");
});

test("duplicadas vêm desmarcadas", () => {
  const { rows } = create({
    existing: [
      { date: "2026-10-13", amount: -98.19, description: "supermercado leal" },
    ],
  });

  assert.equal(rows[0].duplicateReason, "matches-existing");
  assert.equal(rows[0].included, false);
});

test("aplica regras aprendidas na criação", () => {
  const { rows } = create({
    rules: [
      {
        id: "r1",
        matchText: "maria aparecida",
        rewriteDescription: "Floricultura",
        category: "shopping",
      },
    ],
  });

  assert.equal(rows[1].values.description, "Floricultura");
  assert.equal(rows[1].values.category, "shopping");
  assert.equal(rows[1].ruleId, "r1");
  assert.equal(isRowEdited(rows[1]), false);
});

test("edita linha, marca como editada e restaura", () => {
  let state = create();
  state = reviewReducer(state, {
    type: "edit",
    id: "row-1",
    patch: { description: "Floricultura", amount: 45 },
  });

  assert.equal(state.rows[1].values.description, "Floricultura");
  assert.equal(state.rows[1].original.rawDescription, "Maria Aparecida");
  assert.equal(isRowEdited(state.rows[1]), true);

  state = reviewReducer(state, { type: "restore", id: "row-1" });
  assert.equal(state.rows[1].values.description, "Maria Aparecida");
  assert.equal(isRowEdited(state.rows[1]), false);
});

test("aplica edição a linhas semelhantes", () => {
  let state = create();

  assert.equal(countSimilarRows(state.rows, "row-1"), 1);

  state = reviewReducer(state, {
    type: "applyToSimilar",
    id: "row-1",
    patch: { description: "Floricultura" },
  });

  assert.equal(state.rows[1].values.description, "Floricultura");
  assert.equal(state.rows[2].values.description, "Floricultura");
  assert.equal(state.rows[0].values.description, "Supermercado Leal");
});

test("seleção individual e em lote por tipo", () => {
  let state = create();
  state = reviewReducer(state, { type: "toggle", id: "row-0" });
  assert.equal(state.rows[0].included, false);

  state = reviewReducer(state, {
    type: "setIncluded",
    included: true,
    filter: "fee",
  });
  assert.equal(state.rows[4].included, true);
  assert.equal(state.rows[3].included, false);

  state = reviewReducer(state, { type: "setIncluded", included: false });
  assert.equal(
    state.rows.every((row) => !row.included),
    true,
  );
});

test("aplica categoria às selecionadas", () => {
  let state = create();
  state = reviewReducer(state, {
    type: "setCategoryForIncluded",
    category: "housing",
  });

  assert.equal(state.rows[0].values.category, "housing");
  assert.equal(state.rows[3].values.category, "other");
});

test("adiciona e remove linha manual", () => {
  let state = create();
  state = reviewReducer(state, {
    type: "addManual",
    values: {
      description: "Compra extra",
      date: "2026-10-20",
      amount: 15,
      category: "other",
    },
  });

  const manual = state.rows[state.rows.length - 1];
  assert.equal(manual.manual, true);
  assert.equal(manual.included, true);

  state = reviewReducer(state, { type: "remove", id: manual.id });
  assert.equal(state.rows.length, ENTRIES.length);

  state = reviewReducer(state, { type: "remove", id: "row-0" });
  assert.equal(state.rows.length, ENTRIES.length);
});

test("desfaz as últimas alterações em sequência", () => {
  let state = create();
  state = reviewReducer(state, { type: "toggle", id: "row-0" });
  state = reviewReducer(state, {
    type: "edit",
    id: "row-1",
    patch: { amount: 1 },
  });

  state = reviewReducer(state, { type: "undo" });
  assert.equal(state.rows[1].values.amount, 40);
  assert.equal(state.rows[0].included, false);

  state = reviewReducer(state, { type: "undo" });
  assert.equal(state.rows[0].included, true);

  const unchanged = reviewReducer(state, { type: "undo" });
  assert.equal(unchanged, state);
});

test("resume total das selecionadas e diferença para o esperado", () => {
  let state = create();
  let summary = summarizeReview(state.rows);

  assert.equal(summary.includedCount, 3);
  assert.equal(summary.ignoredCount, 2);
  assert.equal(summary.total, 160.19);
  assert.equal(summary.difference, undefined);

  summary = summarizeReview(state.rows, 160);
  assert.equal(summary.difference, 0.19);

  state = reviewReducer(state, { type: "toggle", id: "row-0" });
  assert.equal(summarizeReview(state.rows).total, 62);
});

test("bloqueia linhas marcadas com dados inválidos", () => {
  let state = create();
  state = reviewReducer(state, {
    type: "edit",
    id: "row-0",
    patch: { description: " ", date: "2026-02-31", amount: 0 },
  });
  state = reviewReducer(state, {
    type: "edit",
    id: "row-1",
    patch: { installmentNumber: 5, installmentCount: 3 },
  });
  state = reviewReducer(state, {
    type: "edit",
    id: "row-3",
    patch: { amount: 0 },
  });

  const errors = getBlockingErrors(state.rows);

  assert.equal(errors.get("row-0").length, 3);
  assert.deepEqual(errors.get("row-1"), ["Parcela inválida"]);
  assert.equal(errors.has("row-3"), false);
  assert.equal(errors.has("row-2"), false);
});

test("conta linhas semelhantes ainda fora de sincronia com a editada", () => {
  let state = create();
  assert.equal(countSimilarRowsOutOfSync(state.rows, "row-1"), 0);

  state = reviewReducer(state, {
    type: "edit",
    id: "row-1",
    patch: { description: "Floricultura" },
  });
  assert.equal(countSimilarRowsOutOfSync(state.rows, "row-1"), 1);

  state = reviewReducer(state, {
    type: "applyToSimilar",
    id: "row-1",
    patch: { description: "Floricultura" },
  });
  assert.equal(countSimilarRowsOutOfSync(state.rows, "row-1"), 0);
});
