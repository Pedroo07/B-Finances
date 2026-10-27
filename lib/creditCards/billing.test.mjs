import test from "node:test";
import assert from "node:assert/strict";
import {
  getNextPeriodKey,
  getCardPaidPeriodKeys,
  getTransactionInvoicePeriodKey,
  getInvoicePeriodKeyForDate,
} from "./billing.ts";

test("getNextPeriodKey avança exatamente um mês e vira o ano quando necessário", () => {
  assert.equal(getNextPeriodKey("2026-01"), "2026-02");
  assert.equal(getNextPeriodKey("2026-10"), "2026-11");
  assert.equal(getNextPeriodKey("2026-12"), "2027-01");
});

test("getCardPaidPeriodKeys extrai períodos pagos de invoices e de cardTransactions", () => {
  const invoices = {
    "2026-04": { amountPaid: 200, paidAt: "2026-04-20", transactionId: "tx-1" },
    "2026-05": { amountPaid: 0, payments: [{ id: "p1" }] },
    "2026-06": { amountPaid: 0 }, // Não pago
  };
  const transactions = [
    { invoicePaid: true, invoicePeriodKey: "2026-07" },
    { invoicePaid: false, invoicePeriodKey: "2026-08" },
    { invoicePaid: true }, // Sem periodKey
  ];

  const paidKeys = getCardPaidPeriodKeys(invoices, transactions);
  assert.equal(paidKeys.has("2026-04"), true);
  assert.equal(paidKeys.has("2026-05"), true);
  assert.equal(paidKeys.has("2026-06"), false);
  assert.equal(paidKeys.has("2026-07"), true);
  assert.equal(paidKeys.has("2026-08"), false);
});

test("getTransactionInvoicePeriodKey respeita invoicePeriodKey se a transação já tiver", () => {
  const item = { date: "2026-10-12", invoicePeriodKey: "2026-09", invoicePaid: true };
  const key = getTransactionInvoicePeriodKey(item, 24, 1);
  assert.equal(key, "2026-09");
});

test("compra não paga NUNCA entra em fatura já fechada e paga: rola para a fatura aberta", () => {
  // Cenário real do Nubank relatado pelo usuário:
  // Fatura de Outubro (2026-10) já foi paga.
  // Fechamento mudou para 24, vencimento para 1.
  // Uma compra feita no dia 12/10 (cairia em 2026-10 pela data pura, pois 12 < 24).
  // Mas como 2026-10 JÁ ESTÁ PAGA, ela tem que cair na fatura aberta (2026-11)!
  const paidPeriodKeys = new Set(["2026-09", "2026-10"]);
  const unpaidItem = { date: "2026-10-12", invoicePaid: false };

  // Verificação: pela data pura seria 2026-10
  assert.equal(getInvoicePeriodKeyForDate("2026-10-12", 24, 1), "2026-10");

  // Mas com a regra de proteção contra alteração de datas em faturas pagas:
  const resolvedKey = getTransactionInvoicePeriodKey(unpaidItem, 24, 1, paidPeriodKeys);
  assert.equal(resolvedKey, "2026-11");
});

test("se faturas subsequentes também já estiverem pagas, rola até a primeira fatura aberta", () => {
  const paidPeriodKeys = new Set(["2026-10", "2026-11", "2026-12"]);
  const unpaidItem = { date: "2026-10-12", invoicePaid: false };

  const resolvedKey = getTransactionInvoicePeriodKey(unpaidItem, 24, 1, paidPeriodKeys);
  assert.equal(resolvedKey, "2027-01");
});
