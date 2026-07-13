import assert from "node:assert/strict"
import test from "node:test"
import { registerHooks } from "node:module"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

globalThis.__transactionMutationCalls = []

const firebaseStub = `data:text/javascript,${encodeURIComponent(
  "export const db = {};",
)}`
const normalServiceStub = `data:text/javascript,${encodeURIComponent(`
  export async function updateTransaction(...args) {
    globalThis.__transactionMutationCalls.push({ source: "transaction", args });
  }
`)}`
const cardServiceStub = `data:text/javascript,${encodeURIComponent(`
  export async function updateCardTransaction(...args) {
    globalThis.__transactionMutationCalls.push({ source: "card_transaction", args });
  }
`)}`

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/firebaseAdmin") {
      return { url: firebaseStub, shortCircuit: true }
    }
    if (specifier === "@/lib/services/admin/transactionsAdmin") {
      return { url: normalServiceStub, shortCircuit: true }
    }
    if (specifier === "@/lib/services/admin/cardTransactionsAdmin") {
      return { url: cardServiceStub, shortCircuit: true }
    }
    if (specifier.startsWith("@/")) {
      const path = resolve(process.cwd(), `${specifier.slice(2)}.ts`)
      return nextResolve(pathToFileURL(path).href, context)
    }
    const relative = specifier.startsWith("./") || specifier.startsWith("../")
    const isProjectModule =
      context.parentURL?.includes("/lib/whatsapp/") ||
      context.parentURL?.includes("\\lib\\whatsapp\\")
    if (relative && isProjectModule && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context)
    }
    return nextResolve(specifier, context)
  },
})

const {
  beginUpdateForTarget,
  createPendingUpdateAction,
  handleUpdateTransactionPendingAction,
} = await import("./updateTransactionHandler.ts")

const normalTarget = {
  id: "normal-1",
  source: "transaction",
  description: "padaria",
  date: "2026-07-13",
  amount: -4.85,
  category: "other",
  type: "expense",
  paymentMethod: "pix",
  cardName: null,
}

const cardTarget = {
  ...normalTarget,
  id: "card-1",
  source: "card_transaction",
  paymentMethod: "credit_card",
  cardName: "Nubank",
}

function takeLastMutation() {
  return globalThis.__transactionMutationCalls.at(-1)
}

test("aplica o novo valor imediatamente em transações comuns e de cartão", async () => {
  globalThis.__transactionMutationCalls.length = 0

  const commonResult = await beginUpdateForTarget("user-1", normalTarget, {
    field: "amount",
    value: 4.75,
  })
  assert.equal(commonResult.completed, true)
  assert.equal(commonResult.updatedTarget?.amount, -4.75)
  assert.deepEqual(takeLastMutation(), {
    source: "transaction",
    args: ["user-1", "normal-1", { amount: -4.75 }],
  })

  const cardResult = await beginUpdateForTarget("user-1", cardTarget, {
    field: "amount",
    value: "4,75",
  })
  assert.equal(cardResult.completed, true)
  assert.equal(cardResult.updatedTarget?.amount, -4.75)
  assert.deepEqual(takeLastMutation(), {
    source: "card_transaction",
    args: ["user-1", "card-1", { amount: -4.75 }],
  })
})

test("lista de atualização → 1 aplica campo e valor já preservados", async () => {
  globalThis.__transactionMutationCalls.length = 0
  const pending = createPendingUpdateAction({
    step: "transaction",
    candidates: [cardTarget, normalTarget],
    update: { field: "amount", value: 4.75 },
  })

  const result = await handleUpdateTransactionPendingAction(
    "user-1",
    pending,
    "1",
  )
  assert.equal(result.completed, true)
  assert.equal(result.updatedTarget?.id, "card-1")
  assert.equal(takeLastMutation().source, "card_transaction")
  assert.deepEqual(takeLastMutation().args[2], { amount: -4.75 })
})

test("atualiza descrição, data, categoria e método de pagamento", async () => {
  globalThis.__transactionMutationCalls.length = 0

  await beginUpdateForTarget("user-1", normalTarget, {
    field: "description",
    value: "Padaria Central",
  })
  assert.deepEqual(takeLastMutation().args[2], {
    description: "Padaria Central",
  })

  await beginUpdateForTarget("user-1", normalTarget, {
    field: "date",
    value: "14/07/2026",
  })
  assert.deepEqual(takeLastMutation().args[2], { date: "2026-07-14" })

  await beginUpdateForTarget("user-1", normalTarget, {
    field: "category",
    value: "alimentação",
  })
  assert.equal(typeof takeLastMutation().args[2].category, "string")

  await beginUpdateForTarget("user-1", normalTarget, {
    field: "paymentMethod",
    value: "pix",
  })
  assert.deepEqual(takeLastMutation().args[2], { paymentMethod: "pix" })

  await beginUpdateForTarget("user-1", cardTarget, {
    field: "paymentMethod",
    value: "cartão Nubank",
  })
  assert.equal(takeLastMutation().source, "card_transaction")
  assert.deepEqual(takeLastMutation().args[2], { card: "Nubank" })
})
