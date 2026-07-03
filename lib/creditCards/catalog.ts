export const CREDIT_CARD_CATALOG = {
  nubank: {
    name: 'Nubank',
    image: '/cards/nubank_card.webp',
  },
  inter: {
    name: 'Inter',
    image: '/cards/inter.webp',
  },
  picpay: {
    name: 'PicPay',
    image: '/cards/pic_pay_card.webp',
  },
  bb: {
    name: 'BB',
    image: '/cards/bb.webp',
  },
  c6bank: {
    name: 'C6',
    image: '/cards/c6.webp',
  },
  mercado_pago: {
    name: 'Mercado Pago',
    image: '/cards/mercado_pago_card.webp',
  },
  bradesco: {
    name: 'Bradesco',
    image: '/cards/bradesco.webp',
  },
} as const

export type BankKey = keyof typeof CREDIT_CARD_CATALOG

function normalizeCardText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function isBankKey(value: string): value is BankKey {
  return value in CREDIT_CARD_CATALOG
}

export function getCreditCardBankKey(value?: string | null): BankKey | null {
  if (!value) return null

  if (isBankKey(value)) {
    return value
  }

  const normalizedValue = normalizeCardText(value)

  const match = (Object.keys(CREDIT_CARD_CATALOG) as BankKey[]).find((bankKey) => {
    const bank = CREDIT_CARD_CATALOG[bankKey]
    return normalizeCardText(bankKey) === normalizedValue || normalizeCardText(bank.name) === normalizedValue
  })

  return match ?? null
}

export function getCreditCardName(value: string): string {
  const bankKey = getCreditCardBankKey(value)
  return bankKey ? CREDIT_CARD_CATALOG[bankKey].name : value
}
