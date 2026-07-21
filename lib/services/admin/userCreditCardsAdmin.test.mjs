import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const dataModule = (source) =>
  `data:text/javascript,${encodeURIComponent(source)}`;
const firebaseAdminStub = dataModule("export const db = {};");
const cardTransactionsStub = dataModule(`
  export async function getCardTransactions() { return []; }
`);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/firebaseAdmin") {
      return { url: firebaseAdminStub, shortCircuit: true };
    }
    if (specifier === "./cardTransactionsAdmin") {
      return { url: cardTransactionsStub, shortCircuit: true };
    }
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

const { buildOpenCardInvoices, selectCurrentOpenCardInvoices } =
  await import("./userCreditCardsAdmin.ts");

test("calcula todas as competencias abertas e desconta pagamentos", () => {
  const cards = [
    {
      id: "nubank",
      bankKey: "nubank",
      closingDay: 10,
      dueDay: 20,
      invoices: {
        "2026-07": {
          amountPaid: 80,
          paidAt: "2026-07-20",
          transactionId: "paid-july",
        },
        "2026-08": {
          amountPaid: 40,
          paidAt: "2026-08-01",
          transactionId: "partial-august",
        },
      },
    },
    {
      id: "unconfigured",
      bankKey: "inter",
      invoices: {},
    },
  ];
  const transactions = [
    {
      id: "paid",
      description: "Compra paga",
      category: "shopping",
      card: "Nubank",
      date: "2026-06-11",
      amount: -80,
    },
    {
      id: "overdue",
      description: "Compra vencida",
      category: "foods",
      card: "Nubank",
      date: "2026-05-11",
      amount: -25,
    },
    {
      id: "current-1",
      description: "Mercado",
      category: "foods",
      card: "nubank",
      date: "2026-07-11",
      amount: -100,
    },
    {
      id: "current-2",
      description: "Faculdade",
      category: "fixes",
      card: "Nubank",
      date: "2026-07-15",
      amount: -50,
    },
    {
      id: "future-installment",
      description: "Parcela futura",
      category: "shopping",
      card: "Nubank",
      date: "2026-08-11",
      amount: -30,
    },
    {
      id: "ignored-unconfigured",
      description: "Inter",
      category: "other",
      card: "Inter",
      date: "2026-07-15",
      amount: -999,
    },
  ];

  const openInvoices = buildOpenCardInvoices(cards, transactions);
  assert.deepEqual(openInvoices, [
    {
      cardName: "Nubank",
      periodKey: "2026-06",
      dueDate: "2026-06-20",
      amount: 25,
    },
    {
      cardName: "Nubank",
      periodKey: "2026-08",
      dueDate: "2026-08-20",
      amount: 110,
    },
    {
      cardName: "Nubank",
      periodKey: "2026-09",
      dueDate: "2026-09-20",
      amount: 30,
    },
  ]);

  assert.deepEqual(selectCurrentOpenCardInvoices(openInvoices, "2026-07-21"), [
    {
      cardName: "Nubank",
      periodKey: "2026-08",
      dueDate: "2026-08-20",
      amount: 110,
    },
  ]);
});
