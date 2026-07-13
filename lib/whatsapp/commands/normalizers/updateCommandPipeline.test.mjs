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
    if (relative && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context)
    }
    return nextResolve(specifier, context)
  },
})

const { normalizeCommandUpdate } = await import("./updateNormalizer.ts")
const { normalizeCommandPeriod } = await import("./periodNormalizer.ts")
const { normalizeCommandScope } = await import("./scopeNormalizer.ts")
const { normalizeCommandFilters } = await import("./filterNormalizer.ts")

const currentDate = new Date(2026, 6, 13, 12)

function pipeline(messageText, interpreted) {
  let command = normalizeCommandUpdate(messageText, interpreted)
  const targetText = command.update?.targetText ?? ""
  command = normalizeCommandPeriod(targetText, command, currentDate)
  command = normalizeCommandScope(targetText, command, currentDate)
  command = normalizeCommandFilters(targetText, command, currentDate)
  return command
}

test("novo valor nao contamina alvo e update sem alvo inclui cartoes", () => {
  const command = pipeline("altere o valor para 4.75", {
    action: "update",
    resource: "transaction",
    transactionType: "expense",
    confidence: 0.9,
    data: { amount: 4.75 },
    filters: { amount: 4.75 },
    scope: {
      includeNormalTransactions: true,
      includeCardTransactions: false,
      excludeCardTransactions: false,
      paymentMethod: null,
      excludePaymentMethod: null,
    },
  })

  assert.equal(command.update?.field, "amount")
  assert.equal(command.update?.value, 4.75)
  assert.equal(command.update?.reference, "recent")
  assert.equal(command.filters?.amount, undefined)
  assert.equal(command.scope?.includeNormalTransactions, true)
  assert.equal(command.scope?.includeCardTransactions, true)
})

test("alvo padaria permanece filtro e novo metodo nao restringe a origem", () => {
  const command = pipeline(
    "altere o método de pagamento da padaria para pix",
    {
      action: "update",
      resource: "transaction",
      confidence: 0.9,
      scope: {
        includeNormalTransactions: true,
        includeCardTransactions: false,
        excludeCardTransactions: true,
        paymentMethod: "pix",
        excludePaymentMethod: "credit_card",
      },
      data: { paymentMethod: "pix" },
    },
  )

  assert.equal(command.filters?.description, "padaria")
  assert.equal(command.update?.value, "pix")
  assert.equal(command.scope?.includeNormalTransactions, true)
  assert.equal(command.scope?.includeCardTransactions, true)
  assert.equal(command.scope?.paymentMethod, null)
})

test("ultima despesa e reconhecida sem transformar o novo valor em filtro", () => {
  const command = pipeline("altere o valor da última despesa para 4,75", {
    action: "update",
    resource: "transaction",
    confidence: 0.9,
  })

  assert.equal(command.transactionType, "expense")
  assert.equal(command.update?.reference, "latest")
  assert.equal(command.update?.value, 4.75)
  assert.equal(command.filters?.amount, undefined)
  assert.equal(command.scope?.includeCardTransactions, true)
})

test("nova data não vira período usado para localizar a transação antiga", () => {
  const command = pipeline(
    "altere a data da padaria para 14/07/2026",
    {
      action: "update",
      resource: "transaction",
      transactionType: "expense",
      confidence: 0.9,
      data: { date: "2026-07-14" },
      period: {
        type: "date_range",
        startDate: "2026-07-14",
        endDate: "2026-07-14",
        isExplicit: true,
      },
    },
  )

  assert.equal(command.update?.field, "date")
  assert.equal(command.update?.value, "14/07/2026")
  assert.equal(command.filters?.description, "padaria")
  assert.equal(command.period?.isExplicit, false)
  assert.equal(command.data?.date, undefined)
})

test("novo cartão não restringe a origem antes de mover a transação", () => {
  const command = pipeline(
    "altere o método de pagamento da padaria para cartão Nubank",
    {
      action: "update",
      resource: "card_transaction",
      transactionType: "expense",
      confidence: 0.9,
      data: { paymentMethod: "credit_card", cardName: "Nubank" },
      scope: {
        includeNormalTransactions: false,
        includeCardTransactions: true,
        cardName: "Nubank",
        paymentMethod: "credit_card",
      },
    },
  )

  assert.equal(command.filters?.description, "padaria")
  assert.equal(command.update?.value, "cartão Nubank")
  assert.equal(command.scope?.includeNormalTransactions, true)
  assert.equal(command.scope?.includeCardTransactions, true)
  assert.equal(command.scope?.cardName, null)
  assert.equal(command.data?.cardName, null)
})

test("alvo combinado mantém descrição e cartão antigos", () => {
  const command = pipeline(
    "altere o valor da padaria no cartão Nubank para 4,75",
    {
      action: "update",
      resource: "card_transaction",
      transactionType: "expense",
      confidence: 0.9,
    },
  )

  assert.equal(command.filters?.description, "padaria")
  assert.equal(command.scope?.includeNormalTransactions, false)
  assert.equal(command.scope?.includeCardTransactions, true)
  assert.equal(command.scope?.cardName, "Nubank")
})

test("data antiga no alvo não é transformada em parte da descrição", () => {
  const command = pipeline(
    "altere o valor da padaria do dia 12/07/2026 para 4,75",
    {
      action: "update",
      resource: "transaction",
      transactionType: "expense",
      confidence: 0.9,
    },
  )

  assert.equal(command.filters?.description, "padaria")
  assert.equal(command.period?.startDate, "2026-07-12")
  assert.equal(command.period?.endDate, "2026-07-12")
})
