import assert from "node:assert/strict";
import test from "node:test";

import {
  appendInvoicePayment,
  buildInvoicePaymentEntry,
  computeInvoiceBalance,
  getInvoicePeriodsWithBalance,
  removeInvoicePayment,
} from "./invoiceBalance.ts";

test("pagamento total quita a fatura", () => {
  const entry = buildInvoicePaymentEntry({
    amount: 1000,
    remaining: 1000,
    paidAt: "2026-08-10",
    transactionId: "t1",
  });
  const invoices = { "2026-08": appendInvoicePayment(undefined, entry) };
  const balance = computeInvoiceBalance({
    purchases: 1000,
    invoices,
    periodKey: "2026-08",
  });
  assert.equal(balance.isPaid, true);
  assert.equal(balance.remaining, 0);
});

test("fatura paga que aumentou mostra só a diferença", () => {
  const invoices = {
    "2026-08": { amountPaid: 1000, paidAt: "2026-08-10", transactionId: "t1" },
  };
  const balance = computeInvoiceBalance({
    purchases: 1150,
    invoices,
    periodKey: "2026-08",
  });
  assert.equal(balance.isPaid, false);
  assert.equal(balance.remaining, 150);
});

test("pagamento parcial rola o restante e os juros para a próxima fatura", () => {
  const entry = buildInvoicePaymentEntry({
    amount: 300,
    remaining: 1000,
    paidAt: "2026-08-10",
    transactionId: "t1",
    interest: 20,
  });
  const invoices = { "2026-08": appendInvoicePayment(undefined, entry) };

  const current = computeInvoiceBalance({
    purchases: 1000,
    invoices,
    periodKey: "2026-08",
  });
  assert.equal(current.remaining, 0);
  assert.equal(current.paid, 300);

  const next = computeInvoiceBalance({
    purchases: 500,
    invoices,
    periodKey: "2026-09",
  });
  assert.equal(next.carryIn, 720);
  assert.equal(next.total, 1220);
  assert.deepEqual(
    getInvoicePeriodsWithBalance(invoices, []),
    ["2026-09"],
  );
});

test("recusa pagar acima do restante ou fatura quitada", () => {
  assert.throws(() =>
    buildInvoicePaymentEntry({
      amount: 200,
      remaining: 100,
      paidAt: "2026-08-10",
      transactionId: "t1",
    }),
  );
  assert.throws(() =>
    buildInvoicePaymentEntry({
      amount: 10,
      remaining: 0,
      paidAt: "2026-08-10",
      transactionId: "t1",
    }),
  );
});

test("desfazer um pagamento mantém os demais e remove o saldo rolado", () => {
  const first = buildInvoicePaymentEntry({
    amount: 300,
    remaining: 1000,
    paidAt: "2026-08-10",
    transactionId: "t1",
  });
  const withFirst = appendInvoicePayment(undefined, first);
  assert.equal(
    computeInvoiceBalance({
      purchases: 0,
      invoices: { "2026-08": withFirst },
      periodKey: "2026-09",
    }).carryIn,
    700,
  );
  assert.equal(removeInvoicePayment(withFirst, "t1"), null);

  const second = buildInvoicePaymentEntry({
    amount: 100,
    remaining: 100,
    paidAt: "2026-08-11",
    transactionId: "t2",
  });
  const both = appendInvoicePayment(
    appendInvoicePayment(undefined, { ...first, rolledOver: undefined }),
    second,
  );
  const after = removeInvoicePayment(both, "t2");
  assert.equal(after.amountPaid, 300);
  assert.equal(after.transactionId, "t1");
});
