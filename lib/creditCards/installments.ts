export const MAX_CARD_INSTALLMENTS = 12

export type InstallmentScheduleInput = {
  purchaseDate: string
  totalAmount: number
  installmentCount: number
}

export type InstallmentScheduleItem = {
  date: string
  amount: number
  installmentNumber: number
  installmentCount: number
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function parsePurchaseDate(value: string): { year: number; month: number; day: number } {
  const match = DATE_PATTERN.exec(value)
  if (!match) throw new Error('A data da compra deve estar no formato AAAA-MM-DD')

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))

  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() + 1 !== month
    || parsed.getUTCDate() !== day
  ) {
    throw new Error('A data da compra é inválida')
  }

  return { year, month, day }
}

function getInstallmentDate(
  purchaseDate: { year: number; month: number; day: number },
  monthOffset: number,
): string {
  const targetMonth = new Date(Date.UTC(purchaseDate.year, purchaseDate.month - 1 + monthOffset, 1))
  const year = targetMonth.getUTCFullYear()
  const month = targetMonth.getUTCMonth() + 1
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const day = Math.min(purchaseDate.day, daysInMonth)

  return `${year}-${pad2(month)}-${pad2(day)}`
}

export function buildInstallmentSchedule({
  purchaseDate,
  totalAmount,
  installmentCount,
}: InstallmentScheduleInput): InstallmentScheduleItem[] {
  if (!Number.isInteger(installmentCount) || installmentCount < 2 || installmentCount > MAX_CARD_INSTALLMENTS) {
    throw new Error(`A quantidade de parcelas deve estar entre 2 e ${MAX_CARD_INSTALLMENTS}`)
  }

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error('O valor total deve ser maior que zero')
  }

  const totalCents = Math.round(totalAmount * 100)
  if (totalCents < installmentCount) {
    throw new Error('O valor total deve permitir parcelas de pelo menos R$ 0,01')
  }

  const originalDate = parsePurchaseDate(purchaseDate)
  const baseInstallmentCents = Math.floor(totalCents / installmentCount)
  const finalInstallmentCents = baseInstallmentCents + (totalCents % installmentCount)

  return Array.from({ length: installmentCount }, (_, index) => ({
    date: getInstallmentDate(originalDate, index),
    amount: (index === installmentCount - 1 ? finalInstallmentCents : baseInstallmentCents) / 100,
    installmentNumber: index + 1,
    installmentCount,
  }))
}
