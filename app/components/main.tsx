"use client"
import React, { ChangeEvent, useEffect } from 'react'
import { FC, useState } from 'react';
import { IoIosArrowRoundUp, IoIosArrowRoundDown } from "react-icons/io";
import { FiMinusCircle, FiPlusCircle } from "react-icons/fi";
import { Dialog, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, SelectLabel } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Income } from "../incomes"
import { TransactionItem, TransactionHeader } from './transactions';
import { DonutChart, GraphicListItem, } from './graphic';
import { separateAmountByMethod } from './graphic';
import { v4 as uuidv4 } from 'uuid';
import Period from './period';
export const Main: FC = () => {

    const [text, setText] = useState('')
    const [method, setMethod] = useState('')
    const [price, setPrice] = useState(0)
    const [date, setDate] = useState('')
    const sortItemByDate = (items: Income[]): Income[] => {
        return [...items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }
    const [expense, setExpense] = useState<number>(() => {
        try {
            const expenseOnStorage = localStorage.getItem("expenses")
            return expenseOnStorage ? JSON.parse(expenseOnStorage) : 0
        } catch (e) {
            console.error("error parsing 'expenses' from localStorage", e)
            return []
        }
    })
    const [income, setIncome] = useState<number>(() => {
        try {
            const incomeOnStorage = localStorage.getItem("incomes")
            return incomeOnStorage ? JSON.parse(incomeOnStorage) : 0
        } catch (e) {
            console.error("error parsing 'incomes' from localStorage", e)
            return []
        }
    })
    const [balance, setBalance] = useState<number>(() => {
        try {

            const balanceOnStorage = localStorage.getItem("balances")
            return balanceOnStorage ? JSON.parse(balanceOnStorage) : 0
        } catch (e) {
            console.error("error parsing 'balances' from localStorage", e)
            return []
        }
    })
    const [items, setItems] = useState<Income[]>(() => {

        try {
            const itemsOnStorage = localStorage.getItem("items")
            return itemsOnStorage ? JSON.parse(itemsOnStorage) : []
        } catch (e) {
            console.error("error parsing 'items' from localStorage", e)
            return []
        }

    })
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

    const [allItems, setAllItems] = useState<Income[]>([])

    const cauculateCurrentMonthTotals = () => {
        if (typeof window === 'undefined') return { expense: 0, income: 0, balance: 0 }

        const storedItems: Income[] = JSON.parse(localStorage.getItem("items") || "[]")

        const today = new Date()
        const currentYear = today.getFullYear()

        let totalIncome = 0
        let totalExpense = 0

        storedItems.forEach(item => {
            const [year, month] = item.date.split("-").map(Number)
            if (year === currentYear && month === selectedMonth) {
                if (item.amount > 0) {
                    totalIncome += item.amount
                } else {
                    totalExpense += Math.abs(item.amount)
                }
            }
        })

        return {
            income: totalIncome,
            expense: totalExpense,
            balance: totalIncome - totalExpense
        }
    }
    const cauculateCurrentYear = () => {
        if (typeof window === 'undefined') return { expense: 0, income: 0, balance: 0 }

        const storedItems: Income[] = JSON.parse(localStorage.getItem("items") || "[]")

        const today = new Date()
        const currentYear = today.getFullYear()

        let totalIncome = 0
        let totalExpense = 0

        storedItems.forEach(item => {
            const [year] = item.date.split("-").map(Number)
            if (year === currentYear) {
                if (item.amount > 0) {
                    totalIncome += item.amount
                } else {
                    totalExpense += Math.abs(item.amount)
                }
            }
        })

        return {
            income: totalIncome,
            expense: totalExpense,
            balance: totalIncome - totalExpense
        }
    }

    const handleDeleteItem = (id: string) => {
        const itemArray = allItems.filter(item => {
            return item.id !== id
        })
        setAllItems(itemArray)


        const filteredItems = itemArray.filter(item => {
            const [year, month] = item.date.split("-").map(Number)
            return year === new Date().getFullYear() && month === selectedMonth
        })

        const { income, expense, balance } = calculateTotals(filteredItems);
        setIncome(income);
        setExpense(expense);
        setBalance(balance);
        setItems(filteredItems)
        setText('')
        setPrice(0)
        setMethod('')
        setDate('')

        localStorage.setItem("items", JSON.stringify(itemArray))

        localStorage.setItem("incomes", JSON.stringify(income))
        localStorage.setItem("expenses", JSON.stringify(expense))
        localStorage.setItem("balances", JSON.stringify(balance))
    }

    const handleAddNewItem = (IsIncomeDialog: boolean): void => {
        const adjustedPrice = IsIncomeDialog ? Math.abs(price) : -Math.abs(price)

        const newItem: Income = {
            amount: adjustedPrice,
            date: date,
            description: text,
            method: method,
            id: uuidv4()
        }
        const itemsArray = [newItem, ...allItems]
        const sortedItems = sortItemByDate(itemsArray)
        setAllItems(sortedItems)

        if (IsIncomeDialog) {
            setIncome((prevIncome) => {
                const updateIncome = prevIncome + adjustedPrice
                const updateBalance = updateIncome - expense
                setBalance(updateBalance)
                localStorage.setItem("incomes", JSON.stringify(updateIncome))
                localStorage.setItem("balances", JSON.stringify(updateBalance))
                return updateIncome
            })
        } else {
            setExpense((prevExpense) => {
                const updateExpense = prevExpense + Math.abs(adjustedPrice)
                const updateBalance = income - updateExpense
                setBalance(updateBalance)
                localStorage.setItem("expenses", JSON.stringify(updateExpense))
                localStorage.setItem("balances", JSON.stringify(updateBalance))
                return updateExpense
            })
        }

        const filteredItems = sortedItems.filter(item => {
            const [year, month] = item.date.split("-").map(Number)
            return year === new Date().getFullYear() && month === selectedMonth
        })

        const { income, expense, balance } = calculateTotals(filteredItems);
        setIncome(income);
        setExpense(expense);
        setBalance(balance);
        setItems(filteredItems)
        setText('')
        setPrice(0)
        setMethod('')
        setDate('')
        localStorage.setItem("items", JSON.stringify(sortedItems))
    }
    const calculateTotals = (items: Income[]): { income: number; expense: number; balance: number } => {
        let totalIncome = 0;
        let totalExpense = 0;

        items.forEach(item => {
            if (item.amount > 0) {
                totalIncome += item.amount;
            } else {
                totalExpense += Math.abs(item.amount);
            }
        });

        return {
            income: totalIncome,
            expense: totalExpense,
            balance: totalIncome - totalExpense
        };
    };
    const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1)


    useEffect(() => {
        const storedItems: Income[] = JSON.parse(localStorage.getItem("items") || "[]");
        setAllItems(storedItems);

        const filteredItems = storedItems.filter(item => {
            const [year, month] = item.date.split("-").map(Number);
            return year === new Date().getFullYear() && month === selectedMonth;
        });

        setItems(filteredItems);

        const { income, expense, balance } = cauculateCurrentMonthTotals();
        setIncome(income);
        setExpense(expense);
        setBalance(balance);
    }, [selectedMonth]);

    const thisMonthSelected = () => {
        const thisMonth = new Date().getMonth() + 1
        setSelectedMonth(thisMonth)
    }
    const lastMonthSelected = () => {
        const lastMonth = new Date().getMonth()
        setSelectedMonth(lastMonth)
    }

    const lastYearFilter = () => {
        const storedItems: Income[] = JSON.parse(localStorage.getItem("items") || "[]");
        setAllItems(storedItems);

        const filteredItems = storedItems.filter(item => {
            const [year] = item.date.split("-").map(Number);
            return year === new Date().getFullYear()
        });

        setItems(filteredItems);

        const { income, expense, balance } = cauculateCurrentYear();
        setIncome(income);
        setExpense(expense);
        setBalance(balance);
    }

    const differenceInPorcentage = () => {
        const storedItems: Income[] = JSON.parse(localStorage.getItem("items") || "[]");

        const filteredItems = storedItems.filter(item => {
            const [year, month] = item.date.split("-").map(Number);
            return year === new Date().getFullYear() && month === selectedMonth;
        });
        const lastItems = storedItems.filter(item => {
            const [year, month] = item.date.split("-").map(Number);
            return year === new Date().getFullYear() && month === new Date().getMonth();
        });

        const totalExpense = filteredItems.reduce((acc, item) => acc + item.amount, 0)
        const lastExpense = lastItems.reduce((acc, item) => acc + item.amount, 0)

        if (lastExpense === 0) {
            return 0
        }

        const difference = totalExpense - lastExpense
        const totalInPorcentage = (difference / Math.abs(lastExpense)) * 100
        return totalInPorcentage

    }

    const differenceInPorcentageIncome = () => {
        const storedItems: Income[] = JSON.parse(localStorage.getItem("items") || "[]");

        const filteredItems = storedItems.filter(item => {
            const [year, month] = item.date.split("-").map(Number);
            return year === new Date().getFullYear() && month === selectedMonth && item.amount > 0
        });
        const lastItems = storedItems.filter(item => {
            const [year, month] = item.date.split("-").map(Number);
            return year === new Date().getFullYear() && month === new Date().getMonth() && item.amount > 0
        });

        const totalIncome = filteredItems.reduce((acc, item) => acc + item.amount, 0)
        const lastIncome = lastItems.reduce((acc, item) => acc + item.amount, 0)

        if (lastIncome === 0) {
            return 0
        }

        const difference = totalIncome - lastIncome
        const totalInPorcentage = (difference / Math.abs(lastIncome)) * 100
        return totalInPorcentage

    }

    const differenceInPorcentageExpense = () => {
        const storedItems: Income[] = JSON.parse(localStorage.getItem("items") || "[]");

        const filteredItems = storedItems.filter(item => {
            const [year, month] = item.date.split("-").map(Number);
            return year === new Date().getFullYear() && month === selectedMonth && item.amount < 0
        });
        const lastItems = storedItems.filter(item => {
            const [year, month] = item.date.split("-").map(Number);
            return year === new Date().getFullYear() && month === new Date().getMonth() && item.amount < 0
        });

        const totalExpense = filteredItems.reduce((acc, item) => acc + item.amount, 0)
        const lastExpense = lastItems.reduce((acc, item) => acc + item.amount, 0)

        if (lastExpense === 0) {
            return 0
        }

        const difference = totalExpense - lastExpense
        const totalInPorcentage = (difference / lastExpense * 100)
        return totalInPorcentage

    }

    const results = separateAmountByMethod(items)

    return (
        <div>
            <section>
                <div className='flex justify-around items-center py-12'>
                    <h1 className='font-semibold text-3xl'>Hello!</h1>
                    <ul className='flex text-sm font-semibold divide-x'>
                        <li className='border p-2 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-200'><button onClick={lastYearFilter}>Last Year</button></li>
                        <li className='border p-2 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-200'><button onClick={lastMonthSelected}>Last Month</button></li>
                        <li className='border p-2 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-200'><button onClick={thisMonthSelected}>This Month</button></li>
                        <Period onMonthChange={setSelectedMonth} selectedMonth={selectedMonth} />
                    </ul>
                </div>
                <div className='grid grid-flow-col grid-rows-2 gap-8  mx-auto max-w-screen-xl items-center'>
                    <div className='bg-white flex justify-between p-6 rounded-lg border items-end shadow-md dark:bg-slate-700 '>
                        <div>
                            <p className='text-xs text-slate-400 dark:text-slate-200'>Balance</p>
                            <h2 className='text-4xl font-semibold text-blue-600'>${balance.toFixed(2)}</h2>
                        </div>
                        <div className='border flex items-center text-center rounded-sm max-h-3 p-2.5 font-semibold tracking-wider shadow-md'>
                            <p className='text-sm flex items-center'>{differenceInPorcentage() > 0 ? (<IoIosArrowRoundUp className='text-green-500 text-lg' />) : (<IoIosArrowRoundDown className='text-red-500 text-lg' />)}{differenceInPorcentage().toFixed(2)}%</p>
                        </div>
                    </div>
                    <div className='bg-white border shadow-md rounded-lg flex items-center p-4 dark:bg-slate-700 '>
                        <Dialog>
                            <DialogTrigger asChild>
                                <div className='bg-green-200 rounded-md p-3 text-green-700 cursor-pointer'>
                                    <FiPlusCircle className='text-xl hover:scale-125' />
                                </div>
                            </DialogTrigger>
                            <DialogContent className='sm:max-w-[425px]'>
                                <DialogHeader>
                                    <DialogTitle>Add new Income</DialogTitle>
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
                                                <SelectItem value="salary">Salary</SelectItem>
                                                <SelectItem value="extra">Extra</SelectItem>
                                                <SelectItem value="other">Others</SelectItem>
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <DialogFooter>
                                    <Button
                                        onClick={() => handleAddNewItem(true)}
                                        type='button'
                                        disabled={!text || !price || !method || !date}
                                    ><span>Create new</span></Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <div className='px-2'>
                            <p className='font-semibold'>Add income</p>
                            <p className='text-sm text-slate-500'>Create an income manually</p>
                        </div>
                    </div>
                    <div className='bg-white flex justify-between p-6 rounded-lg border items-end shadow-md dark:bg-slate-700'>
                        <div>
                            <p className='text-xs text-slate-400 dark:text-slate-200'>Incomes</p>
                            <h2 className='text-4xl font-semibold text-green-600'>$ {income.toFixed(2)}</h2>
                        </div>
                        <div className='border flex items-center text-center rounded-sm max-h-3 p-2.5 font-semibold tracking-wider shadow-md'>
                            <p className='text-sm flex items-center'>{differenceInPorcentageIncome() > 0 ? (<IoIosArrowRoundUp className='text-green-500 text-lg' />) : (<IoIosArrowRoundDown className='text-red-500 text-lg' />)}{differenceInPorcentageIncome().toFixed(2)}%</p>
                        </div>
                    </div>
                    <div className='bg-white border shadow-md rounded-lg flex items-center p-4 dark:bg-slate-700'>
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
                    <div className='bg-white flex justify-between p-6 rounded-lg border items-end shadow-md dark:bg-slate-700'>
                        <div>
                            <p className='text-xs text-slate-400 dark:text-slate-200'>Expenses</p>
                            <h2 className='text-4xl font-semibold text-red-600'>$ {expense.toFixed(2)}</h2>
                        </div>
                        <div className='border flex items-center text-center rounded-sm max-h-3 p-2.5 font-semibold tracking-wider shadow-md'>
                            <p className='text-sm flex items-center'>{differenceInPorcentageExpense() < 0 ? (<IoIosArrowRoundUp className='text-green-500 text-lg' />) : (<IoIosArrowRoundDown className='text-red-500 text-lg' />)}{differenceInPorcentageExpense().toFixed(2)}%</p>
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
                    <header className='p-4 border rounded-t-lg '>
                        <h4 className='font-semibold text-lg'>Last transactions</h4>
                        <p className='text-sm font-semibold text-slate-400 '>Check your last transactions</p>
                    </header>
                    <main>
                        <TransactionHeader />
                        <div className='border rounded-b-lg max-h-96 overflow-auto'>
                            <ul className='divide-y '>
                                {items.map((item => (
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

