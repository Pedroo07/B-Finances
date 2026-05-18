export type Investment = {
  id: string
  category: string
  balance: number
  liquidez: 'imediata' | 'longo_prazo'
  created_at: string
  rendimentos: InvestmentYield[]
  total_yield: number
  rescued_amount?: number
}

export type InvestmentYield = {
  id: string
  value: number
  date: string
}

