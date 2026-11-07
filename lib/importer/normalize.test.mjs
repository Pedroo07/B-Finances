import assert from "node:assert/strict";
import test from "node:test";

import {
  buildParsedEntry,
  classifyEntry,
  extractInstallment,
  normalizeForMatch,
  parseAmount,
  parseDateToIso,
} from "./normalize.ts";

test("converte valores em formato brasileiro e internacional", () => {
  assert.equal(parseAmount("12,90"), 12.9);
  assert.equal(parseAmount("1.234,56"), 1234.56);
  assert.equal(parseAmount("- 526,33"), -526.33);
  assert.equal(parseAmount("R$ 36,94"), 36.94);
  assert.equal(parseAmount("\u2212R$ 166,53"), -166.53);
  assert.equal(parseAmount("-12.90"), -12.9);
  assert.equal(parseAmount("0,00"), 0);
});

test("rejeita valores inválidos", () => {
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount("1.234.567"), null);
});

test("converte datas para AAAA-MM-DD", () => {
  assert.equal(parseDateToIso("2026-11-07"), "2026-11-07");
  assert.equal(parseDateToIso("07/11/2026"), "2026-11-07");
  assert.equal(parseDateToIso("20261107000000[-3:BRT]"), "2026-11-07");
  assert.equal(parseDateToIso("31/02/2026"), null);
  assert.equal(parseDateToIso("ontem"), null);
});

test("extrai parcela do final da descrição", () => {
  assert.deepEqual(extractInstallment("Bmb *Vivoeasy Lite - Parcela 12/12"), {
    description: "Bmb *Vivoeasy Lite",
    installmentNumber: 12,
    installmentCount: 12,
  });
  assert.deepEqual(extractInstallment("Loja X Parcela 3 de 10"), {
    description: "Loja X",
    installmentNumber: 3,
    installmentCount: 10,
  });
});

test("ignora parcela inconsistente", () => {
  assert.deepEqual(extractInstallment("Loja Parcela 5/3"), {
    description: "Loja Parcela 5/3",
  });
  assert.deepEqual(extractInstallment("Supermercado Leal"), {
    description: "Supermercado Leal",
  });
});

test("classifica lançamentos", () => {
  assert.equal(classifyEntry("Dl*Spotify P48e6", 12.9), "purchase");
  assert.equal(classifyEntry("Pagamento recebido", -526.33), "payment");
  assert.equal(classifyEntry("Pagamento em 19 SET", -166.53), "payment");
  assert.equal(classifyEntry("Crédito de rotativo", -166.53), "payment");
  assert.equal(classifyEntry("Saldo em atraso", 166.53), "payment");
  assert.equal(classifyEntry("Juros do rotativo", 0.67), "fee");
  assert.equal(classifyEntry("IOF do rotativo", 0.16), "fee");
  assert.equal(classifyEntry("Multa por atraso", 0.74), "fee");
  assert.equal(classifyEntry("Estorno Amazon", -10), "refund");
});

test("normaliza texto para comparação", () => {
  assert.equal(
    normalizeForMatch("  Dl *Spotify P47eaf73cf "),
    normalizeForMatch("Dl*Spotify P48e6"),
  );
  assert.equal(normalizeForMatch("Padaria São João 123"), "padaria sao joao");
});

test("monta lançamento com parcela e tipo", () => {
  assert.deepEqual(
    buildParsedEntry({
      date: "2026-10-11",
      rawDescription: "Bmb *Vivoeasy Lite  - Parcela 12/12",
      amount: 30,
      externalId: "abc",
    }),
    {
      date: "2026-10-11",
      description: "Bmb *Vivoeasy Lite",
      rawDescription: "Bmb *Vivoeasy Lite - Parcela 12/12",
      amount: 30,
      kind: "purchase",
      installmentNumber: 12,
      installmentCount: 12,
      externalId: "abc",
    },
  );
});
