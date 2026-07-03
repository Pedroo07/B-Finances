export type CreditCardInvoicePayment = {
    amountPaid: number
    paidAt: string
    transactionId: string
}

export type UserCreditCard = {
    id: string
    bankKey: string
    closingDay?: number
    dueDay?: number
    invoices?: Record<string, CreditCardInvoicePayment>
}
