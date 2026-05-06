"use client"
import React, { ChangeEvent, useEffect, useState } from 'react'
import { TransactionHeader, TransactionItem } from "@/app/dashboard/components/transactions"
import { DonutChart, GraphicListItem, separateAmountByCategory } from "@/app/dashboard/components/graphic"
import Period from '../../dashboard/components/period'
import { CardTransaction } from '@/lib/entities/cardTransaction'
import { IoIosArrowRoundDown, IoIosArrowRoundUp } from 'react-icons/io'
import { FaChevronRight, FaChevronLeft } from "react-icons/fa";
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogFooter, Dialog, DialogTrigger, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectLabel, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { FiMinusCircle } from 'react-icons/fi'
import { CardTransactionDto, createCardTransaction, deleteCardTransaction, getCardTransaction } from '@/lib/services/cardTransactions'
import Image from 'next/image'
import mercadoImg from "../../imgs/mercado_pago_card.png"
import picpayImg from "../../imgs/pic_pay_card.png"
import nubankImg from "../../imgs/nubank_card.png"
import { auth } from '@/lib/firebase'
import { useAuthState } from 'react-firebase-hooks/auth'
import { Skeleton } from '@/components/ui/skeleton'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { TransactionsLoadings } from '@/app/dashboard/loadings/TrasactionsLoadings'
import { formatCurrency } from '@/lib/utils'

export const Main = () => {
    const cards = ['MercadoPago', 'PicPay', 'Nubank']
    const [cardIndex, setCardIndex] = useState(0)
    const [text, setText] = useState('')
    const [category, setCategory] = useState('')
    const [card, setCard] = useState('')
    const [price, setPrice] = useState(0)
    const [date, setDate] = useState('')
    const [user, loading] = useAuthState(auth)
    const [items, setItems] = useState<CardTransaction[]>([])
    const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1)
    const [activeFilter, setActiveFilter] = useState("month")

    const sortItemByDate = (currentItems: CardTransaction[]): CardTransaction[] => {
        return [...currentItems].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }

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

    const handlecategoryChange = (value: string): void => {
        setCategory(value)
    }

    const handleDateChange = (event: ChangeEvent<HTMLInputElement>): void => {
        const newValue = event.target.value
        setDate(newValue)
    }

    const handlePriceChange = (event: ChangeEvent<HTMLInputElement>): void => {
        const newValue = +event.target.value
        setPrice(newValue)
    }

    const getCardImage = (cardName: string) => {
        switch (cardName) {
            case 'MercadoPago':
                return mercadoImg;
            case 'PicPay':
                return picpayImg;
            case 'Nubank':
                return nubankImg;
            default:
                return mercadoImg;
        }
    }

    useEffect(() => {
        if (loading || !user || typeof window === 'undefined') return

        let isMounted = true

        const fetchTransactions = async () => {
            try {
                const transactions = await getCardTransaction() || []
                const sortedItems = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                if (isMounted) {
                    setItems(sortedItems)
                }
            } catch (error) {
                console.error("Error fetching transactions:", error);
            }
        }

        void fetchTransactions()

        return () => {
            isMounted = false
        }
    }, [loading, user]);

    const currentCard = cards[cardIndex]
    const currentYear = new Date().getFullYear()
    const currentCardItems = items.filter(transaction => transaction.card === currentCard)
    const filterItems = sortItemByDate(currentCardItems.filter(item => {
        const [year, month] = item.date.split("-").map(Number);

        if (activeFilter === "year") {
            return year === currentYear
        }

        return year === currentYear && month === selectedMonth;
    }))
    const expense = filterItems.reduce((acc, item) => acc + item.amount, 0)

    const handleDeleteItem = async (id: string) => {
        await deleteCardTransaction(id)
        setItems((currentItems) => currentItems.filter(item => item.id !== id))
        resetForm()
    }

    const handleAddNewItem = async (isIncomeDialog: boolean) => {
        const adjustedPrice = isIncomeDialog ? Math.abs(price) : -Math.abs(price)

        const newItem: CardTransactionDto = {
            amount: adjustedPrice,
            date: date,
            card: card,
            description: text,
            category: category,
        }

        try {
            const newTrasaction = await createCardTransaction(newItem)
            setItems((currentItems) => sortItemByDate([newTrasaction, ...currentItems]))
            resetForm()
        } catch (error) {
            console.error("Error adding card transaction:", error)
        }
    }

    const handleMonthChange = (newMonth: number) => {
        setSelectedMonth(newMonth);
        setActiveFilter("month");
    };

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
        const filteredItems = currentCardItems.filter(item => {
            const [year, month] = item.date.split("-").map(Number)
            return year === currentYear && month === selectedMonth
        })

        const lastItems = currentCardItems.filter(item => {
            const [year, month] = item.date.split("-").map(Number)
            return year === currentYear && month === new Date().getMonth()
        })

        const totalExpense = filteredItems.reduce((acc, item) => acc + item.amount, 0)
        const lastExpense = lastItems.reduce((acc, item) => acc + item.amount, 0)

        if (lastExpense === 0) {
            return 0
        }

        const difference = totalExpense - lastExpense
        const totalInDifference = (difference / lastExpense) * 100

        return totalInDifference
    }

    const handleNext = () => {
        setCardIndex((prev) => (prev + 1) % cards.length)
    }

    const handlePrev = () => {
        setCardIndex((prev) => (prev - 1 + cards.length) % cards.length)
    }

    const results = separateAmountByCategory(filterItems)
    const filterButtonClass = 'surface-chip inline-flex items-center px-4 py-2'

    return (
        <div className='mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-6 sm:px-6'>
            <section className='surface-card p-6 sm:p-7'>
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                    <div className='space-y-2'>
                        <span className='inline-flex rounded-full border border-[#22C55E]/20 bg-[#22C55E]/10 px-4 py-2 text-sm font-medium text-[#15803D] dark:text-[#4ADE80]'>
                            Gestão de cartões
                        </span>
                        <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A] dark:text-white">Cartões de crédito</h1>
                        <p className='max-w-2xl text-sm leading-6 text-[#64748B] dark:text-[#94A3BB]'>
                            Acompanhe gastos por cartão e compare os resultados mês a mês em uma visualização mais limpa.
                        </p>
                    </div>
                    <ul className="flex flex-wrap gap-2">
                        <li><button className={filterButtonClass} onClick={lastYearFilter}>Último ano</button></li>
                        <li><button className={filterButtonClass} onClick={lastMonthSelected}>Último mês</button></li>
                        <li><button className={filterButtonClass} onClick={thisMonthSelected}>Este mês</button></li>
                        <Period onMonthChange={handleMonthChange} selectedMonth={selectedMonth} />
                    </ul>
                </div>
            </section>
            <section className='grid gap-6 xl:grid-cols-[1.15fr_0.85fr]'>
                <div className='surface-card p-6'>
                    <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
                        <div className="space-y-2">
                            <p className='text-sm uppercase tracking-[0.28em] text-[#94A3BB]'>Cartão selecionado</p>
                            <h2 className='text-2xl font-semibold text-[#0F172A] dark:text-white'>{currentCard}</h2>
                        </div>
                        <div className="flex items-center justify-center gap-4 rounded-[28px] border border-border/60 bg-white/50 px-4 py-4 backdrop-blur-sm dark:bg-white/5">
                            <button className='flex h-11 w-11 items-center justify-center rounded-full border border-border/60 text-[#334155] transition-all hover:border-[#22C55E]/40 hover:text-[#22C55E] dark:text-[#CBD5E1]' onClick={handlePrev}>
                                <FaChevronLeft />
                            </button>
                            <Image src={getCardImage(currentCard)} alt="cartão" width={140} height={140} className="h-auto w-[110px] -rotate-90 sm:w-[130px]" />
                            <button className='flex h-11 w-11 items-center justify-center rounded-full border border-border/60 text-[#334155] transition-all hover:border-[#22C55E]/40 hover:text-[#22C55E] dark:text-[#CBD5E1]' onClick={handleNext}>
                                <FaChevronRight />
                            </button>
                        </div>
                    </div>
                </div>
                <div className="surface-card flex flex-col justify-between gap-5 p-6">
                    <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-[#94A3BB]">Despesas do cartão</p>
                        {loading ? <div className='mt-3'>
                            <Skeleton className='h-10 w-40' />
                        </div> : (
                            <div>
                                <h2 className="mt-3 text-4xl font-semibold text-rose-500 dark:text-rose-300">{formatCurrency(expense)}</h2>
                            </div>
                        )}
                    </div>
                    <div className="flex w-fit items-center rounded-full border border-border/60 px-3 py-2 text-sm font-semibold text-[#334155] dark:text-[#E2E8F0]">
                        {differenceInPorcentage() < 0 ? (
                            <IoIosArrowRoundUp className="text-[#22C55E] text-lg" />
                        ) : (
                            <IoIosArrowRoundDown className="text-rose-500 text-lg" />
                        )}
                        {differenceInPorcentage().toFixed(2)}%
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
                        <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                                <DialogTitle>Adicionar nova despesa</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <Input type="text" placeholder="Descrição" value={text} onChange={handleTextChange}></Input>
                                <Input type="number" placeholder="Valor" value={price} onChange={handlePriceChange}></Input>
                                <Input type="date" placeholder="Data" value={date} onChange={handleDateChange}></Input>
                                <Select value={category} onValueChange={handlecategoryChange}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Selecione uma categoria" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectLabel>Categorias</SelectLabel>
                                            <SelectItem value="fixes">Fixas</SelectItem>
                                            <SelectItem value="foods">Alimentação</SelectItem>
                                            <SelectItem value="entertainment">Lazer</SelectItem>
                                            <SelectItem value="other">Outros</SelectItem>
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                                <Select value={card} onValueChange={handleCardChange} defaultValue="PicPay">
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Selecione um cartão" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectLabel>Cartões</SelectLabel>
                                            <SelectItem value="PicPay">PicPay</SelectItem>
                                            <SelectItem value="Nubank">Nubank</SelectItem>
                                            <SelectItem value="MercadoPago">MercadoPago</SelectItem>
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogFooter>
                                <Button
                                    onClick={() => handleAddNewItem(false)}
                                    type="button"
                                    disabled={!text || !price || !category || !date || !card}
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
                    <p className='mt-1 text-sm text-[#64748B] dark:text-[#94A3BB]'>Veja em quais categorias este cartão está sendo mais utilizado.</p>
                    <div className='mt-6 flex justify-center'>
                        {loading ? (
                            <AiOutlineLoading3Quarters className='h-24 w-24 animate-spin p-6 text-[#22C55E]' />

                        ) : (<DonutChart results={results} />)}
                    </div>
                    <div className='mt-4'>
                        {loading ?
                            (<Skeleton className='h-28 w-full' />)
                            : (<GraphicListItem results={results} />)}
                    </div>
                </section>
            </section>
            <section className="surface-card-strong overflow-hidden">
                <header className="border-b soft-divider px-5 py-5 sm:px-6">
                    <h4 className="text-xl font-semibold text-[#0F172A] dark:text-white">Últimas transações do cartão</h4>
                    <p className="text-sm text-[#64748B] dark:text-[#94A3BB]">Acompanhe os lançamentos recentes do cartão selecionado.</p>
                </header>
                <main>
                    <TransactionHeader />
                    <div className="max-h-96 overflow-auto">
                        <ul className="divide-y divide-border/40">
                            {filterItems.map((item => (loading ? (
                                <TransactionsLoadings key={item.id} />

                            ) : <TransactionItem key={item.id} item={item} onDelete={handleDeleteItem} />

                            )))}
                        </ul>
                    </div>
                </main>
            </section>
        </div>
    )
}
