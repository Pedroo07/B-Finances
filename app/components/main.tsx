"use client"
import React, { ChangeEvent} from 'react'
import { FC, useState } from 'react';
import { CiCalendarDate } from "react-icons/ci";
import { IoIosArrowRoundUp, IoIosArrowRoundDown } from "react-icons/io";
import { FiMinusCircle, FiPlusCircle } from "react-icons/fi";
import { Dialog, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, SelectLabel } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Income } from "../incomes"
import TransactionItem from './transactions';
import { DonutChart,GraphicListItem, } from './graphic';
import { separateAmountByMethod } from './graphic';
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

    const handleDeleteItem = (id: number) => {
        const itemArray = items.filter(item => {
            return item.id !== id
        })
        setItems(itemArray)

        localStorage.setItem("items", JSON.stringify(itemArray))

        const updateIncome = itemArray.filter(item => item.amount
            > 0).reduce((acc, item) => acc + item.amount, 0)

        const updateExpense = itemArray.filter(item => item.amount < 0).reduce((acc, item) => acc + Math.abs(item
            .amount), 0)

        const updateBalance = updateIncome - updateExpense

        setIncome(updateIncome)
        setExpense(updateExpense)
        setBalance(updateBalance)

        localStorage.setItem("incomes", JSON.stringify(updateIncome))
        localStorage.setItem("expenses", JSON.stringify(updateExpense))
        localStorage.setItem("balances", JSON.stringify(updateBalance))
    }

    const handleAddNewItem = (IsIncomeDialog: boolean): void => {
        const adjustedPrice = IsIncomeDialog ? Math.abs(price) : -Math.abs(price)

        const newItem: Income = {
            amount: adjustedPrice,
            date: date,
            description: text,
            method: method,
            id: items.length + 1
        }
        const itemsArray = [newItem, ...items]
        const sortedItems = sortItemByDate(itemsArray)
        setItems(sortedItems)

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
         
        
        setText('')
        setPrice(0)
        setMethod('')
        setDate('')
        localStorage.setItem("items", JSON.stringify(sortedItems))
    }

    const results =  separateAmountByMethod(items)

   
    return (
        <div>
            <section>
                <div className='flex justify-around items-center py-12'>
                    <h1 className='font-semibold text-2xl'>Hello!</h1>
                    <ul className='flex text-xs font-semibold divide-x-reverse '>
                        <li className='border text-slate-600 active:text-blue-400 p-2 bg-white rounded-s-sm'><button>This month</button></li>
                        <li className='border text-slate-600 active:text-blue-400 p-2 bg-white'><button>Last month</button></li>
                        <li className='border text-slate-600 active:text-blue-400 p-2 bg-white rounded-e-sm'><button>This year</button></li>
                        <li className='flex border text-slate-600 active:text-blue-400 p-2 bg-white items-center gap-0.5 rounded mx-2'><CiCalendarDate className='text-sm' /><button>Select period</button></li>

                    </ul>
                </div>
                <div className='grid grid-flow-col grid-rows-2 gap-8  mx-auto max-w-screen-xl items-center'>
                    <div className='bg-white flex justify-between p-6 rounded-lg border items-end shadow-md'>
                        <div>
                            <p className='text-xs text-slate-400'>Balance</p>
                            <h2 className='text-4xl font-semibold text-blue-600'>${balance.toFixed(2)}</h2>
                        </div>
                        <div className='border flex items-center text-center rounded-sm max-h-3 p-2.5 font-semibold tracking-wider shadow-md'>
                            <p className='text-sm flex items-center'><IoIosArrowRoundUp className='text-green-500 text-lg' />12%</p>
                        </div>
                    </div>
                    <div className='bg-white border shadow-md rounded-lg flex items-center p-4'>
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
                        <div>
                            <p className='font-semibold'>Add income</p>
                            <p className='text-sm text-slate-500'>Create an income manually</p>
                        </div>
                    </div>
                    <div className='bg-white flex justify-between p-6 rounded-lg border items-end shadow-md'>
                        <div>
                            <p className='text-xs text-slate-400'>Incomes</p>
                            <h2 className='text-4xl font-semibold text-green-600'>$ {income.toFixed(2)}</h2>
                        </div>
                        <div className='border flex items-center text-center rounded-sm max-h-3 p-2.5 font-semibold tracking-wider shadow-md'>
                            <p className='text-sm flex items-center'><IoIosArrowRoundUp className='text-green-500 text-lg' />27%</p>
                        </div>
                    </div>
                    <div className='bg-white border shadow-md rounded-lg flex items-center p-4'>
                        <Dialog>
                            <DialogTrigger asChild>
                                <div className='bg-red-200 rounded-md p-3 text-red-700 cursor-pointer'><FiMinusCircle className='text-xl hover:scale-125' /></div>
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
                        <div>
                            <p className='font-semibold'>Add expense</p>
                            <p className='text-sm text-slate-500'>Create an expense manually</p>
                        </div>
                    </div>
                    <div className='bg-white flex justify-between p-6 rounded-lg border items-end shadow-md'>
                        <div>
                            <p className='text-xs text-slate-400'>Expenses</p>
                            <h2 className='text-4xl font-semibold text-red-600'>$ {expense.toFixed(2)}</h2>
                        </div>
                        <div className='border flex items-center text-center rounded-sm max-h-3 p-2.5 font-semibold tracking-wider shadow-md'>
                            <p className='text-sm flex items-center'><IoIosArrowRoundDown className='text-red-500 text-lg' />-15%</p>
                        </div>
                    </div>
                </div>
            </section>
            <div className='flex justify-center gap-16'>
                <section className='border rounded-lg bg-white p-4 m-4'>
                    <p className='font-semibold'>Expenses by category</p>
                    <div>
                        <DonutChart results={results}/>
                    </div>
                    <div>    
                     <GraphicListItem results={results}/>    
                    </div>
                </section>
                <section className='bg-white max-h-fit m-4'>
                    <header className='p-4 border rounded-t-lg'>
                        <h4 className='font-semibold text-lg'>Last transactions</h4>
                        <p className='text-sm font-semibold text-slate-400'>Check your last transactions</p>
                    </header>
                    <main>
                        <div>
                            <ul className='flex justify-between bg-neutral-100 border gap-20 pl-6 pr-28 py-1'>
                                <li className='text-sm  text-slate-500  pr-8'>Description</li>
                                <li className='text-sm  text-slate-500'>Method</li>
                                <li className='text-sm  text-slate-500'>Date</li>
                                <li className='text-sm  text-slate-500'>Amount</li>
                            </ul>
                        </div>
                        <div className='border rounded-b-lg '>
                            <ul className='divide-y'>
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

