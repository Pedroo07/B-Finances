import assert from "node:assert/strict"
import test from "node:test"
import { registerHooks } from "node:module"

registerHooks({
  resolve(specifier, context, nextResolve) {
    const relative = specifier.startsWith("./") || specifier.startsWith("../")
    if (relative && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context)
    }
    return nextResolve(specifier, context)
  },
})

const { resolveCreationDate } = await import("./creationDateResolver.ts")

const AT_2311_IN_BRASILIA = new Date("2026-07-14T02:11:00.000Z")

test("sem data explícita usa o dia de Brasília mesmo após a virada UTC", () => {
  assert.equal(
    resolveCreationDate(
      "padaria 4,85 cartão Nubank",
      "2026-07-14",
      AT_2311_IN_BRASILIA,
    ),
    "2026-07-13",
  )
})

test("preserva referências de data realmente informadas pelo usuário", () => {
  assert.equal(
    resolveCreationDate("padaria 4,85 amanhã", null, AT_2311_IN_BRASILIA),
    "2026-07-14",
  )
  assert.equal(
    resolveCreationDate("padaria 4,85 em 12/07/2026", null, AT_2311_IN_BRASILIA),
    "2026-07-12",
  )
  assert.equal(
    resolveCreationDate(
      "padaria 4,85 na segunda-feira passada",
      "2026-07-06",
      AT_2311_IN_BRASILIA,
    ),
    "2026-07-06",
  )
})
