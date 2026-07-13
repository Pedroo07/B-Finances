import assert from "node:assert/strict"
import test from "node:test"
import { registerHooks } from "node:module"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

registerHooks({
  resolve(specifier, context, nextResolve) {
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
  createPendingUpdateAction,
  createQuerySelectionAction,
  handleUpdateTransactionPendingAction,
  isPendingQueryTransactionSelectionAction,
  isPendingUpdateTransactionAction,
  resolveQueryTransactionSelection,
} = await import("./updateTransactionHandler.ts")

const target = {
  id: "card-1",
  source: "card_transaction",
  description: "padaria",
  date: "2026-07-13",
  amount: -4.85,
  category: "other",
  type: "expense",
  paymentMethod: "credit_card",
  cardName: "Nubank",
  createdAt: "2026-07-14T02:11:00.000Z",
}

test("ações pendentes são versionadas e estados antigos são rejeitados", async () => {
  const current = createPendingUpdateAction({
    step: "field",
    target,
    update: { value: 4.75 },
  })
  assert.equal(isPendingUpdateTransactionAction(current), true)

  const stale = { ...current, version: 1 }
  assert.equal(isPendingUpdateTransactionAction(stale), false)
  const result = await handleUpdateTransactionPendingAction(
    "user-1",
    stale,
    "valor",
  )
  assert.equal(result.completed, true)
  assert.match(result.message, /versão anterior/)
})

test("edição expirada é encerrada com mensagem amigável", async () => {
  const expired = {
    ...createPendingUpdateAction({ step: "field", target }),
    expiresAt: "2000-01-01T00:00:00.000Z",
  }
  const result = await handleUpdateTransactionPendingAction(
    "user-1",
    expired,
    "valor",
  )
  assert.equal(result.completed, true)
  assert.match(result.message, /expirou/)
})

test("lista consultada aceita apenas um número válido e também expira", () => {
  const action = createQuerySelectionAction([target])
  assert.equal(isPendingQueryTransactionSelectionAction(action), true)
  assert.equal(resolveQueryTransactionSelection(action, "1").target?.id, "card-1")
  assert.equal(resolveQueryTransactionSelection(action, "2").valid, false)
  assert.equal(resolveQueryTransactionSelection(action, "padaria").valid, false)

  const expired = { ...action, expiresAt: "2000-01-01T00:00:00.000Z" }
  assert.equal(resolveQueryTransactionSelection(expired, "1").expired, true)
})
