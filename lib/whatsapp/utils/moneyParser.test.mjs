import assert from "node:assert/strict";
import test from "node:test";

import { extractMoney, parseMoney } from "./moneyParser.ts";

test("aceita separadores brasileiro e internacional", () => {
  assert.equal(parseMoney("4.75"), 4.75);
  assert.equal(parseMoney("4,75"), 4.75);
  assert.equal(parseMoney("1.234,56"), 1234.56);
  assert.equal(parseMoney("1,234.56"), 1234.56);
});

test("aceita moeda, sinal e milhar sem centavos", () => {
  assert.equal(parseMoney("R$ 25,90"), 25.9);
  assert.equal(parseMoney("-1.234"), -1234);
  assert.equal(parseMoney(19.5), 19.5);
});

test("rejeita valores parciais ou inválidos", () => {
  assert.equal(parseMoney("valor 25,90"), null);
  assert.equal(parseMoney("12/07/2026"), null);
  assert.equal(parseMoney(Number.NaN), null);
});

test("extrai valor de uma frase", () => {
  assert.deepEqual(extractMoney("para R$ 1.234,56 agora"), {
    raw: "1.234,56",
    value: 1234.56,
    index: 8,
    end: 16,
  });
  assert.equal(extractMoney("para amanhã"), null);
  assert.equal(extractMoney("na data 12/07/2026"), null);
});
