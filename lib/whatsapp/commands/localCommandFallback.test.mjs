import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const path = resolve(process.cwd(), `${specifier.slice(2)}.ts`);
      return nextResolve(pathToFileURL(path).href, context);
    }
    const relative = specifier.startsWith("./") || specifier.startsWith("../");
    if (relative && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { buildLocalFallbackCommand } = await import("./localCommandFallback.ts");
const { normalizeCommandCategory } = await import(
  "./normalizers/categoryNormalizer.ts"
);

test("interpreta venda com valor e recebimento via pix mantendo apenas o item na descricao", () => {
  const rawMessage = "Vendi um ventilador por 90 reais recebi no pix";
  const command = buildLocalFallbackCommand(rawMessage);
  assert.ok(command);
  const normalized = normalizeCommandCategory(rawMessage, command);

  assert.equal(normalized.action, "create");
  assert.equal(normalized.resource, "transaction");
  assert.equal(normalized.transactionType, "income");
  assert.equal(normalized.data.description, "Ventilador");
  assert.equal(normalized.data.amount, 90);
  assert.equal(normalized.data.paymentMethod, "pix");
  assert.equal(normalized.data.category, "extra");
});

test("limpa verbos de acao, conectores e preposicoes de valor em receitas e despesas", () => {
  const cases = [
    {
      input: "Comprei uma cadeira por R$ 350 paguei no pix",
      expectedDescription: "Cadeira",
      expectedAmount: 350,
      expectedType: "expense",
      expectedMethod: "pix",
      expectedResource: "transaction",
    },
    {
      input: "Corte de cabelo 40 reais no cartao nubank",
      expectedDescription: "Corte de cabelo",
      expectedAmount: 40,
      expectedType: "expense",
      expectedMethod: "credit_card",
      expectedResource: "card_transaction",
    },
    {
      input: "Vendi meu celular antigo no valor de 800 reais e recebi via pix",
      expectedDescription: "Celular antigo",
      expectedAmount: 800,
      expectedType: "income",
      expectedMethod: "pix",
      expectedResource: "transaction",
    },
    {
      input: "Gastei 45 reais de uber no cartao inter",
      expectedDescription: "Uber",
      expectedAmount: 45,
      expectedType: "expense",
      expectedMethod: "credit_card",
      expectedResource: "card_transaction",
    },
  ];

  for (const item of cases) {
    const command = buildLocalFallbackCommand(item.input);
    assert.ok(command, `Falhou para: ${item.input}`);
    assert.equal(command.data.description, item.expectedDescription);
    assert.equal(command.data.amount, item.expectedAmount);
    assert.equal(command.transactionType, item.expectedType);
    assert.equal(command.data.paymentMethod, item.expectedMethod);
    assert.equal(command.resource, item.expectedResource);
  }
});
