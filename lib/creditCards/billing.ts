export type InvoicePeriodParts = {
  year: number
  month: number
}

export type InvoiceDateRange = {
  startDate: string
  endDate: string
}

const MIN_BILLING_DAY = 1
const MAX_BILLING_DAY = 31

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const PERIOD_PATTERN = /^(\d{4})-(\d{2})$/

export function isValidBillingDay(day: unknown): day is number {
  return typeof day === 'number'
    && Number.isInteger(day)
    && day >= MIN_BILLING_DAY
    && day <= MAX_BILLING_DAY
}

function assertValidBillingDay(day: number, fieldName: string): void {
  if (!isValidBillingDay(day)) {
    throw new Error(`${fieldName} must be an integer between 1 and 31`)
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function parseDateParts(date: string): InvoicePeriodParts & { day: number } {
  const match = DATE_PATTERN.exec(date)
  if (!match) {
    throw new Error(`Invalid date: ${date}`)
  }

  const [, year, month, day] = match
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
  }
}

function parsePeriodKey(periodKey: string): InvoicePeriodParts {
  const match = PERIOD_PATTERN.exec(periodKey)
  if (!match) {
    throw new Error(`Invalid invoice period: ${periodKey}`)
  }

  const [, year, month] = match
  return {
    year: Number(year),
    month: Number(month),
  }
}

function formatDateParts({ year, month, day }: InvoicePeriodParts & { day: number }): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

export function getInvoicePeriodKey(year: number, month: number): string {
  return `${year}-${pad2(month)}`
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function getClampedBillingDay(year: number, month: number, day: number): number {
  assertValidBillingDay(day, 'billingDay')
  return Math.min(day, getDaysInMonth(year, month))
}

function addMonths(year: number, month: number, amount: number): InvoicePeriodParts {
  const date = new Date(Date.UTC(year, month - 1 + amount, 1))
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
  }
}

function addDays(year: number, month: number, day: number, amount: number): InvoicePeriodParts & { day: number } {
  const date = new Date(Date.UTC(year, month - 1, day + amount))
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  }
}

function getPeriodKeyForDueDateParts(year: number, month: number, day: number): string {
  if (day > 15) {
    return getInvoicePeriodKey(year, month)
  }

  const previousMonth = addMonths(year, month, -1)
  return getInvoicePeriodKey(previousMonth.year, previousMonth.month)
}

function getClosingDate(year: number, month: number, closingDay: number): InvoicePeriodParts & { day: number } {
  return {
    year,
    month,
    day: getClampedBillingDay(year, month, closingDay),
  }
}

function getDueDateAfterClosingDate(
  closingDate: InvoicePeriodParts & { day: number },
  dueDay: number,
): InvoicePeriodParts & { day: number } {
  const sameMonthDueDate = {
    year: closingDate.year,
    month: closingDate.month,
    day: getClampedBillingDay(closingDate.year, closingDate.month, dueDay),
  }

  if (formatDateParts(sameMonthDueDate) > formatDateParts(closingDate)) {
    return sameMonthDueDate
  }

  const nextMonth = addMonths(closingDate.year, closingDate.month, 1)
  return {
    year: nextMonth.year,
    month: nextMonth.month,
    day: getClampedBillingDay(nextMonth.year, nextMonth.month, dueDay),
  }
}

function getInvoicePeriodKeyForClosingMonth(
  year: number,
  month: number,
  closingDay: number,
  dueDay: number,
): string {
  const dueDate = getDueDateAfterClosingDate(getClosingDate(year, month, closingDay), dueDay)
  return getPeriodKeyForDueDateParts(dueDate.year, dueDate.month, dueDate.day)
}

export function getInvoicePeriodKeyForDate(date: string, closingDay: number, dueDay: number): string {
  assertValidBillingDay(closingDay, 'closingDay')
  assertValidBillingDay(dueDay, 'dueDay')

  const { year, month, day } = parseDateParts(date)
  const actualClosingDay = getClampedBillingDay(year, month, closingDay)

  if (day < actualClosingDay) {
    return getInvoicePeriodKeyForClosingMonth(year, month, closingDay, dueDay)
  }

  const nextClosingMonth = addMonths(year, month, 1)
  return getInvoicePeriodKeyForClosingMonth(
    nextClosingMonth.year,
    nextClosingMonth.month,
    closingDay,
    dueDay,
  )
}

export function getInvoiceDateRange(periodKey: string, closingDay: number, dueDay: number): InvoiceDateRange {
  assertValidBillingDay(closingDay, 'closingDay')
  assertValidBillingDay(dueDay, 'dueDay')

  const { year, month } = parsePeriodKey(periodKey)
  const closingPeriod = [-1, 0, 1].map((offset) => addMonths(year, month, offset))
    .find((candidate) =>
      getInvoicePeriodKeyForClosingMonth(candidate.year, candidate.month, closingDay, dueDay) === periodKey
    ) ?? { year, month }
  const previousClosingMonth = addMonths(closingPeriod.year, closingPeriod.month, -1)
  const previousClosingDay = getClampedBillingDay(previousClosingMonth.year, previousClosingMonth.month, closingDay)
  const closingDate = getClosingDate(closingPeriod.year, closingPeriod.month, closingDay)
  const end = addDays(closingDate.year, closingDate.month, closingDate.day, -1)

  return {
    startDate: formatDateParts({
      year: previousClosingMonth.year,
      month: previousClosingMonth.month,
      day: previousClosingDay,
    }),
    endDate: formatDateParts(end),
  }
}

export function getInvoiceDueDate(periodKey: string, closingDay: number, dueDay: number): string {
  assertValidBillingDay(closingDay, 'closingDay')
  assertValidBillingDay(dueDay, 'dueDay')

  const { endDate } = getInvoiceDateRange(periodKey, closingDay, dueDay)
  const endDateParts = parseDateParts(endDate)
  const closingDate = addDays(endDateParts.year, endDateParts.month, endDateParts.day, 1)
  return formatDateParts(getDueDateAfterClosingDate(closingDate, dueDay))
}

export function getInvoicePeriodKeyForDueDate(dueDate: string, closingDay: number, dueDay: number): string {
  assertValidBillingDay(closingDay, 'closingDay')
  assertValidBillingDay(dueDay, 'dueDay')

  const { year, month } = parseDateParts(dueDate)

  for (let monthOffset = -3; monthOffset <= 1; monthOffset += 1) {
    const candidate = addMonths(year, month, monthOffset)
    const periodKey = getInvoicePeriodKey(candidate.year, candidate.month)

    if (getInvoiceDueDate(periodKey, closingDay, dueDay) === dueDate) {
      return periodKey
    }
  }

  const { year: dueYear, month: dueMonth, day: dueDateDay } = parseDateParts(dueDate)
  return getPeriodKeyForDueDateParts(dueYear, dueMonth, dueDateDay)
}
