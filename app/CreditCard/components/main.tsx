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

    return (
        <div className='max-w-screen-xl mx-auto w-full px-4 max-md:px-2'>
            <section>
                <div className="flex flex-col lg:flex-row justify-between items-center py-12 gap-1">
                    <h1 className="font-semibold text-3xl w-full text-center lg:text-center sm:text-left">Hello!</h1>
                    <ul className="flex  text-sm font-semibold divide-x w-full justify-center md:justify-start">
                        <li className="border p-2 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-200">
                            <button onClick={lastYearFilter}>Last Year</button>
                        </li>
                        <li className="border p-2 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-200">
                            <button onClick={lastMonthSelected}>Last Month</button>
                        </li>
                        <li className="border p-2 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-200">
                            <button onClick={thisMonthSelected}>This Month</button>
                        </li>
                        <Period onMonthChange={handleMonthChange} selectedMonth={selectedMonth} />
                    </ul>
                </div>
                <section className='flex flex-wrap justify-center items-center'>
                    <div className="flex items-center py-6 space-x-4">
                        <FaChevronLeft className="cursor-pointer" onClick={handlePrev} />
                        <Image src={getCardImage(currentCard)} alt="card" width={120} height={120} className="-rotate-90" />
                        <FaChevronRight className="cursor-pointer" onClick={handleNext} />
                    </div>
                    <div className="flex flex-wrap justify-center gap-5 p-6">
                        <div className="bg-white border shadow-md rounded-lg flex p-4 items-center dark:bg-slate-700 w-full md:w-auto">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <div className="bg-red-200 rounded-md p-3 text-red-700 cursor-pointer">
                                        <FiMinusCircle className="text-xl hover:scale-125 " />
                                    </div>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[425px]">
                                    <DialogHeader>
                                        <DialogTitle>Add new Expense</DialogTitle>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <Input type="text" placeholder="Description" value={text} onChange={handleTextChange}></Input>
                                        <Input type="number" placeholder="Amount" value={price} onChange={handlePriceChange}></Input>
                                        <Input type="date" placeholder="Date" value={date} onChange={handleDateChange}></Input>
                                        <Select value={category} onValueChange={handlecategoryChange}>
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Select a category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectLabel>categorys</SelectLabel>
                                                    <SelectItem value="fixes">Fixes</SelectItem>
                                                    <SelectItem value="foods">Foods</SelectItem>
                                                    <SelectItem value="entertainment">Entertainment</SelectItem>
                                                    <SelectItem value="other">Others</SelectItem>
                                                </SelectGroup>
                                            </SelectContent>
                                        </Select>
                                        <Select value={card} onValueChange={handleCardChange} defaultValue="PicPay">
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Select a is card" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectGroup>
                                                    <SelectLabel>Cards</SelectLabel>
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
                                        >
                                            <span>Create new</span>
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            <div className="px-2">
                                <p className="font-semibold">Add expense</p>
                                <p className="text-sm text-slate-500">Create an expense manually</p>
                            </div>
                        </div>
                        <div className="bg-white flex flex-wrap justify-between p-4 gap-4 rounded-lg border items-end shadow-md dark:bg-slate-700 w-full md:w-auto">
                            <div className="">
                                {loading ? <div>
                                    <p className='text-xs text-slate-400 dark:text-slate-200'>Balance</p>
                                    <Skeleton className='w-40 h-6' />
                                </div> : (
                                    <div>
                                        <p className="text-xs text-slate-400 dark:text-slate-200">Expenses</p>
                                        <h2 className="text-4xl font-semibold text-red-600">${expense.toFixed(2)}</h2>
                                    </div>
                                )}
                            </div>
                            <div className="border flex items-center text-center rounded-sm max-h-3 p-2.5 font-semibold tracking-wider shadow-md">
                                <p className="text-sm flex items-center">
                                    {differenceInPorcentage() < 0 ? (
                                        <IoIosArrowRoundUp className="text-green-500 text-lg" />
                                    ) : (
                                        <IoIosArrowRoundDown className="text-red-500 text-lg" />
                                    )}
                                    {differenceInPorcentage().toFixed(2)}%
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </section>
            <div className="flex flex-wrap justify-center gap-16 items-stretch max-md:flex-col-reverse max-md:items-center max-md:p-6">
                <section className="border rounded-lg bg-white p-4 m-4 dark:bg-slate-700 w-full md:w-auto">
                    <p className="font-semibold">Expenses by category</p>
                    <div className='max-md:max-w-[330px]'>
                        {loading ? (
                            <AiOutlineLoading3Quarters className='animate-spin m-auto h-28 w-28 p-8' />

                        ) : (<DonutChart results={results} />)}
                    </div>
                    <div>
                        {loading ?
                            (<Skeleton className='h-3' />)
                            : (<GraphicListItem results={results} />)}
                    </div>
                </section>
                <section className="bg-white dark:bg-slate-700">
                    <header className="p-4 border rounded-t-lg">
                        <h4 className="font-semibold text-lg">Last transactions</h4>
                        <p className="text-sm font-semibold text-slate-400">Check your last transactions</p>
                    </header>
                    <main>
                        <TransactionHeader />
                        <div className="border rounded-b-lg max-h-96 overflow-auto">
                            <ul className="divide-y">
                                {filterItems.map((item => (loading ? (
                                    <TransactionsLoadings key={item.id} />

                                ) : <TransactionItem key={item.id} item={item} onDelete={handleDeleteItem} />

                                )))}
                            </ul>
                        </div>
                    </main>
                </section>
            </div>
        </div>
    )
}
