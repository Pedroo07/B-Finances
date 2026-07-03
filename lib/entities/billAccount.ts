export type BillAccountRecurrence = 'unique' | 'monthly' | 'installments'

export type BillAccount = {
  id: string
  description: string
  amount: number
  dueDate: string
  status: 'pending' | 'paid'
  recurrence: BillAccountRecurrence
  installments?: number
  currentInstallment?: number
  creditCardId?: string
  creditCardInvoicePeriodKey?: string
  createdAt: string
}
