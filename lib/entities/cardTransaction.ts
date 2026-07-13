export type CardTransaction = {
    description: string
    category: string
    date: string
    amount: number
    card: string
    id: string
    installmentGroupId?: string
    installmentNumber?: number
    installmentCount?: number
}
