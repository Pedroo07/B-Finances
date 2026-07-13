import assert from "node:assert/strict"
import test from "node:test"

import { buildInstallmentSchedule } from "./installments.ts"

test("divide valores exatos em centavos", () => {
  const schedule = buildInstallmentSchedule({
    purchaseDate: "2026-07-12",
    totalAmount: 300,
    installmentCount: 10,
  })

  assert.equal(schedule.length, 10)
  assert.deepEqual(schedule.map(({ amount }) => amount), Array(10).fill(30))
  assert.equal(schedule[0].date, "2026-07-12")
  assert.equal(schedule[9].date, "2027-04-12")
  assert.equal(schedule[8].installmentNumber, 9)
})

test("coloca o restante dos centavos na ultima parcela", () => {
  const schedule = buildInstallmentSchedule({
    purchaseDate: "2026-01-10",
    totalAmount: 100,
    installmentCount: 3,
  })

  assert.deepEqual(schedule.map(({ amount }) => amount), [33.33, 33.33, 33.34])
  assert.equal(schedule.reduce((total, item) => total + Math.round(item.amount * 100), 0), 10000)
})

test("preserva o dia original depois de meses mais curtos", () => {
  const schedule = buildInstallmentSchedule({
    purchaseDate: "2026-01-31",
    totalAmount: 120,
    installmentCount: 4,
  })

  assert.deepEqual(schedule.map(({ date }) => date), [
    "2026-01-31",
    "2026-02-28",
    "2026-03-31",
    "2026-04-30",
  ])
})

test("considera fevereiro em ano bissexto", () => {
  const schedule = buildInstallmentSchedule({
    purchaseDate: "2028-01-30",
    totalAmount: 60,
    installmentCount: 2,
  })

  assert.equal(schedule[1].date, "2028-02-29")
})

test("rejeita dados invalidos", () => {
  assert.throws(() => buildInstallmentSchedule({
    purchaseDate: "2026-02-30",
    totalAmount: 100,
    installmentCount: 2,
  }))
  assert.throws(() => buildInstallmentSchedule({
    purchaseDate: "2026-01-01",
    totalAmount: 0,
    installmentCount: 2,
  }))
  assert.throws(() => buildInstallmentSchedule({
    purchaseDate: "2026-01-01",
    totalAmount: 100,
    installmentCount: 13,
  }))
})

