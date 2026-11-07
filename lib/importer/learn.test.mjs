import assert from "node:assert/strict";
import test from "node:test";

import { collectRulesToLearn } from "./learn.ts";
import { createReviewState, reviewReducer } from "./review.ts";

const entry = (overrides = {}) => ({
  date: "2026-10-13",
  description: "Maria Aparecida",
  rawDescription: "Maria Aparecida",
  amount: 40,
  kind: "purchase",
  ...overrides,
});

const create = (entries, rules = []) =>
  createReviewState(entries, { rules, existing: [] });

test("aprende regra da edição de descrição e categoria", () => {
  let state = create([entry()]);
  state = reviewReducer(state, {
    type: "edit",
    id: "row-0",
    patch: { description: "Floricultura", category: "shopping" },
  });

  assert.deepEqual(collectRulesToLearn(state.rows, []), [
    {
      matchText: "maria aparecida",
      rewriteDescription: "Floricultura",
      category: "shopping",
    },
  ]);
});

test("não aprende de linhas desmarcadas, manuais ou sem edição", () => {
  let state = create([entry(), entry({ rawDescription: "Posto X" })]);
  state = reviewReducer(state, {
    type: "edit",
    id: "row-1",
    patch: { description: "Combustível" },
  });
  state = reviewReducer(state, { type: "toggle", id: "row-1" });
  state = reviewReducer(state, {
    type: "addManual",
    values: {
      description: "Manual",
      date: "2026-10-20",
      amount: 1,
      category: "other",
    },
  });

  assert.deepEqual(collectRulesToLearn(state.rows, []), []);
});

test("junta edições da mesma origem e preserva regra existente", () => {
  const rules = [
    {
      id: "r1",
      matchText: "maria aparecida",
      rewriteDescription: "Floricultura",
    },
  ];
  let state = create([entry(), entry({ amount: 22 })], rules);
  state = reviewReducer(state, {
    type: "edit",
    id: "row-0",
    patch: { category: "shopping" },
  });
  state = reviewReducer(state, {
    type: "edit",
    id: "row-1",
    patch: { category: "shopping" },
  });

  assert.deepEqual(collectRulesToLearn(state.rows, rules), [
    {
      matchText: "maria aparecida",
      rewriteDescription: "Floricultura",
      category: "shopping",
    },
  ]);
});
