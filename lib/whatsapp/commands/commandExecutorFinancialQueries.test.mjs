import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const state = {
  normalTransactions: [],
  cardTransactions: [],
  pendingBills: [],
  investments: [],
  openInvoices: [],
  currentInvoice: null,
};
globalThis.__financialQueryState = state;

const dataModule = (source) =>
  `data:text/javascript,${encodeURIComponent(source)}`;
const stubs = new Map([
  ["@/lib/services/admin/cardTransactionsAdmin", dataModule(`
    const state = globalThis.__financialQueryState;
    export async function getCardTransactions() { return state.cardTransactions; }
    export async function createCardTransaction() { throw new Error("unused"); }
    export async function createCardInstallmentTransactions() { throw new Error("unused"); }
  `)],
  ["@/lib/services/admin/billAccountsAdmin", dataModule(`
    const state = globalThis.__financialQueryState;
    export async function getPendingBills() { return state.pendingBills; }
    export async function getUpcomingBills() { return state.pendingBills; }
  `)],
  ["@/lib/services/admin/transactionsAdmin", dataModule(`
    const state = globalThis.__financialQueryState;
    export async function getTransactions() { return state.normalTransactions; }
    export async function createTransaction() { throw new Error("unused"); }
  `)],
  ["@/lib/services/admin/userCreditCardsAdmin", dataModule(`
    const state = globalThis.__financialQueryState;
    export async function getOpenCardInvoices() { return state.openInvoices; }
    export async function getCurrentCardInvoiceTransactions() { return state.currentInvoice; }
    export async function getAllCardInvoices() { return state.openInvoices; }
    export async function getCardInvoiceSummary() { return state.currentInvoice; }
    export async function getUserCreditCards() { return []; }
  `)],
  ["@/lib/services/admin/investmentsAdmin", dataModule(`
    const state = globalThis.__financialQueryState;
    export async function getInvestments() { return state.investments; }
  `)],
  ["../handlers/updateTransactionHandler", dataModule(`
    export async function beginUpdateForTarget() { throw new Error("unused"); }
    export function buildTransactionSelectionMessage() { return ""; }
    export function createPendingUpdateAction() { return null; }
  `)],
  ["../handlers/updateTransactionFlow", dataModule(`
    export function compareCreatedAtDescending(a, b) {
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    }
    export function resolveUpdateTargetStrategy() { return "criteria"; }
  `)],
  ["../handlers/deleteHandler", dataModule(`
    export async function handleDelete() { throw new Error("unused"); }
  `)],
  ["../handlers/paymentHandler", dataModule(`
    export async function handlePayment() { throw new Error("unused"); }
  `)],
  ["../utils/brasiliaDate", dataModule(`
    export function getBrasiliaDate() { return new Date(2026, 6, 21, 12, 0, 0); }
  `)],
  ["../intents/intentTypes", dataModule(`
    export const IntentType = {
      DELETE_CARD_TRANSACTION: "DELETE_CARD_TRANSACTION",
      DELETE_TRANSACTION: "DELETE_TRANSACTION",
      PAY_CARD_INVOICE: "PAY_CARD_INVOICE",
      PAY_BILL: "PAY_BILL",
    };
  `)],
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const stub = stubs.get(specifier);
    if (stub) return { url: stub, shortCircuit: true };
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

const { executeBFinanceCommand } = await import("./commandExecutor.ts");
const { formatBFinanceResponse } = await import("./responseFormatter.ts");

const julyPeriod = {
  raw: "julho",
  type: "current_month",
  startDate: "2026-07-01",
  endDate: "2026-07-31",
  month: 7,
  year: 2026,
  days: null,
  isExplicit: true,
};

function summaryCommand() {
  return {
    action: "query",
    resource: "summary",
    operation: "summary",
    transactionType: "all",
    period: julyPeriod,
    confidence: 1,
  };
}

test("resumo usa o mes completo e separa cartoes, categorias e contas", async () => {
  state.normalTransactions = [
    {
      id: "income",
      description: "Salário",
      date: "2026-07-05",
      amount: 1000,
      category: "salary",
      type: "income",
      paymentMethod: "pix",
    },
    {
      id: "market",
      description: "Mercado",
      date: "2026-07-10",
      amount: -100,
      category: "foods",
      type: "expense",
      paymentMethod: "pix",
    },
    {
      id: "august",
      description: "Fora do período",
      date: "2026-08-01",
      amount: -200,
      category: "other",
      type: "expense",
      paymentMethod: "pix",
    },
  ];
  state.cardTransactions = [
    {
      id: "nubank",
      description: "Supermercado",
      date: "2026-07-15",
      amount: -300,
      category: "foods",
      card: "Nubank",
    },
    {
      id: "inter-future-day",
      description: "Ifood",
      date: "2026-07-30",
      amount: -50,
      category: "delivery",
      card: "Inter",
    },
    {
      id: "inter-august",
      description: "Fora do período",
      date: "2026-08-01",
      amount: -70,
      category: "other",
      card: "Inter",
    },
  ];
  state.pendingBills = [
    {
      id: "rent",
      description: "Aluguel",
      amount: 180,
      dueDate: "2026-07-22",
      status: "pending",
    },
    {
      id: "invoice-august",
      description: "Fatura Nubank",
      amount: 393.38,
      dueDate: "2026-08-20",
      status: "pending",
    },
  ];
  state.investments = [
    { id: "cdb", category: "CDB", balance: 2000, total_yield: 50 },
  ];

  const result = await executeBFinanceCommand({
    userId: "user-1",
    command: summaryCommand(),
    messageText: "resumo financeiro do mês atual",
  });

  assert.equal(result.kind, "financial_summary");
  assert.equal(result.totals.income, 1000);
  assert.equal(result.totals.normalExpense, 100);
  assert.equal(result.totals.cardExpense, 350);
  assert.deepEqual(result.cardBreakdown, [
    { cardName: "Nubank", total: 300, count: 1 },
    { cardName: "Inter", total: 50, count: 1 },
  ]);
  assert.deepEqual(result.categoryBreakdown, [
    { label: "foods", total: 400, count: 2 },
    { label: "delivery", total: 50, count: 1 },
  ]);
  assert.deepEqual(result.pendingBills.map(({ id }) => id), ["rent"]);

  const response = formatBFinanceResponse(result);
  assert.match(response, /Receitas: R\$\s*1\.000,00/);
  assert.match(response, /Gastos: R\$\s*100,00/);
  assert.match(response, /Gastos por cartão: R\$\s*350,00/);
  assert.match(response, /Investimentos \(posição atual\): R\$\s*2\.000,00/);
  assert.match(response, /Contas a pagar de julho\/2026: R\$\s*180,00 \(1\)/);
  assert.match(response, /Gastos por categoria:/);
  assert.doesNotMatch(response, /Saldo:/);
  assert.doesNotMatch(response, /20\/08\/2026/);
});

test("lista apenas faturas abertas e consulta o ciclo atual do cartao", async () => {
  state.openInvoices = [
    {
      cardName: "Mercado Pago",
      amount: 35.55,
      dueDate: "2026-08-06",
      periodKey: "2026-08",
    },
    {
      cardName: "Nubank",
      amount: 393.38,
      dueDate: "2026-08-20",
      periodKey: "2026-08",
    },
  ];
  state.currentInvoice = {
    cardName: "Nubank",
    amount: 393.38,
    dueDate: "2026-08-20",
    periodKey: "2026-08",
    startDate: "2026-07-11",
    endDate: "2026-08-10",
    transactions: [],
  };

  const allResult = await executeBFinanceCommand({
    userId: "user-1",
    command: {
      action: "query",
      resource: "invoice",
      operation: "list",
      transactionType: "all",
      period: {
        type: "all",
        isExplicit: false,
      },
      scope: {
        includeNormalTransactions: false,
        includeCardTransactions: true,
        cardName: null,
        paymentMethod: "credit_card",
      },
      confidence: 1,
    },
    messageText: "quais minhas faturas em aberto?",
  });
  const allResponse = formatBFinanceResponse(allResult);

  assert.equal(allResult.kind, "invoice_summary");
  assert.equal(allResult.mode, "open");
  assert.equal(allResult.total, 428.93);
  assert.match(allResponse, /Faturas em aberto/);
  assert.match(allResponse, /Mercado Pago/);
  assert.match(allResponse, /Nubank/);
  assert.doesNotMatch(allResponse, /Aluguel/);

  const cardResult = await executeBFinanceCommand({
    userId: "user-1",
    command: {
      action: "query",
      resource: "invoice",
      operation: "detail",
      transactionType: "all",
      period: { type: "all", isExplicit: false },
      scope: {
        includeNormalTransactions: false,
        includeCardTransactions: true,
        cardName: "Nubank",
        paymentMethod: "credit_card",
      },
      confidence: 1,
    },
    messageText: "fatura do cartão Nubank",
  });
  const cardResponse = formatBFinanceResponse(cardResult);

  assert.equal(cardResult.kind, "invoice_summary");
  assert.equal(cardResult.invoices[0].periodKey, "2026-08");
  assert.match(cardResponse, /Valor: R\$\s*393,38/);
  assert.match(cardResponse, /Vencimento: 20\/08\/2026/);
});
