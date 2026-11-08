import assert from "node:assert/strict";
import test from "node:test";

import { getInvoicePeriodKeyForDate } from "../creditCards/billing.ts";
import { countIncludedRowsInPeriods, getRowIdsInPeriods } from "./periods.ts";
import { createReviewState, reviewReducer } from "./review.ts";

const entry = (date, amount) => ({
  date,
  description: "Loja",
  rawDescription: "Loja",
  amount,
  kind: "purchase",
});

test("conta linhas marcadas e identifica IDs em períodos pagos", () => {
  const paidKey = getInvoicePeriodKeyForDate("2026-10-05", 11, 19);
  const otherKey = getInvoicePeriodKeyForDate("2026-11-20", 11, 19);
  assert.notEqual(paidKey, otherKey);

  let state = createReviewState(
    [entry("2026-10-05", 10), entry("2026-10-06", 20), entry("2026-11-20", 30)],
    { rules: [], existing: [] },
  );
  state = reviewReducer(state, { type: "toggle", id: "row-1" });

  assert.equal(
    countIncludedRowsInPeriods(state.rows, new Set([paidKey]), 11, 19),
    1,
  );
  assert.deepEqual(
    [...getRowIdsInPeriods(state.rows, new Set([paidKey]), 11, 19)],
    ["row-0", "row-1"],
  );
  assert.equal(countIncludedRowsInPeriods(state.rows, new Set(), 11, 19), 0);
});

test("ignora datas inválidas sem lançar erro", () => {
  let state = createReviewState([entry("2026-10-05", 10)], {
    rules: [],
    existing: [],
  });
  state = reviewReducer(state, {
    type: "edit",
    id: "row-0",
    patch: { date: "invalid" },
  });

  assert.equal(
    countIncludedRowsInPeriods(state.rows, new Set(["2026-10"]), 11, 19),
    0,
  );
  assert.equal(
    getRowIdsInPeriods(state.rows, new Set(["2026-10"]), 11, 19).size,
    0,
  );
});
