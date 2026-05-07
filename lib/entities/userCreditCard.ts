export type CreditCardInvoicePayment = {
    amountPaid: number
    paidAt: string
    transactionId: string
}

export type UserCreditCard = {
    id: string
    bankKey: string
    invoices?: Record<string, CreditCardInvoicePayment>
}
