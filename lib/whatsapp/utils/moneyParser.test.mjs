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

test("aceita formato coloquial falado com centavos", () => {
  assert.equal(parseMoney("27 e 10"), 27.1);
  assert.equal(parseMoney("27 reais e 10 centavos"), 27.1);
  assert.equal(parseMoney("R$ 27 e 10"), 27.1);
  assert.equal(parseMoney("15 e 50"), 15.5);
  assert.equal(parseMoney("5 e 5"), 5.5);
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
  assert.deepEqual(extractMoney("gastei 27 e 10 no açougue"), {
    raw: "27 e 10",
    value: 27.1,
    index: 7,
    end: 14,
  });
  assert.equal(extractMoney("para amanhã"), null);
  assert.equal(extractMoney("na data 12/07/2026"), null);
});
