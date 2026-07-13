import assert from "node:assert/strict"
import test from "node:test"

import {
  clearlyStartsNewCommand,
  compareCreatedAtDescending,
  getNextUpdateStep,
  getNextUpdateStepAfterFieldSelection,
  resolveUpdateTargetStrategy,
  selectCandidateByNumber,
} from "./updateTransactionFlow.ts"

test("seleciona o item numerado preservando a identidade", () => {
  const candidates = [{ id: "a" }, { id: "b" }]
  assert.equal(selectCandidateByNumber(candidates, "1")?.id, "a")
  assert.equal(selectCandidateByNumber(candidates, "#2")?.id, "b")
  assert.equal(selectCandidateByNumber(candidates, "3"), null)
  assert.equal(selectCandidateByNumber(candidates, "padaria"), null)
})

test("um novo pedido de alteração abandona a edição pendente anterior", () => {
  assert.equal(
    clearlyStartsNewCommand("altere o valor do mercado para 10"),
    true,
  )
  assert.equal(clearlyStartsNewCommand("4,75"), false)
  assert.equal(clearlyStartsNewCommand("descrição"), false)
})

test("aplica imediatamente quando campo e valor ja foram informados", () => {
  assert.deepEqual(getNextUpdateStep({ field: "amount", value: 4.75 }), {
    kind: "apply",
    field: "amount",
    value: 4.75,
  })
})

test("pergunta somente a informacao que falta", () => {
  assert.deepEqual(getNextUpdateStep({ field: "amount", value: null }), {
    kind: "ask_value",
    field: "amount",
  })
  assert.deepEqual(getNextUpdateStep(), { kind: "ask_field" })
})

test("preserva o valor informado quando o usuário responde somente o campo", () => {
  assert.deepEqual(
    getNextUpdateStepAfterFieldSelection(
      { field: null, value: "Mercado Central" },
      "description",
    ),
    {
      kind: "apply",
      field: "description",
      value: "Mercado Central",
    },
  )
  assert.deepEqual(
    getNextUpdateStepAfterFieldSelection(undefined, "amount", "4,75"),
    { kind: "apply", field: "amount", value: "4,75" },
  )
})

test("prioriza contexto recente e consulta a ultima por createTime quando necessario", () => {
  assert.equal(
    resolveUpdateTargetStrategy({
      reference: "recent",
      hasExplicitTarget: false,
      hasRecentTarget: true,
      recentMatchesType: true,
    }),
    "recent",
  )
  assert.equal(
    resolveUpdateTargetStrategy({
      reference: "latest",
      hasExplicitTarget: false,
      hasRecentTarget: true,
      recentMatchesType: true,
    }),
    "query",
  )
  assert.equal(
    resolveUpdateTargetStrategy({
      reference: "latest",
      hasExplicitTarget: false,
      hasRecentTarget: false,
      recentMatchesType: false,
    }),
    "query",
  )
  assert.equal(
    resolveUpdateTargetStrategy({
      reference: "recent",
      hasExplicitTarget: false,
      hasRecentTarget: false,
      recentMatchesType: false,
    }),
    "criteria",
  )
})

test("ordena a última transação pelo createTime, não pela data informada", () => {
  const candidates = [
    {
      id: "data-futura-criada-antes",
      date: "2026-07-14",
      createdAt: "2026-07-13T20:00:00.000Z",
    },
    {
      id: "criada-por-ultimo",
      date: "2026-07-13",
      createdAt: "2026-07-13T23:11:00.000Z",
    },
  ]

  candidates.sort(compareCreatedAtDescending)
  assert.equal(candidates[0].id, "criada-por-ultimo")
})
