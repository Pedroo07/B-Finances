"use client"
import { ChangeEvent, FC, useEffect, useState } from 'react';
import { IoIosArrowRoundUp, IoIosArrowRoundDown } from "react-icons/io";
import { AiOutlineLoading3Quarters } from "react-icons/ai"
import { FiMinusCircle, FiPlusCircle } from "react-icons/fi";
import { Dialog, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogContent } from '@/components/ui/dialog';
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, SelectLabel } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { TransactionItem, TransactionHeader } from './transactions';
import { DonutChart, GraphicListItem, separateAmountByCategory } from './graphic';
import { useAuthState } from 'react-firebase-hooks/auth';
import Period from './period';
import { Transaction } from '@/lib/entities/transaction';
import { createTransaction, deleteTransaction, getTransaction, TransactionDto } from '@/lib/services/transactions';
import { auth } from '@/lib/firebase';
import { TransactionsLoadings } from '../loadings/TrasactionsLoadings';
import { Skeleton } from '@/components/ui/skeleton';
import { ValuesLoadings } from '../loadings/ValuesLoadings';

export const Main: FC = () => {
    const [text, setText] = useState('')
    const [category, setCategory] = useState('')
    const [price, setPrice] = useState(0)
    const [date, setDate] = useState('')
    const [allItems, setAllItems] = useState<Transaction[]>([])
    const [user, loading] = useAuthState(auth)
    const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1)
    const [activeFilter, setActiveFilter] = useState("month")

    const sortItemByDate = (items: Transaction[]): Transaction[] => {
        return [...items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }

    const calculateTotals = (items: Transaction[]): { income: number; expense: number; balance: number } => {
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

    const handleCategoryChange = (value: string): void => {
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

    useEffect(() => {
        if (loading || !user || typeof window === 'undefined') return

        let isMounted = true

        const fetchTransactions = async () => {
            try {
                const transactions = await getTransaction() || []
                const sortedItems = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                if (isMounted) {
                    setAllItems(sortedItems)
                }
            } catch (error) {
                console.error("Error fetching transactions:", error);
            }
        }

        void fetchTransactions()

        return () => {
            isMounted = false
        }
    }, [user, loading]);

    const currentYear = new Date().getFullYear()
    const filterItems = sortItemByDate(allItems.filter(item => {
        const [year, month] = item.date.split("-").map(Number);

        if (activeFilter === "year") {
            return year === currentYear
        }

        return year === currentYear && month === selectedMonth;
    }))

    const { income, expense, balance } = calculateTotals(filterItems);

    const handleDeleteItem = async (id: string) => {
        if (typeof window === 'undefined') return

        await deleteTransaction(id)
        setAllItems((currentItems) => currentItems.filter(item => item.id !== id))
        resetForm()
    }

    const handleAddNewItem = async (IsIncomeDialog: boolean): Promise<void> => {
        const adjustedPrice = IsIncomeDialog ? Math.abs(price) : -Math.abs(price);

        const newItem: TransactionDto = {
            amount: adjustedPrice,
            date: date,
            description: text,
            category: category,
            type: IsIncomeDialog ? 'income' : 'expense'
        };

        try {
            const newTransaction = await createTransaction(newItem);
            setAllItems((currentItems) => sortItemByDate([newTransaction, ...currentItems]));
            resetForm();
        } catch (error) {
            console.error('Error adding transaction:', error);
        }
    };

    const handleMonthChange = (newMonth: number) => {
        setSelectedMonth(newMonth);
        setActiveFilter("month");
    };

    const thisMonthSelected = () => {
        setActiveFilter("month")
        const thisMonth = new Date().getMonth() + 1
        setSelectedMonth(thisMonth)
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
        const filteredItems = allItems.filter(item => {
            const [year, month] = item.date.split("-").map(Number);
            return year === currentYear && month === selectedMonth;
        });
        const lastItems = allItems.filter(item => {
            const [year, month] = item.date.split("-").map(Number);
            return year === currentYear && month === new Date().getMonth();
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
        const filteredItems = allItems.filter(item => {
            const [year, month] = item.date.split("-").map(Number);
            return year === currentYear && month === selectedMonth && item.amount > 0
        });
        const lastItems = allItems.filter(item => {
            const [year, month] = item.date.split("-").map(Number);
            return year === currentYear && month === new Date().getMonth() && item.amount > 0
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
        const filteredItems = allItems.filter(item => {
            const [year, month] = item.date.split("-").map(Number);
            return year === currentYear && month === selectedMonth && item.amount < 0
        });
        const lastItems = allItems.filter(item => {
            const [year, month] = item.date.split("-").map(Number);
            return year === currentYear && month === new Date().getMonth() && item.amount < 0
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

    const results = separateAmountByCategory(filterItems)

    return (
        <div className="max-w-screen-xl mx-auto w-full px-4 max-md:px-2">
            <section>
                <div className='flex flex-col gap-4 justify-between md:flex-row py-6 max-md:justify-center max-md:items-center'>
                    <h1 className='font-semibold text-3xl'>Hello!</h1>
                    <ul className='flex flex-wrap text-sm font-semibold divide-x'>
                        <li className='border p-2 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-200'><button onClick={lastYearFilter}>Last Year</button></li>
                        <li className='border p-2 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-200'><button onClick={lastMonthSelected}>Last Month</button></li>
                        <li className='border p-2 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-200'><button onClick={thisMonthSelected}>This Month</button></li>
                        <Period onMonthChange={handleMonthChange} selectedMonth={selectedMonth} />
                    </ul>
                </div>
                <div className='grid grid-flow-col grid-rows-2 gap-8 mx-auto max-w-screen-xl items-center max-md:grid-cols-3 max-md:gap-4'>
                    {loading ? (<ValuesLoadings />) : (
                        <div className='bg-white flex justify-between p-6 rounded-lg border items-end shadow-md dark:bg-slate-700 max-md:p-2 text-nowrap'>
                            <div>
                                <p className='text-xs text-slate-400 dark:text-slate-200'>Balance</p>
                                <h2 className='text-4xl font-semibold text-blue-600 max-md:text-base'>${balance.toFixed(2)}</h2>
                            </div>
                            <div className='border flex items-center text-center rounded-sm max-h-3 p-2.5 font-semibold tracking-wider shadow-md max-md:p-1 '>
                                <p className='text-sm flex items-center max-md:text-xs'>{differenceInPorcentage() > 0 ? (<IoIosArrowRoundUp className='text-green-500 text-lg max-md:text-xs' />) : (<IoIosArrowRoundDown className='text-red-500 text-lg max-md:text-xs' />)}{differenceInPorcentage().toFixed(2)}%</p>
                            </div>
                        </div>)}

                    <div className='bg-white border shadow-md rounded-lg flex items-center p-4 dark:bg-slate-700 max-md:p-2'>
                        <Dialog>
                            <DialogTrigger asChild>
                                <div className='bg-green-200 rounded-md p-3 text-green-700 cursor-pointer max-md:p-2 '>
                                    <FiPlusCircle className='text-xl hover:scale-125 max-md:text-lg' />
                                </div>
                            </DialogTrigger>
                            <DialogContent className='sm:max-w-[425px]'>
                                <DialogHeader>
                                    <DialogTitle>Add new Income</DialogTitle>
                                </DialogHeader>
                                <div className='grid gap-4 py-4 '>
                                    <Input type='text' placeholder='Description' value={text} onChange={handleTextChange}></Input>
                                    <Input type='number' placeholder='Amount' value={price} onChange={handlePriceChange}></Input>
                                    <Input type='date' placeholder='Date' value={date} onChange={handleDateChange}></Input>
                                    <Select value={category} onValueChange={handleCategoryChange}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Select a category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectLabel>Categorys</SelectLabel>
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
                                        disabled={!text || !price || !category || !date}
                                    ><span>Create new</span></Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <div className='px-2'>
                            <p className='font-semibold max-md:text-base'>Add income</p>
                            <p className='text-sm text-slate-500 max-md:hidden'>Create an income manually</p>
                        </div>
                    </div>
                    {loading ? (<ValuesLoadings />) : (<div className='bg-white flex justify-between p-6 rounded-lg border items-end shadow-md dark:bg-slate-700 max-md:p-2  text-nowrap'>
                        <div>
                            <p className='text-xs text-slate-400 dark:text-slate-200'>Incomes</p>
                            <h2 className='text-4xl font-semibold text-green-600 max-md:text-base'>$ {income.toFixed(2)}</h2>
                        </div>
                        <div className='border flex items-center text-center rounded-sm max-h-3 p-2.5 font-semibold tracking-wider shadow-md max-md:p-1'>
                            <p className='text-sm flex items-center max-md:text-xs'>{differenceInPorcentageIncome() > 0 ? (<IoIosArrowRoundUp className='text-green-500 text-lg max-md:text-xs' />) : (<IoIosArrowRoundDown className='text-red-500 text-lg max-md:text-xs' />)}{differenceInPorcentageIncome().toFixed(2)}%</p>
                        </div>
                    </div>)}
                    <div className='bg-white border shadow-md rounded-lg flex items-center p-4 dark:bg-slate-700 max-md:p-2'>
                        <Dialog>
                            <DialogTrigger asChild>
                                <div className='bg-red-200 rounded-md p-3 text-red-700 cursor-pointer max-md:p-2'><FiMinusCircle className='text-xl hover:scale-125 max-md:text-lg' /></div>
                            </DialogTrigger>
                            <DialogContent className='sm:max-w-[425px]'>
                                <DialogHeader>
                                    <DialogTitle>Add new Expense</DialogTitle>
                                </DialogHeader>
                                <div className='grid gap-4 py-4'>
                                    <Input type='text' placeholder='Description' value={text} onChange={handleTextChange}></Input>
                                    <Input type='number' placeholder='Amount' value={price} onChange={handlePriceChange}></Input>
                                    <Input type='date' placeholder='Date' value={date} onChange={handleDateChange}></Input>
                                    <Select value={category} onValueChange={handleCategoryChange}>
                                        <SelectTrigger className="w-[180px]">
                                            <SelectValue placeholder="Select a Category" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectGroup>
                                                <SelectLabel>Categorys</SelectLabel>
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
                                        disabled={!text || !price || !category || !date}
                                    ><span>Create new</span></Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <div className='px-2'>
                            <p className='font-semibold'>Add expense</p>
                            <p className='text-sm text-slate-500 max-md:hidden'>Create an expense manually</p>
                        </div>
                    </div>
                    {loading ? (<ValuesLoadings />) : (<div className='bg-white flex justify-between p-6 rounded-lg border items-end shadow-md dark:bg-slate-700 max-md:p-2 text-nowrap'>
                        <div>
                            <p className='text-xs text-slate-400 dark:text-slate-200'>Expenses</p>
                            <h2 className='text-4xl font-semibold text-red-600 max-md:text-base'>$ {expense.toFixed(2)}</h2>
                        </div>
                        <div className='border flex items-center text-center rounded-sm max-h-3 p-2.5 font-semibold tracking-wider shadow-md max-md:p-1'>
                            <p className='text-sm flex items-center max-md:text-xs'>{differenceInPorcentageExpense() < 0 ? (<IoIosArrowRoundUp className='text-green-500 text-lg max-md:text-xs' />) : (<IoIosArrowRoundDown className='text-red-500 text-lg max-md:text-xs' />)}{differenceInPorcentageExpense().toFixed(2)}%</p>
                        </div>
                    </div>)}

                </div>
            </section>
            <div className='flex flex-col gap-8 xl:flex-row xl:justify-center xl:gap-16 items-stretch px-4 max-md:flex-col-reverse max-md:items-center max-md:p-6'>
                <section className='border rounded-lg bg-white p-4 m-4 dark:bg-slate-700'>
                    <p className='font-semibold'>Expenses by category</p>
                    <div className='flex justify-center items-center max-md:max-w-[330px]'>
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
                <section className='bg-white dark:bg-slate-700'>
                    <header className='p-4 border rounded-t-lg '>
                        <h4 className='font-semibold text-lg'>Last transactions</h4>
                        <p className='text-sm font-semibold text-slate-400 '>Check your last transactions</p>
                    </header>
                    <main>
                        <TransactionHeader />
                        <div className='border rounded-b-lg max-h-96 overflow-auto'>
                            <ul className='divide-y '>
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
