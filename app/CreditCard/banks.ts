export const BANKS = {
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
    image: '/cards/bb.webp'
  },
  c6bank: {
    name: 'C6',
    image: '/cards/c6.webp'
  },
  mercado_pago: {
    name: 'Mercado Pago',
    image: '/cards/mercado_pago_card.webp'
  },
  bradesco: {
    name: 'Bradesco',
    image: '/cards/bradesco.webp'
  }
}

export type BankKey = keyof typeof BANKS

export const isBankKey = (value: string): value is BankKey => value in BANKS
