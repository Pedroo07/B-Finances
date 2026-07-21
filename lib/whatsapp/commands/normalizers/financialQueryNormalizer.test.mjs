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

const { normalizeCommandFilters } = await import("./filterNormalizer.ts");
const { normalizeCommandPeriod } = await import("./periodNormalizer.ts");
const { normalizeCommandResource } = await import("./resourceNormalizer.ts");

const currentDate = new Date(2026, 6, 21);

function query(resource, overrides = {}) {
  return {
    action: "query",
    resource,
    operation: resource === "summary" ? "summary" : "list",
    confidence: 0.9,
    ...overrides,
  };
}

test("resolve o mes atual como mes civil completo", () => {
  const command = normalizeCommandPeriod(
    "resumo financeiro do mês atual",
    query("summary"),
    currentDate,
  );

  assert.equal(command.period?.type, "current_month");
  assert.equal(command.period?.startDate, "2026-07-01");
  assert.equal(command.period?.endDate, "2026-07-31");
});

test("resolve mes por nome, numero e ano opcional", () => {
  const june = normalizeCommandPeriod(
    "resumo financeiro do mês de junho",
    query("summary"),
    currentDate,
  );
  const march = normalizeCommandPeriod(
    "resumo do mês 03",
    query("summary"),
    currentDate,
  );
  const datedMarch = normalizeCommandPeriod(
    "resumo do mês 03/2025",
    query("summary"),
    currentDate,
  );

  assert.deepEqual(
    [june.period?.startDate, june.period?.endDate],
    ["2026-06-01", "2026-06-30"],
  );
  assert.deepEqual(
    [march.period?.startDate, march.period?.endDate],
    ["2026-03-01", "2026-03-31"],
  );
  assert.deepEqual(
    [datedMarch.period?.startDate, datedMarch.period?.endDate],
    ["2025-03-01", "2025-03-31"],
  );
});

test("resumo sem periodo usa o mes atual", () => {
  const command = normalizeCommandPeriod(
    "me dê um resumo financeiro",
    query("summary"),
    currentDate,
  );

  assert.equal(command.period?.startDate, "2026-07-01");
  assert.equal(command.period?.endDate, "2026-07-31");
});

test("periodo do resumo nao vira filtro de descricao", () => {
  for (const message of [
    "resumo financeiro do meu mês atual até o momento",
    "resumo financeiro do mês de junho",
    "resumo financeiro do mês 03",
  ]) {
    const command = normalizeCommandFilters(
      message,
      query("summary", {
        filters: {
          description: "mes de junho",
          category: "foods",
          minAmount: 10,
        },
      }),
      currentDate,
    );

    assert.equal(command.filters?.description, undefined);
    assert.equal(command.filters?.category, undefined);
    assert.equal(command.filters?.minAmount, undefined);
    assert.equal(command.transactionType, "all");
  }
});

test("separa faturas de contas e preserva compras da fatura", () => {
  const openInvoices = normalizeCommandResource(
    "quais minhas faturas em aberto?",
    query("bill", {
      scope: {
        includeNormalTransactions: false,
        includeCardTransactions: true,
        cardName: "Nubank",
      },
    }),
  );
  const cardInvoice = normalizeCommandResource(
    "fatura do cartão Nubank",
    query("bill"),
  );
  const invoiceExpenses = normalizeCommandResource(
    "gastos da fatura do cartão Nubank",
    query("invoice"),
  );

  assert.equal(openInvoices.resource, "invoice");
  assert.equal(openInvoices.operation, "list");
  assert.equal(openInvoices.scope?.cardName, null);
  assert.equal(cardInvoice.resource, "invoice");
  assert.equal(cardInvoice.operation, "detail");
  assert.equal(cardInvoice.scope?.cardName, "Nubank");
  assert.equal(invoiceExpenses.resource, "card_transaction");
  assert.equal(invoiceExpenses.transactionType, "expense");
});
