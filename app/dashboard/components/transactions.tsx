import React from 'react'
import { Trash2 } from 'lucide-react'
import { formatCurrency, translateCategory } from '@/lib/utils'
import { PaymentMethodIconBadge } from './transactionIcons'

export type Item = {
    id: string
    description: string
    date: string
    amount: number
    category: string
    type?: string
    paymentMethod?: string
    card?: string
    installmentNumber?: number
    installmentCount?: number
}

type TransactionItemProps = {
    item: Item
    onDelete: (id: string) => void
    showInstallment?: boolean
}

export const TransactionHeader = () => {
    return (
        <div className="hidden w-full md:block">
            <ul className="grid grid-cols-5 rounded-t-[26px] border-b border-border/60 bg-[#E2E8F0]/65 px-5 py-3 text-sm font-semibold text-[#334155] dark:bg-[#0F172A]/45 dark:text-[#CBD5E1]">
                <li className="col-span-2">Descrição</li>
                <li>Categoria</li>
                <li>Data</li>
                <li>Valor</li>
            </ul>
        </div>
    )
}

export const TransactionItem: React.FC<TransactionItemProps> = ({ item, onDelete, showInstallment = false }) => {
    const paymentMethod = item.paymentMethod ?? (item.card ? 'credit_card' : undefined)

    return (
        <li className="w-full border-b border-border/50 last:border-b-0">
            <div className="flex flex-col gap-4 px-4 py-4 md:grid md:grid-cols-5 md:items-center md:gap-3 md:px-5">
                <div className="flex items-start justify-between gap-3 md:col-span-2 md:justify-start">
                    <div className="flex items-start gap-3">
                        <PaymentMethodIconBadge method={paymentMethod} isIncome={item.amount > 0} />
                        <div>
                            <p className="text-sm font-medium text-[#0F172A] dark:text-[#E2E8F0]">{item.description}</p>
                            {showInstallment && item.installmentNumber && item.installmentCount ? (
                                <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3BB]">
                                    Parcela {item.installmentNumber}/{item.installmentCount}
                                </p>
                            ) : null}
                        </div>
                    </div>
                    <button
                        onClick={() => onDelete(item.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-[#64748B] transition-all hover:border-rose-400/50 hover:text-rose-500 md:hidden dark:text-[#94A3BB]"
                        aria-label="Excluir transação"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm md:contents">
                    <div className="space-y-1 md:space-y-0">
                        <p className="text-xs uppercase tracking-[0.22em] text-[#94A3BB] md:hidden">Categoria</p>
                        <p className="text-[#334155] dark:text-[#CBD5E1]">{translateCategory(item.category)}</p>
                    </div>
                    <div className="space-y-1 md:space-y-0">
                        <p className="text-xs uppercase tracking-[0.22em] text-[#94A3BB] md:hidden">Data</p>
                        <p className="text-[#64748B] dark:text-[#94A3BB]">{item.date}</p>
                    </div>
                    <div className="space-y-1 md:flex md:items-center md:justify-between md:gap-3 md:space-y-0">
                        <p className="text-xs uppercase tracking-[0.22em] text-[#94A3BB] md:hidden">Valor</p>
                        <span className={`font-semibold ${item.amount > 0 ? 'text-[#16A34A] dark:text-[#4ADE80]' : 'text-rose-500 dark:text-rose-300'}`}>
                            {item.amount > 0 ? `+${formatCurrency(item.amount)}` : formatCurrency(item.amount)}
                        </span>
                        <button
                            onClick={() => onDelete(item.id)}
                            className="hidden rounded-full border border-border/60 p-2 text-[#64748B] transition-all hover:border-rose-400/50 hover:text-rose-500 md:flex dark:text-[#94A3BB]"
                            aria-label="Excluir transação"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            </div>
        </li>
    )
}
