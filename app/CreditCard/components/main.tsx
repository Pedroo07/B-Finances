"use client"
import React, { ChangeEvent, useEffect, useState } from 'react'
import { TransactionHeader, TransactionItem } from "@/app/components/transactions"
import { DonutChart, GraphicListItem, separateAmountByMethod } from "@/app/components/graphic"
import Period from '../../components/period'
import { CardTransaction } from '@/lib/entities/cardTransaction'
import { IoIosArrowRoundDown, IoIosArrowRoundUp } from 'react-icons/io'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogFooter, Dialog, DialogTrigger, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectGroup, SelectLabel, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { FiMinusCircle } from 'react-icons/fi'
import { CardTransactionDto, createCardTransaction, deleteCardTransaction, getCardTransaction } from '@/lib/services/cardTransactions'


export const Main = () => {
    const [text, setText] = useState('')
    const [method, setMethod] = useState('')
    const [price, setPrice] = useState(0)
    const [date, setDate] = useState('')
    const [items, setItems] = useState<CardTransaction[]>([])
    const [filterItems, setFilterItems] = useState<CardTransaction[]>([])
    const [expense, setExpense] = useState<number>(() => {
        return items.reduce((acc, item) => acc + item.amount, 0)
    })
    const sortItemByDate = (items: CardTransaction[]): CardTransaction[] => {
        return [...items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    }

    const handleFetchTransaction = async () => {
        try {
            const transactions = await getCardTransaction() || "[]"
            setItems(transactions)
        } catch (error) {
            console.error("Error fetching transactions:", error);
        }
    }
    const handleTextChange = (event: ChangeEvent<HTMLInputElement>): void => {
        const newValue = event.target.value
        setText(newValue)
    }
    const handleMethodChange = (value: string): void => {
        setMethod(value)
    }
    const handleDateChange = (event: ChangeEvent<HTMLInputElement>): void => {
        const newValue = event.target.value
        setDate(newValue)
    }
    const handlePriceChange = (event: ChangeEvent<HTMLInputElement>): void => {
        const newValue = +event.target.value
        setPrice(newValue)
    }


    const handleDeleteItem = async (id: string) => {
        await deleteCardTransaction(id)
        const itemArray = items.filter(item => {
            return item.id !== id
        })

        setItems(itemArray)
        const filteredItems = itemArray.filter(item => {
            const [year, month] = item.date.split("-").map(Number)
            return year === new Date().getFullYear() && month === selectedMonth
        })


        const total = filteredItems.reduce((acc, item) => acc + item.amount, 0);

        setExpense(total);
        setItems(filteredItems)
        handleFetchTransaction()
        setText('')
        setPrice(0)
        setMethod('')
        setDate('')
    }

    const handleAddNewItem = (isIncomeDialog: boolean) => {
        const adjustedPrice = isIncomeDialog ? Math.abs(price) : -Math.abs(price)

        const newItem: CardTransactionDto = {
            amount: adjustedPrice,
            date: date,
            description: text,
            method: method,
        }

        createCardTransaction(newItem).then((newTrasaction) => {
            const itemsArray = [newTrasaction, ...items]
            const sortedItems = sortItemByDate(itemsArray)
            setItems(sortedItems)

            const filteredItems = sortedItems.filter(item => {
                const [year, month] = item.date.split("-").map(Number)
                return year === new Date().getFullYear() && month === selectedMonth
            })

            const total = filteredItems.reduce((acc, item) => acc + item.amount, 0);

            handleFetchTransaction()
            setItems(filteredItems)
            setExpense(total)
            setText('')
            setPrice(0)
            setMethod('')
            setDate('')
        })
    }
    const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1)

    const [activeFilter, setActiveFilter] = useState("month")

    useEffect(() => {
        if (activeFilter !== "month") return
        const filteredItems = items.filter(item => {
            const [year, month] = item.date.split("-").map(Number);
            return year === new Date().getFullYear() && month === selectedMonth;
        });

        setFilterItems(filteredItems)
        const total = filteredItems.reduce((acc, item) => acc + item.amount, 0);
        setExpense(total);

    }, [selectedMonth, items])

    useEffect(() => {
        handleFetchTransaction();
    }, []);

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
        handleFetchTransaction()

        const filteredItems = items.filter(item => {
            const [year] = item.date.split("-").map(Number);
            return year === new Date().getFullYear()
        });


        const total = filteredItems.reduce((acc, item) => acc + item.amount, 0);

        setFilterItems(filteredItems);
        setExpense(total);
        setSelectedMonth(0)

    }

    const differenceInPorcentage = () => {

        const filteredItems = items.filter(item => {
            const [year, month] = item.date.split("-").map(Number)
            return year === new Date().getFullYear() && month === selectedMonth
        })

        const lastItems = items.filter(item => {
            const [year, month] = item.date.split("-").map(Number)
            return year === new Date().getFullYear() && month === new Date().getMonth()
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

    const results = separateAmountByMethod(filterItems)

    return (
        <div>
            <section>
                <div className='flex justify-around items-center py-12'>
                    <h1 className='font-semibold text-3xl'>Hello!</h1>
                    <ul className='flex text-sm font-semibold divide-x'>
                        <li className='border p-2 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-200'><button onClick={lastYearFilter}>Last Year</button></li>
                        <li className='border p-2 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-200'><button onClick={lastMonthSelected}>Last Month</button></li>
                        <li className='border p-2 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-200'><button onClick={thisMonthSelected}>This Month</button></li>
                        <Period onMonthChange={handleMonthChange} selectedMonth={selectedMonth} />
                    </ul>
                </div>
                <div className='flex justify-around p-6 mx-auto items-center'>
                    <div className='bg-white border shadow-md rounded-lg flex p-4 items-center dark:bg-slate-700'>
                        <Dialog>
                            <DialogTrigger asChild>
                                <div className='bg-red-200 rounded-md p-3 text-red-700 cursor-pointer'><FiMinusCircle className='text-xl hover:scale-125 ' /></div>
                            </DialogTrigger>
                            <DialogContent className='sm:max-w-[425px]'>
                                <DialogHeader>
                                    <DialogTitle>Add new Expense</DialogTitle>
                                </DialogHeader>
                                <div className='grid gap-4 py-4'>
                                    <Input type='text' placeholder='Description' value={text} onChange={handleTextChange}></Input>
                                    <Input type='number' placeholder='Amount' value={price} onChange={handlePriceChange}></Input>
                                    <Input type='date' placeholder='Date' value={date} onChange={handleDateChange}></Input>
                                    <Select value={method} onValueChange={handleMethodChange}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Select a method" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectLabel>Methods</SelectLabel>
                                                <SelectItem value="fixes">Fixes</SelectItem>
                                                <SelectItem value="foods">Foods</SelectItem>
                                                <SelectItem value="entertainment">Entertainment</SelectItem>
                                                <SelectItem value="other">Others</SelectItem>
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <DialogFooter>
                                    <Button
                                        onClick={() => handleAddNewItem(false)}
                                        type='button'
                                        disabled={!text || !price || !method || !date}
                                    ><span>Create new</span></Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <div className='px-2'>
                            <p className='font-semibold'>Add expense</p>
                            <p className='text-sm text-slate-500'>Create an expense manually</p>
                        </div>
                    </div>
                    <div className='bg-white flex justify-between p-4 gap-4 rounded-lg border items-end shadow-md dark:bg-slate-700'>
                        <div className=''>
                            <p className='text-xs text-slate-400 dark:text-slate-200'>Expenses</p>
                            <h2 className='text-4xl font-semibold text-red-600'>$ {expense.toFixed(2)}</h2>
                        </div>
                        <div className='border flex items-center text-center rounded-sm max-h-3 p-2.5 font-semibold tracking-wider shadow-md'>
                            <p className='text-sm flex items-center'>{differenceInPorcentage() < 0 ? (<IoIosArrowRoundUp className='text-green-500 text-lg' />) : (<IoIosArrowRoundDown className='text-red-500 text-lg' />)}{differenceInPorcentage().toFixed(2)}%</p>
                        </div>
                    </div>
                </div>
            </section>
            <div className='flex justify-center gap-16 items-stretch'>
                <section className='border rounded-lg bg-white p-4 m-4 dark:bg-slate-700'>
                    <p className='font-semibold'>Expenses by category</p>
                    <div>
                        <DonutChart results={results} />
                    </div>
                    <div>
                        <GraphicListItem results={results} />
                    </div>
                </section>
                <section className='bg-white dark:bg-slate-700'>
                    <header className='p-4 border rounded-t-lg'>
                        <h4 className='font-semibold text-lg'>Last transactions</h4>
                        <p className='text-sm font-semibold text-slate-400'>Check your last transactions</p>
                    </header>
                    <main>
                        <TransactionHeader />
                        <div className='border rounded-b-lg max-h-96 overflow-auto'>
                            <ul className='divide-y '>
                                {filterItems.map((item => (
                                    <TransactionItem key={item.id} item={item} onDelete={handleDeleteItem} />
                                )))}
                            </ul>
                        </div>
                    </main>
                </section>
            </div>
        </div>
    )
}
