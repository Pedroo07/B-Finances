"use client"
import React, { ChangeEvent, useEffect, useState } from 'react'
import { TransactionHeader, TransactionItem } from "@/app/dashboard/components/transactions"
import { DonutChart, GraphicListItem, separateAmountByCategory } from "@/app/dashboard/components/graphic"
import Period from '../../dashboard/components/period'
import { CardTransaction } from '@/lib/entities/cardTransaction'
import { IoIosArrowRoundDown, IoIosArrowRoundUp } from 'react-icons/io'
import { FaChevronRight, FaChevronLeft } from "react-icons/fa"
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogFooter, Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectLabel, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { FiMinusCircle, FiPlusCircle } from 'react-icons/fi'
import { CardTransactionDto, createCardTransaction, deleteCardTransaction, getCardTransaction } from '@/lib/services/cardTransactions'
import { createUserCreditCard, deleteUserCreditCard, getUserCreditCards, payCreditCardInvoice, updateUserCreditCardBilling } from '@/lib/services/userCreditCards'
import Image from 'next/image'
import { auth } from '@/lib/firebase'
import { useAuthState } from 'react-firebase-hooks/auth'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { BANKS, BankKey, isBankKey } from '@/app/CreditCard/banks'
import { UserCreditCard } from '@/lib/entities/userCreditCard'
import { EXPENSE_CATEGORIES } from '@/lib/transactionCategories'
import {
    getInvoiceDateRange,
    getInvoiceDueDate,
    getInvoicePeriodKey,
    getInvoicePeriodKeyForDate,
    isValidBillingDay,
} from '@/lib/creditCards/billing'

const getTodayDate = () => {
    const now = new Date()
    const timezoneAdjustedDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)

    return timezoneAdjustedDate.toISOString().split('T')[0]
}

const formatDisplayDate = (date: string) => {
    return new Date(`${date}T00:00:00`).toLocaleDateString('pt-BR')
}

export const Main = () => {
    const [selectedCardKey, setSelectedCardKey] = useState<BankKey | null>(null)
    const [text, setText] = useState('')
    const [category, setCategory] = useState('')
    const [card, setCard] = useState('')
    const [price, setPrice] = useState(0)
    const [date, setDate] = useState('')
    const [cardToAdd, setCardToAdd] = useState<BankKey | ''>('')
    const [closingDayToAdd, setClosingDayToAdd] = useState(0)
    const [dueDayToAdd, setDueDayToAdd] = useState(0)
    const [isAddCardDialogOpen, setIsAddCardDialogOpen] = useState(false)
    const [isSavingCard, setIsSavingCard] = useState(false)
    const [isBillingDialogOpen, setIsBillingDialogOpen] = useState(false)
    const [isSavingBilling, setIsSavingBilling] = useState(false)
    const [billingClosingDay, setBillingClosingDay] = useState(0)
    const [billingDueDay, setBillingDueDay] = useState(0)
    const [isRemoveCardDialogOpen, setIsRemoveCardDialogOpen] = useState(false)
    const [isRemovingCard, setIsRemovingCard] = useState(false)
    const [isPayInvoiceDialogOpen, setIsPayInvoiceDialogOpen] = useState(false)
    const [isPayingInvoice, setIsPayingInvoice] = useState(false)
    const [invoicePaymentDate, setInvoicePaymentDate] = useState(() => getTodayDate())
    const [user, loading] = useAuthState(auth)
    const [items, setItems] = useState<CardTransaction[]>([])
    const [userCards, setUserCards] = useState<UserCreditCard[]>([])
    const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1)
    const [activeFilter, setActiveFilter] = useState("month")
    const [isDataLoading, setIsDataLoading] = useState(true)

    const sortItemByDate = (currentItems: CardTransaction[]): CardTransaction[] => {
        return [...currentItems].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }

    const visibleItems = user ? items : []
    const visibleUserCards = user ? userCards : []
    const visibleAddedCardKeys = visibleUserCards.reduce<BankKey[]>((currentKeys, currentCard) => {
        if (isBankKey(currentCard.bankKey)) {
            currentKeys.push(currentCard.bankKey)
        }

        return currentKeys
    }, [])

    const cards = (Object.keys(BANKS) as BankKey[])
        .filter((bankKey) => visibleAddedCardKeys.includes(bankKey))
        .map((bankKey) => [bankKey, BANKS[bankKey]] as const)

    const availableCardKeys = (Object.keys(BANKS) as BankKey[])
        .filter((bankKey) => !visibleAddedCardKeys.includes(bankKey))

    const effectiveSelectedCardKey = selectedCardKey && cards.some(([bankKey]) => bankKey === selectedCardKey)
        ? selectedCardKey
        : cards[0]?.[0] ?? null

    const selectedCardIndex = effectiveSelectedCardKey
        ? cards.findIndex(([bankKey]) => bankKey === effectiveSelectedCardKey)
        : -1

    const currentSelection = selectedCardIndex >= 0 ? cards[selectedCardIndex] : cards[0] ?? null
    const currentCard = currentSelection?.[1] ?? null
    const currentUserCard = effectiveSelectedCardKey
        ? visibleUserCards.find(({ bankKey }) => bankKey === effectiveSelectedCardKey) ?? null
        : null
    const hasCurrentCardBilling = Boolean(
        currentUserCard
        && isValidBillingDay(currentUserCard.closingDay)
        && isValidBillingDay(currentUserCard.dueDay)
    )
    const currentCardClosingDay = hasCurrentCardBilling ? currentUserCard!.closingDay! : null
    const currentCardDueDay = hasCurrentCardBilling ? currentUserCard!.dueDay! : null
    const selectedTransactionCard = cards.some(([, currentBank]) => currentBank.name === card)
        ? card
        : currentCard?.name ?? ''
    const hasCards = cards.length > 0
    const isPageLoading = loading || (Boolean(user) && isDataLoading)
    const canSaveNewCard = Boolean(cardToAdd) && isValidBillingDay(closingDayToAdd) && isValidBillingDay(dueDayToAdd)
    const canSaveBilling = Boolean(effectiveSelectedCardKey) && isValidBillingDay(billingClosingDay) && isValidBillingDay(billingDueDay)

    const resetForm = () => {
        setText('')
        setPrice(0)
        setCategory('')
        setDate('')
    }

    const handleTextChange = (event: ChangeEvent<HTMLInputElement>): void => {
        const newValue = event.target.value
        setText(newValue)
    }

    const handleCardChange = (value: string): void => {
        setCard(value)
    }

    const handleCategoryChange = (value: string): void => {
        setCategory(value)
    }

    const handleAddCardChange = (value: string): void => {
        if (isBankKey(value)) {
            setCardToAdd(value)
        }
    }

    const handleClosingDayToAddChange = (event: ChangeEvent<HTMLInputElement>): void => {
        setClosingDayToAdd(Number(event.target.value))
    }

    const handleDueDayToAddChange = (event: ChangeEvent<HTMLInputElement>): void => {
        setDueDayToAdd(Number(event.target.value))
    }

    const handleBillingClosingDayChange = (event: ChangeEvent<HTMLInputElement>): void => {
        setBillingClosingDay(Number(event.target.value))
    }

    const handleBillingDueDayChange = (event: ChangeEvent<HTMLInputElement>): void => {
        setBillingDueDay(Number(event.target.value))
    }

    const handleDateChange = (event: ChangeEvent<HTMLInputElement>): void => {
        const newValue = event.target.value
        setDate(newValue)
    }

    const handleInvoicePaymentDateChange = (event: ChangeEvent<HTMLInputElement>): void => {
        const newValue = event.target.value
        setInvoicePaymentDate(newValue)
    }

    const handlePriceChange = (event: ChangeEvent<HTMLInputElement>): void => {
        const newValue = +event.target.value
        setPrice(newValue)
    }

    useEffect(() => {
        if (loading || typeof window === 'undefined') return

        if (!user) return

        let isMounted = true

        const fetchData = async () => {
            setIsDataLoading(true)

            try {
                const [transactions, userCards] = await Promise.all([
                    getCardTransaction(),
                    getUserCreditCards(),
                ])

                if (!isMounted) return

                const sortedItems = [...(transactions || [])]
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

                const validUserCards = userCards.filter(({ bankKey }) => isBankKey(bankKey))

                setItems(sortedItems)
                setUserCards(validUserCards)
            } catch (error) {
                console.error("Error fetching credit card data:", error)
            } finally {
                if (isMounted) {
                    setIsDataLoading(false)
                }
            }
        }

        void fetchData()

        return () => {
            isMounted = false
        }
    }, [loading, user])

    const currentYear = new Date().getFullYear()
    const currentCardItems = currentCard
        ? visibleItems.filter((transaction) => transaction.card === currentCard.name)
        : []
    const currentInvoicePeriodKey = activeFilter === 'month' && selectedMonth > 0
        ? getInvoicePeriodKey(currentYear, selectedMonth)
        : null
    const currentInvoiceRange = currentInvoicePeriodKey && currentCardClosingDay
        && currentCardDueDay
        ? getInvoiceDateRange(currentInvoicePeriodKey, currentCardClosingDay, currentCardDueDay)
        : null
    const currentInvoiceDueDate = currentInvoicePeriodKey && currentCardClosingDay && currentCardDueDay
        ? getInvoiceDueDate(currentInvoicePeriodKey, currentCardClosingDay, currentCardDueDay)
        : null

    const filterItems = sortItemByDate(currentCardItems.filter(item => {
        if (!currentCardClosingDay) return false
        if (!currentCardDueDay) return false
        const periodKey = getInvoicePeriodKeyForDate(item.date, currentCardClosingDay, currentCardDueDay)

        if (activeFilter === "year") {
            const [year] = periodKey.split("-").map(Number)
            return year === currentYear
        }

        return periodKey === currentInvoicePeriodKey
    }))

    const expense = filterItems.reduce((acc, item) => acc + item.amount, 0)
    const currentInvoiceAmount = Math.abs(expense)
    const currentInvoicePayment = currentInvoicePeriodKey
        ? currentUserCard?.invoices?.[currentInvoicePeriodKey]
        : undefined
    const invoicePaidAmount = currentInvoicePayment?.amountPaid ?? 0
    const isInvoicePaid = Boolean(currentInvoicePeriodKey) && hasCurrentCardBilling && currentInvoiceAmount > 0 && invoicePaidAmount >= currentInvoiceAmount
    const canPayInvoice = Boolean(currentCard) && hasCurrentCardBilling && Boolean(currentInvoicePeriodKey) && currentInvoiceAmount > 0 && !isInvoicePaid
    const invoiceStatusLabel = !hasCurrentCardBilling
        ? 'Configure a fatura'
        : !currentInvoicePeriodKey
        ? 'Selecione um mes'
        : isInvoicePaid
            ? 'Fatura paga'
            : 'Fatura em aberto'
    const invoiceStatusClass = !hasCurrentCardBilling
        ? 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300'
        : !currentInvoicePeriodKey
        ? 'border-border/60 bg-[#F8FAFC] text-[#334155] dark:bg-white/5 dark:text-[#CBD5E1]'
        : isInvoicePaid
            ? 'border-[#22C55E]/20 bg-[#22C55E]/10 text-[#15803D] dark:text-[#4ADE80]'
            : 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300'

    const handleDeleteItem = async (id: string) => {
        await deleteCardTransaction(id)
        setItems((currentItems) => currentItems.filter(item => item.id !== id))
        resetForm()
    }

    const handleAddNewItem = async (isIncomeDialog: boolean) => {
        if (!selectedTransactionCard) return

        const adjustedPrice = isIncomeDialog ? Math.abs(price) : -Math.abs(price)

        const newItem: CardTransactionDto = {
            amount: adjustedPrice,
            date: date,
            card: selectedTransactionCard,
            description: text,
            category: category,
        }

        try {
            const newTransaction = await createCardTransaction(newItem)
            setItems((currentItems) => sortItemByDate([newTransaction, ...currentItems]))
            resetForm()
        } catch (error) {
            console.error("Error adding card transaction:", error)
        }
    }

    const handleAddNewCard = async () => {
        if (!cardToAdd || !canSaveNewCard || isSavingCard) return

        try {
            setIsSavingCard(true)
            const newCard = await createUserCreditCard(cardToAdd, {
                closingDay: closingDayToAdd,
                dueDay: dueDayToAdd,
            })
            setUserCards((currentCards) => currentCards.some((currentCard) => currentCard.bankKey === cardToAdd)
                ? currentCards
                : [...currentCards, newCard]
            )
            setSelectedCardKey(cardToAdd)
            setCard(BANKS[cardToAdd].name)
            setCardToAdd('')
            setClosingDayToAdd(0)
            setDueDayToAdd(0)
            setIsAddCardDialogOpen(false)
        } catch (error) {
            console.error("Error adding credit card:", error)
        } finally {
            setIsSavingCard(false)
        }
    }

    const handleOpenBillingDialog = () => {
        setBillingClosingDay(currentCardClosingDay ?? 0)
        setBillingDueDay(currentCardDueDay ?? 0)
        setIsBillingDialogOpen(true)
    }

    const handleSaveCurrentCardBilling = async () => {
        if (!effectiveSelectedCardKey || !canSaveBilling || isSavingBilling) return

        try {
            setIsSavingBilling(true)
            const updatedCard = await updateUserCreditCardBilling(effectiveSelectedCardKey, {
                closingDay: billingClosingDay,
                dueDay: billingDueDay,
            })

            setUserCards((currentCards) => currentCards.map((currentCard) => {
                if (currentCard.bankKey !== updatedCard.bankKey) {
                    return currentCard
                }

                return {
                    ...currentCard,
                    closingDay: updatedCard.closingDay,
                    dueDay: updatedCard.dueDay,
                }
            }))
            setIsBillingDialogOpen(false)
        } catch (error) {
            console.error("Error updating credit card billing:", error)
        } finally {
            setIsSavingBilling(false)
        }
    }

    const handleRemoveCurrentCard = async () => {
        if (!currentSelection || isRemovingCard) return

        const [bankKey] = currentSelection

        try {
            setIsRemovingCard(true)
            await deleteUserCreditCard(bankKey)
            setUserCards((currentCards) => currentCards.filter((currentCard) => currentCard.bankKey !== bankKey))
            setIsRemoveCardDialogOpen(false)

            if (selectedCardKey === bankKey) {
                setSelectedCardKey(null)
            }
        } catch (error) {
            console.error("Error removing credit card:", error)
        } finally {
            setIsRemovingCard(false)
        }
    }

    const handleOpenPayInvoiceDialog = () => {
        setInvoicePaymentDate(getTodayDate())
        setIsPayInvoiceDialogOpen(true)
    }

    const handlePayCurrentInvoice = async () => {
        if (!effectiveSelectedCardKey || !hasCurrentCardBilling || !currentInvoicePeriodKey || !invoicePaymentDate || currentInvoiceAmount <= 0 || isPayingInvoice) {
            return
        }

        try {
            setIsPayingInvoice(true)

            const { card: updatedCard } = await payCreditCardInvoice({
                bankKey: effectiveSelectedCardKey,
                periodKey: currentInvoicePeriodKey,
                amountPaid: currentInvoiceAmount,
                paidAt: invoicePaymentDate,
            })

            setUserCards((currentCards) => currentCards.map((currentCard) => {
                if (currentCard.bankKey !== updatedCard.bankKey) {
                    return currentCard
                }

                return {
                    ...currentCard,
                    invoices: {
                        ...currentCard.invoices,
                        ...updatedCard.invoices,
                    },
                }
            }))

            setIsPayInvoiceDialogOpen(false)
        } catch (error) {
            console.error("Error paying credit card invoice:", error)
        } finally {
            setIsPayingInvoice(false)
        }
    }

    const handleMonthChange = (newMonth: number) => {
        setSelectedMonth(newMonth)
        setActiveFilter("month")
    }

    const thisMonthSelected = () => {
        const thisMonth = new Date().getMonth() + 1
        setSelectedMonth(thisMonth)
        setActiveFilter("month")
    }

    const lastMonthSelected = () => {
        setActiveFilter("month")
        const lastMonth = new Date().getMonth()
        setSelectedMonth(lastMonth)
    }

    const lastYearFilter = () => {
        setActiveFilter("year")
        setSelectedMonth(0)
    }

    const differenceInPorcentage = () => {
        if (!currentCardClosingDay || !currentCardDueDay || !currentInvoicePeriodKey) {
            return 0
        }

        const [selectedYear, selectedInvoiceMonth] = currentInvoicePeriodKey.split("-").map(Number)
        const previousInvoiceYear = selectedInvoiceMonth === 1 ? selectedYear - 1 : selectedYear
        const previousInvoiceMonth = selectedInvoiceMonth === 1 ? 12 : selectedInvoiceMonth - 1
        const previousInvoicePeriodKey = getInvoicePeriodKey(previousInvoiceYear, previousInvoiceMonth)

        const filteredItems = currentCardItems.filter(item =>
            getInvoicePeriodKeyForDate(item.date, currentCardClosingDay, currentCardDueDay) === currentInvoicePeriodKey
        )

        const lastItems = currentCardItems.filter(item =>
            getInvoicePeriodKeyForDate(item.date, currentCardClosingDay, currentCardDueDay) === previousInvoicePeriodKey
        )

        const totalExpense = Math.abs(filteredItems.reduce((acc, item) => acc + item.amount, 0))
        const lastExpense = Math.abs(lastItems.reduce((acc, item) => acc + item.amount, 0))

        if (lastExpense === 0) {
            return 0
        }

        const difference = totalExpense - lastExpense
        const totalInDifference = (difference / lastExpense) * 100

        return totalInDifference
    }

    const handleNext = () => {
        if (cards.length < 2 || selectedCardIndex < 0) return
        const nextIndex = (selectedCardIndex + 1) % cards.length
        setSelectedCardKey(cards[nextIndex][0])
    }

    const handlePrev = () => {
        if (cards.length < 2 || selectedCardIndex < 0) return
        const prevIndex = (selectedCardIndex - 1 + cards.length) % cards.length
        setSelectedCardKey(cards[prevIndex][0])
    }

    const results = separateAmountByCategory(filterItems)
    const filterButtonClass = 'surface-chip inline-flex items-center px-4 py-2'

    return (
        <div className='mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6'>
            <Dialog open={isAddCardDialogOpen} onOpenChange={setIsAddCardDialogOpen}>
                <DialogContent className="sm:max-w-106">
                    <DialogHeader>
                        <DialogTitle>Adicionar cartão</DialogTitle>
                        <DialogDescription>
                            Escolha um dos cartões disponiveis para liberar o acompanhamento dele nesta tela.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {availableCardKeys.length > 0 ? (
                            <>
                            <Select value={cardToAdd} onValueChange={handleAddCardChange}>
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Selecione um cartao" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectGroup>
                                        <SelectLabel>Cartões disponiveis</SelectLabel>
                                        {availableCardKeys.map((bankKey) => (
                                            <SelectItem key={bankKey} value={bankKey}>
                                                {BANKS[bankKey].name}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Input
                                    type="number"
                                    min={1}
                                    max={31}
                                    placeholder="Dia de fechamento"
                                    value={closingDayToAdd || ''}
                                    onChange={handleClosingDayToAddChange}
                                />
                                <Input
                                    type="number"
                                    min={1}
                                    max={31}
                                    placeholder="Dia de vencimento"
                                    value={dueDayToAdd || ''}
                                    onChange={handleDueDayToAddChange}
                                />
                            </div>
                            </>
                        ) : (
                            <p className="text-sm text-[#64748B] dark:text-[#94A3BB]">
                                Todos os cartões ja foram adicionados.
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            onClick={handleAddNewCard}
                            type="button"
                            disabled={!canSaveNewCard || isSavingCard || availableCardKeys.length === 0}
                            className='w-full sm:w-auto'
                        >
                            <span>{isSavingCard ? 'Adicionando...' : 'Adicionar cartao'}</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isRemoveCardDialogOpen} onOpenChange={setIsRemoveCardDialogOpen}>
                <DialogContent className="sm:max-w-106">
                    <DialogHeader>
                        <DialogTitle>Remover cartão?</DialogTitle>
                        <DialogDescription>
                            Tem certeza que deseja remover o cartão {currentCard?.name}?
                            As transações dele nao serão apagadas, mas ele deixará de aparecer aqui ate ser adicionado novamente.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsRemoveCardDialogOpen(false)}
                            className='w-full sm:w-auto'
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            onClick={handleRemoveCurrentCard}
                            disabled={!currentCard || isRemovingCard}
                            className='w-full sm:w-auto'
                        >
                            <span>{isRemovingCard ? 'Removendo...' : 'Remover cartao'}</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isBillingDialogOpen} onOpenChange={setIsBillingDialogOpen}>
                <DialogContent className="sm:max-w-106">
                    <DialogHeader>
                        <DialogTitle>Configurar fatura</DialogTitle>
                        <DialogDescription>
                            Informe os dias usados pelo banco para calcular as proximas faturas deste cartao.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-3 py-4 sm:grid-cols-2">
                        <Input
                            type="number"
                            min={1}
                            max={31}
                            placeholder="Dia de fechamento"
                            value={billingClosingDay || ''}
                            onChange={handleBillingClosingDayChange}
                        />
                        <Input
                            type="number"
                            min={1}
                            max={31}
                            placeholder="Dia de vencimento"
                            value={billingDueDay || ''}
                            onChange={handleBillingDueDayChange}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsBillingDialogOpen(false)}
                            className='w-full sm:w-auto'
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSaveCurrentCardBilling}
                            disabled={!canSaveBilling || isSavingBilling}
                            className='w-full sm:w-auto'
                        >
                            <span>{isSavingBilling ? 'Salvando...' : 'Salvar configuracao'}</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isPayInvoiceDialogOpen} onOpenChange={setIsPayInvoiceDialogOpen}>
                <DialogContent className="sm:max-w-106">
                    <DialogHeader>
                        <DialogTitle>Pagar fatura</DialogTitle>
                        <DialogDescription>
                            Marque sua fatura como paga, e adicione a despesa automaticamente a suas transações.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="rounded-2xl border border-border/60 bg-[#F8FAFC] px-4 py-4 dark:bg-white/5">
                            <p className="text-xs uppercase tracking-[0.22em] text-[#94A3BB]">Valor da fatura</p>
                            <p className="mt-2 text-2xl font-semibold text-[#0F172A] dark:text-white">
                                {formatCurrency(-currentInvoiceAmount)}
                            </p>
                            {currentInvoiceRange && currentInvoiceDueDate ? (
                                <p className="mt-2 text-sm text-[#64748B] dark:text-[#94A3BB]">
                                    {formatDisplayDate(currentInvoiceRange.startDate)} a {formatDisplayDate(currentInvoiceRange.endDate)}. Vence em {formatDisplayDate(currentInvoiceDueDate)}.
                                </p>
                            ) : null}
                        </div>
                        <Input
                            type="date"
                            placeholder="Data do pagamento"
                            value={invoicePaymentDate}
                            onChange={handleInvoicePaymentDateChange}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsPayInvoiceDialogOpen(false)}
                            className='w-full sm:w-auto'
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={handlePayCurrentInvoice}
                            disabled={!invoicePaymentDate || !canPayInvoice || isPayingInvoice}
                            className='w-full sm:w-auto'
                        >
                            <span>{isPayingInvoice ? 'Pagando...' : 'Confirmar pagamento'}</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <section className='surface-card p-6 sm:p-7'>
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                    <div className='space-y-2'>
                        <span className='inline-flex rounded-full border border-[#22C55E]/20 bg-[#22C55E]/10 px-4 py-2 text-sm font-medium text-[#15803D] dark:text-[#4ADE80]'>
                            Gestão de cartões
                        </span>
                        <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A] dark:text-white">Cartões de crédito</h1>
                        <p className='max-w-2xl text-sm leading-6 text-[#64748B] dark:text-[#94A3BB]'>
                            Acompanhe gastos do seu cartão e compare os resultados mês a mês em uma visualização mais limpa.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 xl:items-end">
                        <Button
                            onClick={() => setIsAddCardDialogOpen(true)}
                            disabled={isPageLoading || availableCardKeys.length === 0}
                            className='w-full sm:w-auto'
                        >
                            <FiPlusCircle className='text-base' />
                            <span>Adicionar cartão</span>
                        </Button>
                        {hasCards ? (
                            <ul className="flex gap-2 max-sm:flex-wrap">
                                <li><button className={filterButtonClass} onClick={lastYearFilter}>Ultimo ano</button></li>
                                <li><button className={filterButtonClass} onClick={lastMonthSelected}>Ultimo mes</button></li>
                                <li><button className={filterButtonClass} onClick={thisMonthSelected}>Este mes</button></li>
                                <Period onMonthChange={handleMonthChange} selectedMonth={selectedMonth} />
                            </ul>
                        ) : (
                            <p className='max-w-md text-sm text-[#64748B] dark:text-[#94A3BB]'>
                                Adicione pelo menos um cartão para acompanhar seus gastos nessa pagina.
                            </p>
                        )}
                    </div>
                </div>
            </section>

            {isPageLoading ? (
                <section className='grid gap-6 xl:grid-cols-[1.15fr_0.85fr]'>
                    <div className='surface-card p-6'>
                        <Skeleton className='h-36 w-full' />
                    </div>
                    <div className='surface-card p-6'>
                        <Skeleton className='h-36 w-full' />
                    </div>
                    <div className='surface-card p-6 xl:col-span-2'>
                        <Skeleton className='h-80 w-full' />
                    </div>
                </section>
            ) : !hasCards ? (
                <section className='surface-card flex flex-col items-start gap-4 p-6 sm:p-8'>
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#22C55E]/12 text-[#16A34A] dark:bg-[#22C55E]/18 dark:text-[#4ADE80]">
                        <FiPlusCircle className="text-2xl" />
                    </div>
                    <div className='space-y-2'>
                        <h2 className='text-2xl font-semibold text-[#0F172A] dark:text-white'>Nenhum cartao adicionado</h2>
                        <p className='max-w-2xl text-sm leading-6 text-[#64748B] dark:text-[#94A3BB]'>
                            Antes de aparecer qualquer cartão, você precisa adicionar pelo menos uma opção disponivel.
                            Depois disso, somente os cartões adicionados ficam visiveis por aqui.
                        </p>
                    </div>
                    <Button
                        onClick={() => setIsAddCardDialogOpen(true)}
                        disabled={availableCardKeys.length === 0}
                    >
                        <FiPlusCircle className='text-base' />
                        <span>Adicionar primeiro cartão</span>
                    </Button>
                </section>
            ) : (
                <>
                    <section className='grid gap-6 xl:grid-cols-[1.15fr_0.85fr]'>
                        <div className='surface-card p-6'>
                            <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                                <div className="space-y-2">
                                    <p className='text-sm uppercase tracking-[0.28em] text-[#94A3BB]'>Cartao selecionado</p>
                                    <h2 className='text-2xl font-semibold text-[#0F172A] dark:text-white'>{currentCard?.name}</h2>
                                    <p className='text-sm text-[#64748B] dark:text-[#94A3BB]'>
                                        Remova este cartão da lista se nao quiser mais exibi-lo nesta tela.
                                    </p>
                                    {hasCurrentCardBilling ? (
                                        <p className='text-sm font-medium text-[#334155] dark:text-[#E2E8F0]'>
                                            Fecha dia {currentCardClosingDay} e vence dia {currentCardDueDay}.
                                        </p>
                                    ) : (
                                        <div className='rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300'>
                                            <p>Configure fechamento e vencimento para calcular a fatura deste cartao.</p>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={handleOpenBillingDialog}
                                                className='mt-3 w-fit'
                                            >
                                                <span>Configurar fatura</span>
                                            </Button>
                                        </div>
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsRemoveCardDialogOpen(true)}
                                        className='w-fit text-rose-600 hover:text-rose-600 dark:text-rose-300 dark:hover:text-rose-300'
                                    >
                                        <Trash2 className='h-4 w-4' />
                                        <span>Remover cartão</span>
                                    </Button>
                                </div>
                                <div className="flex items-center justify-center gap-4 rounded-[28px] border border-border/60 bg-white/50 px-4 py-4 backdrop-blur-sm dark:bg-white/5">
                                    <button
                                        className='flex h-11 w-11 items-center justify-center rounded-full border border-border/60 text-[#334155] transition-all hover:border-[#22C55E]/40 hover:text-[#22C55E] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#CBD5E1]'
                                        onClick={handlePrev}
                                        disabled={cards.length < 2}
                                    >
                                        <FaChevronLeft />
                                    </button>
                                    {currentCard && (
                                        <Image src={currentCard.image} alt="cartao" width={140} height={140} className="h-auto w-27 -rotate-90 sm:w-32" />
                                    )}
                                    <button
                                        className='flex h-11 w-11 items-center justify-center rounded-full border border-border/60 text-[#334155] transition-all hover:border-[#22C55E]/40 hover:text-[#22C55E] disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#CBD5E1]'
                                        onClick={handleNext}
                                        disabled={cards.length < 2}
                                    >
                                        <FaChevronRight />
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="surface-card flex flex-col justify-between gap-5 p-6">
                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs uppercase tracking-[0.22em] text-[#94A3BB]">Fatura do periodo</p>
                                    <h2 className="mt-3 text-4xl font-semibold text-rose-500 dark:text-rose-300">
                                        {formatCurrency(currentInvoiceAmount)}
                                    </h2>
                                    {currentInvoiceRange && currentInvoiceDueDate ? (
                                        <p className="mt-2 text-sm text-[#64748B] dark:text-[#94A3BB]">
                                            Compras de {formatDisplayDate(currentInvoiceRange.startDate)} a {formatDisplayDate(currentInvoiceRange.endDate)}. Vence em {formatDisplayDate(currentInvoiceDueDate)}.
                                        </p>
                                    ) : null}
                                </div>
                                <div className="flex flex-wrap items-center gap-3">
                                    <span className={`inline-flex rounded-full border px-3 py-2 text-sm font-semibold ${invoiceStatusClass}`}>
                                        {invoiceStatusLabel}
                                    </span>
                                    <div className="flex w-fit items-center rounded-full border border-border/60 px-3 py-2 text-sm font-semibold text-[#334155] dark:text-[#E2E8F0]">
                                        {differenceInPorcentage() < 0 ? (
                                            <IoIosArrowRoundUp className="text-[#22C55E] text-lg" />
                                        ) : (
                                            <IoIosArrowRoundDown className="text-rose-500 text-lg" />
                                        )}
                                        {differenceInPorcentage().toFixed(2)}%
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <Button
                                    type="button"
                                    onClick={handleOpenPayInvoiceDialog}
                                    disabled={!canPayInvoice || isPageLoading}
                                    className='w-full sm:w-auto'
                                >
                                    <span>Pagar fatura</span>
                                </Button>
                                <p className="text-sm text-[#64748B] dark:text-[#94A3BB]">
                                    {!hasCurrentCardBilling
                                        ? 'Configure fechamento e vencimento para calcular e pagar esta fatura.'
                                        : activeFilter === 'year'
                                            ? 'Selecione um mes para pagar a fatura deste cartao.'
                                            : currentInvoiceAmount === 0
                                                ? 'Nao ha lancamentos neste periodo para gerar uma fatura.'
                                                : currentInvoicePayment
                                                    ? `Ultimo pagamento registrado em ${currentInvoicePayment.paidAt}.`
                                                    : 'Escolha a data do pagamento para registrar a fatura e gerar a despesa automaticamente.'}
                                </p>
                            </div>
                        </div>
                    </section>

                    <section className='grid gap-6 xl:grid-cols-[0.8fr_1.2fr]'>
                        <div className="surface-card flex items-center gap-4 p-5 sm:p-6">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <div className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl bg-rose-500/12 text-rose-500 transition-transform hover:scale-[1.03] dark:bg-rose-500/18 dark:text-rose-300">
                                        <FiMinusCircle className="text-2xl" />
                                    </div>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-106">
                                    <DialogHeader>
                                        <DialogTitle>Adicionar nova despesa</DialogTitle>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <Input type="text" placeholder="Descricao" value={text} onChange={handleTextChange}></Input>
                                        <Input type="number" placeholder="Valor" value={price} onChange={handlePriceChange}></Input>
                                        <Input type="date" placeholder="Data" value={date} onChange={handleDateChange}></Input>
                                        <Select value={category} onValueChange={handleCategoryChange}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Selecione uma categoria" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectLabel>Categorias</SelectLabel>
                                                    {EXPENSE_CATEGORIES.map(({ value, label }) => (
                                                        <SelectItem key={value} value={value}>{label}</SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                        <Select value={selectedTransactionCard} onValueChange={handleCardChange}>
                                            <SelectTrigger className="w-full">
                                                <SelectValue placeholder="Selecione um cartao" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectLabel>Cartões adicionados</SelectLabel>
                                                    {cards.map(([bankKey, bank]) => (
                                                        <SelectItem key={bankKey} value={bank.name}>
                                                            {bank.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                            <DialogFooter>
                                                <Button
                                                    onClick={() => handleAddNewItem(false)}
                                                    type="button"
                                                    disabled={!text || !price || !category || !date || !selectedTransactionCard}
                                                    className='w-full sm:w-auto'
                                                >
                                            <span>Criar lançamento</span>
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            <div className="px-1">
                                <p className="font-semibold text-[#0F172A] dark:text-white">Adicionar despesa</p>
                                <p className="text-sm text-[#64748B] dark:text-[#94A3BB]">Registre uma nova compra no cartão selecionado.</p>
                            </div>
                        </div>
                        <section className="surface-card p-6">
                            <p className="text-lg font-semibold text-[#0F172A] dark:text-white">Despesas por categoria</p>
                            <p className='mt-1 text-sm text-[#64748B] dark:text-[#94A3BB]'>Veja em quais categorias este cartão esta sendo mais utilizado.</p>
                            <div className='mt-6 flex justify-center'>
                                <DonutChart results={results} />
                            </div>
                            <div className='mt-4'>
                                <GraphicListItem results={results} />
                            </div>
                        </section>
                    </section>

                    <section className="surface-card-strong overflow-hidden">
                        <header className="border-b soft-divider px-5 py-5 sm:px-6">
                            <h4 className="text-xl font-semibold text-[#0F172A] dark:text-white">Ultimas transações do cartão</h4>
                            <p className="text-sm text-[#64748B] dark:text-[#94A3BB]">Acompanhe os lançamentos recentes do cartão selecionado.</p>
                        </header>
                        <main>
                            <TransactionHeader />
                            <div className="max-h-96 overflow-auto">
                                {filterItems.length > 0 ? (
                                    <ul className="divide-y divide-border/40">
                                        {filterItems.map((item) => (
                                            <TransactionItem key={item.id} item={item} onDelete={handleDeleteItem} />
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="px-5 py-8 text-sm text-[#64748B] dark:text-[#94A3BB] sm:px-6">
                                        Nenhuma transação encontrada para este cartão no periodo selecionado.
                                    </p>
                                )}
                            </div>
                        </main>
                    </section>
                </>
            )}
        </div>
    )
}
