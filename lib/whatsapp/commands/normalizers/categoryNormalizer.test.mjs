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

const {
  canonicalizeTransactionCategory,
  inferTransactionCategory,
  normalizeCommandCategory,
  resolveTransactionCategory,
} = await import("./categoryNormalizer.ts");
const { normalizeCommandFilters } = await import("./filterNormalizer.ts");

const expenseCases = [
  ["mercado", "Gastei R$ 120 no supermercado", "foods"],
  ["alimentos", "Comprei alimentos por 80 reais", "foods"],
  ["padaria pela descrição", "Gastei 18 reais", "foods", "Padaria Central"],
  ["conta de luz", "Paguei 135 na conta de luz", "fixes"],
  ["internet", "Paguei a internet, 99 reais", "fixes"],
  ["compras", "Fiz compras de 250 reais", "shopping"],
  ["tênis", "Comprei um tênis por 300", "shopping"],
  ["Amazon", "Compra de 90 reais na Amazon", "shopping"],
  ["Mercado Livre", "Gastei 70 no Mercado Livre", "shopping"],
  ["Uber", "Uber para o trabalho, 24 reais", "transport"],
  ["combustível", "Abasteci 200 reais de gasolina", "transport"],
  [
    "iFood prevalece sobre comida",
    "Pedi uma pizza no iFood por 55",
    "delivery",
  ],
  ["assinatura", "Mensalidade da Netflix, 39,90", "subscriptions"],
  ["moradia", "Paguei 1.500 de aluguel", "housing"],
  ["lazer", "Gastei 45 no cinema", "entertainment"],
];

for (const [name, message, expected, description] of expenseCases) {
  test(`infere ${expected} para ${name}`, () => {
    assert.equal(
      inferTransactionCategory(message, description, "expense"),
      expected,
    );
  });
}

test("infere categorias de receita", () => {
  assert.equal(
    inferTransactionCategory("Recebi meu salário hoje", null, "income"),
    "salary",
  );
  assert.equal(
    inferTransactionCategory("Entrou 500 de um freela", null, "income"),
    "extra",
  );
});

test("canonicaliza nomes em português e rejeita categoria fora da taxonomia", () => {
  assert.equal(
    canonicalizeTransactionCategory("Alimentação", "expense"),
    "foods",
  );
  assert.equal(canonicalizeTransactionCategory("Contas", "expense"), "fixes");
  assert.equal(canonicalizeTransactionCategory("Saúde", "expense"), null);
  assert.equal(canonicalizeTransactionCategory("foods", "income"), null);
});

test("substitui other do modelo quando a mensagem tem uma categoria clara", () => {
  assert.equal(
    resolveTransactionCategory({
      messageText: "Gastei 86 reais no mercado",
      description: "mercado",
      transactionType: "expense",
      suggestedCategory: "other",
    }),
    "foods",
  );
});

test("usa a categoria determinística do filtro antes do fallback other", () => {
  assert.equal(
    resolveTransactionCategory({
      messageText: "Gastei 60 comprando alimentos",
      description: "alimentos",
      transactionType: "expense",
      suggestedCategory: "other",
      filterCategory: "foods",
    }),
    "foods",
  );
});

test("preserva uma categoria válida do modelo quando não há escolha explícita", () => {
  assert.equal(
    resolveTransactionCategory({
      messageText: "Gastei 80 no veterinário",
      description: "veterinário",
      transactionType: "expense",
      suggestedCategory: "shopping",
    }),
    "shopping",
  );
});

test("a categoria explicitamente informada pelo usuário tem prioridade", () => {
  assert.equal(
    resolveTransactionCategory({
      messageText: "Gastei 20 no mercado, categoria outros",
      description: "mercado",
      transactionType: "expense",
      suggestedCategory: "foods",
    }),
    "other",
  );
  assert.equal(
    resolveTransactionCategory({
      messageText: "Gastei 20 e classifique como transporte",
      description: "lançamento",
      transactionType: "expense",
      suggestedCategory: "foods",
    }),
    "transport",
  );
});

test("categoria desconhecida nunca é persistida", () => {
  assert.equal(
    resolveTransactionCategory({
      messageText: "Gastei 25 no chaveiro",
      description: "chaveiro",
      transactionType: "expense",
      suggestedCategory: "serviços",
    }),
    "other",
  );
});

test("normaliza somente comandos de criação e grava a categoria em data", () => {
  const command = {
    action: "create",
    resource: "transaction",
    transactionType: "expense",
    data: {
      description: "padaria",
      amount: 15,
      category: "other",
    },
    confidence: 0.9,
  };

  const normalized = normalizeCommandCategory(
    "Gastei 15 reais na padaria",
    command,
  );

  assert.notEqual(normalized, command);
  assert.equal(normalized.data.category, "foods");
  assert.equal(command.data.category, "other");

  const query = {
    action: "query",
    resource: "transaction",
    transactionType: "expense",
    confidence: 0.9,
  };
  assert.equal(normalizeCommandCategory("gastos no mercado", query), query);
});

test("corrige a saída other do modelo no mesmo pipeline usado pelo webhook", () => {
  const message = "Gastei 92 reais no supermercado";
  const interpreted = {
    action: "create",
    resource: "transaction",
    transactionType: "expense",
    data: {
      description: "supermercado",
      amount: 92,
      category: "other",
    },
    confidence: 0.9,
  };

  const withFilters = normalizeCommandFilters(
    message,
    interpreted,
    new Date("2026-07-19T12:00:00-03:00"),
  );
  const normalized = normalizeCommandCategory(message, withFilters);

  assert.equal(withFilters.filters.category, "foods");
  assert.equal(normalized.data.category, "foods");
});
