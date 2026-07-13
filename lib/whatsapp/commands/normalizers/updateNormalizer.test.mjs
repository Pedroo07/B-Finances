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
    const isRelative =
      specifier.startsWith("./") || specifier.startsWith("../");
    if (isRelative && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { extractUpdatePayload, normalizeCommandUpdate } =
  await import("./updateNormalizer.ts");

function command(overrides = {}) {
  return {
    action: "update",
    resource: "transaction",
    transactionType: "expense",
    confidence: 0.9,
    ...overrides,
  };
}

test("separa valor novo de uma atualização sem alvo", () => {
  assert.deepEqual(extractUpdatePayload("altere o valor para 4.75"), {
    field: "amount",
    value: 4.75,
    reference: "recent",
    targetText: "",
  });
});

test("reconhece última despesa e preserva o alvo sanitizado", () => {
  assert.deepEqual(
    extractUpdatePayload("altere o valor da última despesa para 4,75"),
    {
      field: "amount",
      value: 4.75,
      reference: "latest",
      targetText: "última despesa",
    },
  );
});

test("separa descrição alvo do novo valor", () => {
  assert.deepEqual(
    extractUpdatePayload("altere o valor da padaria para R$ 1.234,56"),
    {
      field: "amount",
      value: 1234.56,
      reference: null,
      targetText: "padaria",
    },
  );
});

test("transforma alvo textual simples em filtro de descrição", () => {
  const normalized = normalizeCommandUpdate(
    "altere o valor da padaria para 4,75",
    command(),
  );

  assert.equal(normalized.filters?.description, "padaria");

  const latest = normalizeCommandUpdate(
    "altere o valor da última despesa para 4,75",
    command(),
  );
  assert.equal(latest.filters?.description, undefined);

  const generic = normalizeCommandUpdate(
    "altere o valor da transação para 4,75",
    command(),
  );
  assert.equal(generic.filters?.description, undefined);
});

test("reconhece os demais campos editáveis", () => {
  assert.deepEqual(
    extractUpdatePayload("mude a descrição da padaria para Padaria Central"),
    {
      field: "description",
      value: "Padaria Central",
      reference: null,
      targetText: "padaria",
    },
  );
  assert.equal(
    extractUpdatePayload("corrija a data da padaria para ontem")?.field,
    "date",
  );
  assert.equal(
    extractUpdatePayload("troque a categoria da padaria para alimentação")
      ?.field,
    "category",
  );
  assert.equal(
    extractUpdatePayload("atualize o método de pagamento da padaria para pix")
      ?.field,
    "paymentMethod",
  );
});

test("remove somente o novo valor dos critérios de busca", () => {
  const normalized = normalizeCommandUpdate(
    "altere o valor da padaria para 4.75",
    command({
      filters: {
        description: "padaria",
        amount: 4.75,
        minAmount: 10,
        orderBy: "date_desc",
      },
      data: { amount: 4.75 },
    }),
  );

  assert.deepEqual(normalized.update, {
    field: "amount",
    value: 4.75,
    reference: null,
    targetText: "padaria",
  });
  assert.deepEqual(normalized.filters, {
    description: "padaria",
    minAmount: 10,
    orderBy: "date_desc",
  });
  assert.deepEqual(normalized.data, {});
});

test("normaliza valor do modelo e aceita valor antigo como alvo", () => {
  const modelValue = normalizeCommandUpdate(
    "preciso de uma correção nessa compra",
    command({
      update: {
        field: "amount",
        value: "1,234.56",
        targetText: "padaria",
      },
    }),
  );
  assert.equal(modelValue.update?.value, 1234.56);

  const oldAmount = normalizeCommandUpdate(
    "altere o valor de 4,85 para 4,75",
    command(),
  );
  assert.equal(oldAmount.filters?.amount, 4.85);
  assert.equal(oldAmount.update?.value, 4.75);
});

test("corrige classificação do modelo e aceita informação incompleta", () => {
  const normalized = normalizeCommandUpdate(
    "por favor, altere o valor da padaria",
    command({ action: "clarify" }),
  );

  assert.equal(normalized.action, "update");
  assert.deepEqual(normalized.update, {
    field: "amount",
    value: null,
    reference: null,
    targetText: "padaria",
  });
});
