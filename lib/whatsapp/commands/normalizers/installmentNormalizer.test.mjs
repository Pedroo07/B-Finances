import assert from "node:assert/strict"
import test from "node:test"

import {
  extractInstallmentMention,
  normalizeCommandInstallments,
} from "./installmentNormalizer.ts"

test("reconhece quantidade compacta", () => {
  assert.deepEqual(
    extractInstallmentMention("Comprei um tenis de 1500 parcelado em 10x"),
    { requested: true, count: 10 },
  )
})

test("reconhece parcelado e dividido por extenso", () => {
  assert.deepEqual(
    extractInstallmentMention("Dividi a compra em dez vezes"),
    { requested: true, count: 10 },
  )
  assert.deepEqual(
    extractInstallmentMention("Foi parcelado em três parcelas"),
    { requested: true, count: 3 },
  )
})

test("usa a vista quando nao existe indicacao", () => {
  assert.deepEqual(
    extractInstallmentMention("Comprei um tenis de 1500"),
    { requested: false, count: 1 },
  )
})

test("identifica pedido incompleto e quantidade fora do limite", () => {
  assert.deepEqual(
    extractInstallmentMention("Comprei parcelado"),
    { requested: true, count: null },
  )
  assert.deepEqual(
    extractInstallmentMention("Comprei em 15x"),
    { requested: true, count: 15 },
  )
  assert.deepEqual(
    extractInstallmentMention("Quero cadastrar uma compra recorrente"),
    { requested: true, count: null },
  )
})

test("normaliza somente criacao de despesa", () => {
  const command = normalizeCommandInstallments(
    "Comprei por 300 dividido em 4x",
    {
      action: "create",
      resource: "transaction",
      transactionType: "expense",
      confidence: 1,
      data: { description: "Compra", amount: 300 },
    },
  )

  assert.equal(command.data?.installmentRequested, true)
  assert.equal(command.data?.installmentCount, 4)
})
