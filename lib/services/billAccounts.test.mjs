import assert from "node:assert/strict"
import { registerHooks } from "node:module"
import test from "node:test"

const DELETE_FIELD = Symbol("deleteField")
const db = {}
const auth = { currentUser: { uid: "user-1" } }

const firestoreState = {
  documents: new Map(),
  deletedPaths: [],
}

function clone(value) {
  return structuredClone(value)
}

function resetDocuments(entries) {
  firestoreState.documents = new Map(
    entries.map(([path, value]) => [path, clone(value)]),
  )
  firestoreState.deletedPaths = []
}

function documentReference(parent, path, id) {
  const fullPath = parent?.kind === "collection"
    ? `${parent.path}/${path}`
    : id === undefined
      ? path
      : `${path}/${id}`

  return {
    kind: "document",
    path: fullPath,
    id: fullPath.split("/").at(-1),
  }
}

function applyUpdate(reference, values) {
  const current = firestoreState.documents.get(reference.path)
  if (!current) throw new Error(`Document not found: ${reference.path}`)

  for (const [fieldPath, value] of Object.entries(values)) {
    const segments = fieldPath.split(".")
    const field = segments.pop()
    let target = current

    for (const segment of segments) {
      target[segment] ??= {}
      target = target[segment]
    }

    if (value === DELETE_FIELD) {
      delete target[field]
    } else {
      target[field] = clone(value)
    }
  }
}

function applySet(reference, values, options) {
  const current = firestoreState.documents.get(reference.path)
  const next = options?.merge && current
    ? { ...current, ...clone(values) }
    : clone(values)
  firestoreState.documents.set(reference.path, next)
}

function commitOperations(operations) {
  for (const operation of operations) {
    if (operation.type === "delete") {
      firestoreState.deletedPaths.push(operation.reference.path)
      firestoreState.documents.delete(operation.reference.path)
    } else if (operation.type === "set") {
      applySet(
        operation.reference,
        operation.values,
        operation.options,
      )
    } else {
      applyUpdate(operation.reference, operation.values)
    }
  }
}

const firestoreApi = {
  collection(_database, path) {
    return { kind: "collection", path }
  },
  doc: documentReference,
  async addDoc() {
    throw new Error("addDoc is not implemented in this test")
  },
  async deleteDoc(reference) {
    firestoreState.deletedPaths.push(reference.path)
    firestoreState.documents.delete(reference.path)
  },
  deleteField() {
    return DELETE_FIELD
  },
  async getDocs(reference) {
    const collectionReference = reference.kind === "query"
      ? reference.collection
      : reference
    const constraints = reference.kind === "query"
      ? reference.constraints
      : []
    const prefix = `${collectionReference.path}/`
    const docs = [...firestoreState.documents.entries()]
      .filter(([path]) => {
        const childPath = path.slice(prefix.length)
        return path.startsWith(prefix) && !childPath.includes("/")
      })
      .filter(([, value]) => constraints.every((constraint) =>
        constraint.operator === "==" && value[constraint.field] === constraint.value
      ))
      .map(([path, value]) => ({
        id: path.split("/").at(-1),
        data: () => clone(value),
      }))

    return {
      docs,
      empty: docs.length === 0,
    }
  },
  async updateDoc(reference, values) {
    applyUpdate(reference, values)
  },
  async getDoc(reference) {
    const value = firestoreState.documents.get(reference.path)
    return {
      id: reference.id,
      exists: () => value !== undefined,
      data: () => clone(value),
    }
  },
  query(reference, ...constraints) {
    return {
      kind: "query",
      collection: reference,
      constraints,
    }
  },
  where(field, operator, value) {
    return { field, operator, value }
  },
  async setDoc(reference, values, options) {
    applySet(reference, values, options)
  },
  writeBatch() {
    const operations = []

    return {
      delete(reference) {
        operations.push({ type: "delete", reference })
      },
      set(reference, values, options) {
        operations.push({ type: "set", reference, values, options })
      },
      update(reference, values) {
        operations.push({ type: "update", reference, values })
      },
      async commit() {
        commitOperations(operations)
      },
    }
  },
  async runTransaction(_database, callback) {
    const operations = []
    const transaction = {
      get: (reference) => firestoreApi.getDoc(reference),
      delete(reference) {
        operations.push({ type: "delete", reference })
      },
      set(reference, values, options) {
        operations.push({ type: "set", reference, values, options })
      },
      update(reference, values) {
        operations.push({ type: "update", reference, values })
      },
    }
    const result = await callback(transaction)
    commitOperations(operations)
    return result
  },
}

globalThis.__billAccountsAuth = auth
globalThis.__billAccountsDb = db
globalThis.__billAccountsFirestoreApi = firestoreApi

function dataModule(source) {
  return `data:text/javascript,${encodeURIComponent(source)}`
}

const authStub = dataModule(`
  export function getAuth() {
    return globalThis.__billAccountsAuth;
  }
`)
const firebaseStub = dataModule(`
  export const db = globalThis.__billAccountsDb;
`)
const firestoreStub = dataModule(`
  const api = globalThis.__billAccountsFirestoreApi;
  export const collection = (...args) => api.collection(...args);
  export const doc = (...args) => api.doc(...args);
  export const addDoc = (...args) => api.addDoc(...args);
  export const deleteDoc = (...args) => api.deleteDoc(...args);
  export const deleteField = (...args) => api.deleteField(...args);
  export const getDocs = (...args) => api.getDocs(...args);
  export const updateDoc = (...args) => api.updateDoc(...args);
  export const writeBatch = (...args) => api.writeBatch(...args);
  export const getDoc = (...args) => api.getDoc(...args);
  export const query = (...args) => api.query(...args);
  export const where = (...args) => api.where(...args);
  export const setDoc = (...args) => api.setDoc(...args);
  export const runTransaction = (...args) => api.runTransaction(...args);
`)
const typeStub = dataModule(`
  export const BillAccount = undefined;
  export const BillAccountRecurrence = undefined;
  export const BillAccountSource = undefined;
  export const TransactionDto = undefined;
  export const Transaction = undefined;
  export const UserCreditCard = undefined;
`)
const billingStub = dataModule(`
  export function isValidBillingDay(day) {
    return Number.isInteger(day) && day >= 1 && day <= 31;
  }
  export function getInvoicePeriodKeyForDueDate(dueDate) {
    return dueDate.slice(0, 7);
  }
`)

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "firebase/auth") {
      return { url: authStub, shortCircuit: true }
    }
    if (specifier === "firebase/firestore") {
      return { url: firestoreStub, shortCircuit: true }
    }
    if (specifier === "../firebase") {
      return { url: firebaseStub, shortCircuit: true }
    }
    if (
      specifier === "../entities/billAccount"
      || specifier === "./transactions"
      || specifier === "../entities/transaction"
      || specifier === "../entities/userCreditCard"
    ) {
      return { url: typeStub, shortCircuit: true }
    }
    if (specifier === "../creditCards/billing") {
      return { url: billingStub, shortCircuit: true }
    }
    return nextResolve(specifier, context)
  },
})

const {
  getLegacyBillPaymentCandidates,
  unpayBillAccount,
} = await import("./billAccounts.ts")

const billPath = (id) => `users/user-1/billAccounts/${id}`
const transactionPath = (id) => `users/user-1/transactions/${id}`
const cardPath = (id) => `users/user-1/creditCards/${id}`

test("unpay removes the exact linked transaction and resets the bill", async () => {
  resetDocuments([
    [billPath("electricity"), {
      description: "Electricity",
      amount: 180,
      dueDate: "2026-07-15",
      status: "paid",
      recurrence: "monthly",
      paymentTransactionId: "payment-electricity",
      paidAt: "2026-07-10",
      createdAt: "2026-01-01",
    }],
    [transactionPath("payment-electricity"), {
      description: "Electricity",
      amount: -180,
    }],
    [transactionPath("unrelated"), {
      description: "Electricity",
      amount: -180,
    }],
  ])

  const result = await unpayBillAccount("electricity")
  const storedBill = firestoreState.documents.get(billPath("electricity"))

  assert.equal(
    firestoreState.documents.has(transactionPath("payment-electricity")),
    false,
  )
  assert.equal(
    firestoreState.documents.has(transactionPath("unrelated")),
    true,
  )
  assert.deepEqual(firestoreState.deletedPaths, [
    transactionPath("payment-electricity"),
  ])
  assert.equal(storedBill.status, "pending")
  assert.equal(Object.hasOwn(storedBill, "paymentTransactionId"), false)
  assert.equal(Object.hasOwn(storedBill, "paidAt"), false)
  assert.deepEqual(result.removedTransactionIds, ["payment-electricity"])
  assert.equal(result.bill.status, "pending")
  assert.equal(result.bill.paymentTransactionId, undefined)
  assert.equal(result.bill.paidAt, undefined)
})

test("unpay of a mark-only bill deletes no transaction", async () => {
  resetDocuments([
    [billPath("rent"), {
      description: "Rent",
      amount: 1200,
      dueDate: "2026-07-08",
      status: "paid",
      recurrence: "monthly",
      paidAt: "2026-07-08",
      createdAt: "2026-01-01",
    }],
    [transactionPath("unrelated"), {
      description: "Rent",
      amount: -1200,
    }],
  ])

  const result = await unpayBillAccount("rent")
  const storedBill = firestoreState.documents.get(billPath("rent"))

  assert.deepEqual(firestoreState.deletedPaths, [])
  assert.equal(
    firestoreState.documents.has(transactionPath("unrelated")),
    true,
  )
  assert.equal(storedBill.status, "pending")
  assert.equal(Object.hasOwn(storedBill, "paymentTransactionId"), false)
  assert.equal(Object.hasOwn(storedBill, "paidAt"), false)
  assert.deepEqual(result.removedTransactionIds, [])
})

test("legacy ordinary payment is strictly ranked, revalidated, and deletes only the confirmed candidate", async () => {
  const legacyBill = {
    id: "legacy-water",
    description: "Water bill",
    amount: 99.99,
    dueDate: "2026-07-15",
    status: "paid",
    recurrence: "monthly",
    createdAt: "2026-07-01",
  }
  const makeTransaction = (id, overrides = {}) => ({
    id,
    description: "Water bill",
    amount: -99.99,
    date: "2026-07-15",
    type: "expense",
    category: "contas",
    paymentMethod: "pix",
    ...overrides,
  })
  const confirmed = makeTransaction("legacy-confirmed")
  const identicalUnrelated = makeTransaction("legacy-identical")
  const rankedTransactions = [
    confirmed,
    identicalUnrelated,
    makeTransaction("one-day-after", {
      date: "2026-07-16",
      category: "fixes",
    }),
    makeTransaction("one-day-before", { date: "2026-07-14" }),
    makeTransaction("wrong-description", { description: "water bill" }),
    makeTransaction("wrong-cent", { amount: -99.98 }),
    makeTransaction("wrong-type", { type: "income" }),
    makeTransaction("wrong-method", { paymentMethod: "debit" }),
    makeTransaction("wrong-category", { category: "other" }),
    makeTransaction("belongs-to-another-bill", {
      billAccountId: "another-bill",
    }),
    makeTransaction("predates-bill", { date: "2026-06-30" }),
  ]

  assert.deepEqual(
    getLegacyBillPaymentCandidates(legacyBill, rankedTransactions)
      .map(({ id }) => id),
    [
      "legacy-confirmed",
      "legacy-identical",
      "one-day-after",
      "one-day-before",
    ],
  )

  const withoutId = (entry) => {
    const data = { ...entry }
    delete data.id
    return data
  }
  const fixture = () => [
    [billPath(legacyBill.id), withoutId(legacyBill)],
    [billPath("another-bill"), {
      description: "Another bill",
      amount: 50,
      dueDate: "2026-07-20",
      status: "paid",
      recurrence: "unique",
      paymentTransactionId: "another-payment",
      createdAt: "2026-07-01",
    }],
    [transactionPath(confirmed.id), withoutId(confirmed)],
    [transactionPath(identicalUnrelated.id), withoutId(identicalUnrelated)],
  ]

  resetDocuments(fixture())
  firestoreState.documents.get(transactionPath(confirmed.id)).amount = -99.98

  await assert.rejects(
    unpayBillAccount(legacyBill.id, confirmed.id),
    /Legacy bill payment transaction is no longer valid/,
  )
  assert.deepEqual(firestoreState.deletedPaths, [])
  assert.equal(
    firestoreState.documents.get(billPath(legacyBill.id)).status,
    "paid",
  )
  assert.equal(
    firestoreState.documents.has(transactionPath(confirmed.id)),
    true,
  )

  resetDocuments(fixture())

  const result = await unpayBillAccount(legacyBill.id, confirmed.id)
  const storedBill = firestoreState.documents.get(billPath(legacyBill.id))

  assert.equal(
    firestoreState.documents.has(transactionPath(confirmed.id)),
    false,
  )
  assert.equal(
    firestoreState.documents.has(transactionPath(identicalUnrelated.id)),
    true,
  )
  assert.deepEqual(firestoreState.deletedPaths, [
    transactionPath(confirmed.id),
  ])
  assert.equal(storedBill.status, "pending")
  assert.equal(Object.hasOwn(storedBill, "paymentTransactionId"), false)
  assert.equal(Object.hasOwn(storedBill, "paidAt"), false)
  assert.deepEqual(result.removedTransactionIds, [confirmed.id])
})

test("legacy card invoice uses its transaction id and clears only that period", async () => {
  const period = "2026-07"
  const previousPeriod = "2026-06"
  const previousInvoice = {
    amountPaid: 250,
    paidAt: "2026-06-10",
    transactionId: "payment-previous-invoice",
  }

  resetDocuments([
    [billPath("card-invoice"), {
      description: "Card invoice",
      amount: 640,
      dueDate: "2026-07-10",
      status: "paid",
      recurrence: "unique",
      creditCardId: "card-1",
      creditCardInvoicePeriodKey: period,
      source: "credit_card_invoice",
      paidAt: "2026-07-10",
      createdAt: "2026-07-01",
    }],
    [cardPath("card-1"), {
      bankKey: "nubank",
      closingDay: 3,
      dueDay: 10,
      invoices: {
        [previousPeriod]: previousInvoice,
        [period]: {
          amountPaid: 640,
          paidAt: "2026-07-10",
          transactionId: "payment-card-invoice",
        },
      },
    }],
    [transactionPath("payment-card-invoice"), {
      description: "Card invoice",
      amount: -640,
    }],
    [transactionPath("payment-previous-invoice"), {
      description: "Previous card invoice",
      amount: -250,
    }],
  ])

  const result = await unpayBillAccount("card-invoice")
  const storedBill = firestoreState.documents.get(billPath("card-invoice"))
  const storedCard = firestoreState.documents.get(cardPath("card-1"))

  assert.equal(
    firestoreState.documents.has(transactionPath("payment-card-invoice")),
    false,
  )
  assert.equal(
    firestoreState.documents.has(transactionPath("payment-previous-invoice")),
    true,
  )
  assert.deepEqual(firestoreState.deletedPaths, [
    transactionPath("payment-card-invoice"),
  ])
  assert.deepEqual(storedCard, {
    bankKey: "nubank",
    closingDay: 3,
    dueDay: 10,
    invoices: {
      [previousPeriod]: previousInvoice,
    },
  })
  assert.equal(storedBill.status, "pending")
  assert.equal(Object.hasOwn(storedBill, "paymentTransactionId"), false)
  assert.equal(Object.hasOwn(storedBill, "paidAt"), false)
  assert.deepEqual(result.removedTransactionIds, ["payment-card-invoice"])
})
