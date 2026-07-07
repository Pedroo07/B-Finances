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
  caixa: {
    name: 'Caixa',
    image: '/cards/caixa.png',
  },
  santander: {
    name: 'Santander',
    image: '/cards/santander.png',
  },
  itau: {
    name: 'Itau',
    image: '/cards/itau.png',
  },
  pagbank: {
    name: 'PagBank',
    image: '/cards/pagbank.png',
  },
} as const

export type BankKey = keyof typeof CREDIT_CARD_CATALOG
export type CreditCardName = (typeof CREDIT_CARD_CATALOG)[BankKey]['name']

export const CREDIT_CARD_BANK_KEYS = Object.keys(CREDIT_CARD_CATALOG) as BankKey[]
export const CREDIT_CARD_NAMES: CreditCardName[] = CREDIT_CARD_BANK_KEYS.map((bankKey) => CREDIT_CARD_CATALOG[bankKey].name)
export const CREDIT_CARD_NAMES_TEXT = CREDIT_CARD_NAMES.join(', ')

const CREDIT_CARD_TEXT_ALIASES: Partial<Record<BankKey, string[]>> = {
  picpay: ['Pic Pay'],
  c6bank: ['C6 Bank'],
  mercado_pago: ['Mercado Pago'],
  pagbank: ['Pag Bank'],
}

function normalizeCardText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function normalizeCardPhrase(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function textContainsCardPhrase(normalizedText: string, phrase: string): boolean {
  const normalizedPhrase = normalizeCardPhrase(phrase)
  if (!normalizedPhrase) return false

  const phrasePattern = escapeRegExp(normalizedPhrase).replace(/\s+/g, '\\s+')
  return new RegExp(`(^|\\s)${phrasePattern}(?=\\s|$)`).test(normalizedText)
}

function getCardTextAliases(bankKey: BankKey): string[] {
  const bank = CREDIT_CARD_CATALOG[bankKey]

  return [
    bank.name,
    bankKey,
    bankKey.replace(/_/g, ' '),
    ...(CREDIT_CARD_TEXT_ALIASES[bankKey] ?? []),
  ]
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

export function findCreditCardBankKeyInText(value?: string | null): BankKey | null {
  if (!value) return null

  const normalizedText = normalizeCardPhrase(value)
  if (!normalizedText) return null

  if (/\bcartao\s+mercado\b/.test(normalizedText)) {
    return 'mercado_pago'
  }

  const match = CREDIT_CARD_BANK_KEYS.find((bankKey) => {
    return getCardTextAliases(bankKey).some((alias) => textContainsCardPhrase(normalizedText, alias))
  })

  return match ?? null
}

export function findCreditCardNameInText(value?: string | null): CreditCardName | null {
  const bankKey = findCreditCardBankKeyInText(value)
  return bankKey ? CREDIT_CARD_CATALOG[bankKey].name : null
}

export function getCreditCardName(value: string): string {
  const bankKey = getCreditCardBankKey(value)
  return bankKey ? CREDIT_CARD_CATALOG[bankKey].name : value
}
