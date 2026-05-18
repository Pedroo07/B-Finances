"use client"
import React, { ChangeEvent, FC, useEffect, useState } from 'react';
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
import { formatCurrency } from '@/lib/utils';

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
    const filterButtonClass = 'surface-chip inline-flex items-center px-4 py-2'

    return (
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
            <section className='surface-card p-6 sm:p-7'>
                <div className='flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between'>
                    <div className='space-y-2'>
                        <span className='inline-flex rounded-full border border-[#22C55E]/20 bg-[#22C55E]/10 px-4 py-2 text-sm font-medium text-[#15803D] dark:text-[#4ADE80]'>
                            Painel financeiro
                        </span>
                        <h1 className='text-3xl font-semibold tracking-tight text-[#0F172A] dark:text-white'>Olá!</h1>
                        <p className='max-w-2xl text-sm leading-6 text-[#64748B] dark:text-[#94A3BB]'>
                            Visualize seu saldo, acompanhe entradas e despesas e registre novos lançamentos com mais clareza.
                        </p>
                    </div>
                    <ul className='flex max-sm:flex-wrap gap-2'>
                        <li><button className={filterButtonClass} onClick={lastYearFilter}>Último ano</button></li>
                        <li><button className={filterButtonClass} onClick={lastMonthSelected}>Último mês</button></li>
                        <li><button className={filterButtonClass} onClick={thisMonthSelected}>Este mês</button></li>
                        <Period onMonthChange={handleMonthChange} selectedMonth={selectedMonth} />
                    </ul>
                </div>
            </section>
            <section className='grid gap-4 md:grid-cols-2 2xl:grid-cols-5'>
                {loading ? (<ValuesLoadings />) : (
                    <div className='surface-card flex flex-col justify-between gap-2 p-5 sm:p-6'>
                        <div>
                            <p className='text-xs uppercase tracking-[0.22em] text-[#94A3BB]'>Saldo</p>
                            <h2 className='mt-3 text-3xl font-semibold text-[#0F172A] dark:text-white sm:text-3xl'>{formatCurrency(balance)}</h2>
                        </div>
                        <div className='flex w-fit items-center rounded-full border border-border/60 px-3 py-2 text-sm font-semibold text-[#334155] dark:text-[#E2E8F0]'>
                            {differenceInPorcentage() > 0 ? (<IoIosArrowRoundUp className='text-[#22C55E] text-lg' />) : (<IoIosArrowRoundDown className='text-rose-500 text-lg' />)}{differenceInPorcentage().toFixed(2)}%
                        </div>
                    </div>)}

                <div className='surface-card flex items-center gap-4 p-5 sm:p-6'>
                    <Dialog>
                        <DialogTrigger asChild>
                            <div className='flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl bg-[#22C55E]/12 text-[#16A34A] transition-transform hover:scale-[1.03] dark:bg-[#22C55E]/18 dark:text-[#4ADE80]'>
                                <FiPlusCircle className='text-2xl' />
                            </div>
                        </DialogTrigger>
                        <DialogContent className='sm:max-w-106'>
                            <DialogHeader>
                                <DialogTitle>Adicionar nova receita</DialogTitle>
                            </DialogHeader>
                            <div className='grid gap-4 py-4 '>
                                <Input type='text' placeholder='Descrição' value={text} onChange={handleTextChange}></Input>
                                <Input type='number' placeholder='Valor' value={price} onChange={handlePriceChange}></Input>
                                <Input type='date' placeholder='Data' value={date} onChange={handleDateChange}></Input>
                                <Select value={category} onValueChange={handleCategoryChange}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Selecione uma categoria" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectLabel>Categorias</SelectLabel>
                                            <SelectItem value="salary">Salário</SelectItem>
                                            <SelectItem value="extra">Extra</SelectItem>
                                            <SelectItem value="other">Outros</SelectItem>
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            </div>
                            <DialogFooter>
                                <Button
                                    onClick={() => handleAddNewItem(true)}
                                    type='button'
                                    disabled={!text || !price || !category || !date}
                                    className='w-full sm:w-auto'
                                ><span>Criar lançamento</span></Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <div>
                        <p className='font-semibold text-[#0F172A] dark:text-white'>Adicionar receita</p>
                        <p className='text-sm text-[#64748B] dark:text-[#94A3BB]'>Cadastre uma entrada manualmente.</p>
                    </div>
                </div>
                {loading ? (<ValuesLoadings />) : (<div className='surface-card flex flex-col justify-between gap-5 p-2 sm:p-6'>
                    <div>
                        <p className='text-xs uppercase tracking-[0.22em] text-[#94A3BB]'>Entradas</p>
                        <h2 className='mt-3 text-3xl font-semibold text-[#16A34A] sm:text-3xl dark:text-[#4ADE80]'>{formatCurrency(income)}</h2>
                    </div>
                    <div className='flex w-fit items-center rounded-full border border-border/60 px-3 py-2 text-sm font-semibold text-[#334155] dark:text-[#E2E8F0]'>
                        {differenceInPorcentageIncome() > 0 ? (<IoIosArrowRoundUp className='text-[#22C55E] text-lg' />) : (<IoIosArrowRoundDown className='text-rose-500 text-lg' />)}{differenceInPorcentageIncome().toFixed(2)}%
                    </div>
                </div>)}
                <div className='surface-card flex items-center gap-4 p-5 sm:p-6'>
                    <Dialog>
                        <DialogTrigger asChild>
                            <div className='flex h-14 w-14 cursor-pointer items-center justify-center rounded-2xl bg-rose-500/12 text-rose-500 transition-transform hover:scale-[1.03] dark:bg-rose-500/18 dark:text-rose-300'><FiMinusCircle className='text-2xl' /></div>
                        </DialogTrigger>
                        <DialogContent className='sm:max-w-106'>
                            <DialogHeader>
                                <DialogTitle>Adicionar nova despesa</DialogTitle>
                            </DialogHeader>
                            <div className='grid gap-4 py-4'>
                                <Input type='text' placeholder='Descrição' value={text} onChange={handleTextChange}></Input>
                                <Input type='number' placeholder='Valor' value={price} onChange={handlePriceChange}></Input>
                                <Input type='date' placeholder='Data' value={date} onChange={handleDateChange}></Input>
                                <Select value={category} onValueChange={handleCategoryChange}>
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
                            </div>
                            <DialogFooter>
                                <Button
                                    onClick={() => handleAddNewItem(false)}
                                    type='button'
                                    disabled={!text || !price || !category || !date}
                                    className='w-full sm:w-auto'
                                ><span>Criar lançamento</span></Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <div>
                        <p className='font-semibold text-[#0F172A] dark:text-white'>Adicionar despesa</p>
                        <p className='text-sm text-[#64748B] dark:text-[#94A3BB]'>Cadastre uma saída manualmente.</p>
                    </div>
                </div>
                {loading ? (<ValuesLoadings />) : (<div className='surface-card flex flex-col justify-between gap-5 p-5 sm:p-6'>
                    <div>
                        <p className='text-xs uppercase tracking-[0.22em] text-[#94A3BB]'>Despesas</p>
                        <h2 className='mt-3 text-3xl font-semibold text-rose-500 sm:text-3xl dark:text-rose-300'>{formatCurrency(expense)}</h2>
                    </div>
                    <div className='flex w-fit items-center rounded-full border border-border/60 px-3 py-2 text-sm font-semibold text-[#334155] dark:text-[#E2E8F0]'>
                        {differenceInPorcentageExpense() < 0 ? (<IoIosArrowRoundUp className='text-[#22C55E] text-lg' />) : (<IoIosArrowRoundDown className='text-rose-500 text-lg' />)}{differenceInPorcentageExpense().toFixed(2)}%
                    </div>
                </div>)}
            </section>
            <div className='flex flex-col gap-6 xl:flex-row xl:items-stretch'>
                <section className='surface-card w-full p-6 xl:max-w-105'>
                    <p className='text-lg font-semibold text-[#0F172A] dark:text-white'>Despesas por categoria</p>
                    <p className='mt-1 text-sm text-[#64748B] dark:text-[#94A3BB]'>Entenda rapidamente a distribuição das saídas.</p>
                    <div className='mt-6 flex justify-center items-center max-md:max-w-82'>
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
                <div className='w-full xl:relative xl:flex-1'>
                    <section className='surface-card-strong w-full flex flex-col xl:absolute xl:inset-0 overflow-hidden'>
                        <header className='border-b soft-divider px-5 py-5 sm:px-6'>
                            <h4 className='text-xl font-semibold text-[#0F172A] dark:text-white'>Últimas transações</h4>
                            <p className='text-sm text-[#64748B] dark:text-[#94A3BB]'>Acompanhe seus lançamentos recentes com leitura mais limpa.</p>
                        </header>
                        <main className="flex min-h-0 flex-1 flex-col">
                            <TransactionHeader />
                            <div className='min-h-0 flex-1 overflow-auto'>
                                <ul className='divide-y divide-border/40'>
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
        </div>
    )
}