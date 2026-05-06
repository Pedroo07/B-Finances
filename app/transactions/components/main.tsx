"use client"
import React, { useEffect, useState } from 'react'
import { TransactionHeader, TransactionItem } from "@/app/dashboard/components/transactions"
import { DonutChart, GraphicListItem, separateAmountByCategory } from "@/app/dashboard/components/graphic"
import Period from '@/app/dashboard/components/period'
import { getTransaction } from '@/lib/services/transactions'
import { Transaction } from '@/lib/entities/transaction'
import { useAuthState } from 'react-firebase-hooks/auth'
import { auth } from '@/lib/firebase'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { Skeleton } from '@/components/ui/skeleton'
import { TransactionsLoadings } from '@/app/dashboard/loadings/TrasactionsLoadings'

export const Main = () => {
  const [user, loading] = useAuthState(auth)
  const [items, setItems] = useState<Transaction[]>([])
  const handleDeleteItem = () => { }

  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1)
  const [activeFilter, setActiveFilter] = useState('month')

  useEffect(() => {
    if (loading || !user || typeof window === 'undefined') return

    let isMounted = true

    const fetchItems = async () => {
      try {
        const itemsOnStorage = await getTransaction() || []
        if (isMounted) {
          setItems(itemsOnStorage)
        }
      } catch (e) {
        console.error("error parsing 'items'", e)
      }
    }

    void fetchItems()

    return () => {
      isMounted = false
    }
  }, [loading, user])

  const currentYear = new Date().getFullYear()
  const filterItems = items.filter((item) => {
    const [year, month] = item.date.split('-').map(Number)

    if (activeFilter === "year") {
      return year === currentYear
    }

    return year === currentYear && month === selectedMonth
  })

  const thisMonthSelected = () => {
    setActiveFilter('month')
    const thisMonth = new Date().getMonth() + 1
    setSelectedMonth(thisMonth)
  }
  const lastMonthSelected = () => {
    setActiveFilter('month')
    const lastMonth = new Date().getMonth()
    setSelectedMonth(lastMonth)
  }
  const lastYearFilter = () => {
    setActiveFilter('year')
    setSelectedMonth(0)
  }

  const results = separateAmountByCategory(filterItems)
  const filterButtonClass = 'surface-chip inline-flex items-center px-4 py-2'

  return (
    <div className='mx-auto flex max-w-screen-xl flex-col gap-6 px-4 py-6 sm:px-6 xl:flex-row'>
      <section className="flex w-full flex-col gap-6 xl:max-w-[420px]">
        <div className="surface-card p-6">
          <div className='space-y-2'>
            <span className='inline-flex rounded-full border border-[#22C55E]/20 bg-[#22C55E]/10 px-4 py-2 text-sm font-medium text-[#15803D] dark:text-[#4ADE80]'>
              Histórico financeiro
            </span>
            <h1 className='text-3xl font-semibold tracking-tight text-[#0F172A] dark:text-white'>Transações</h1>
            <p className='text-sm leading-6 text-[#64748B] dark:text-[#94A3BB]'>
              Filtre seu histórico e acompanhe a distribuição das despesas por categoria.
            </p>
          </div>
          <ul className='mt-6 flex flex-wrap gap-2'>
            <li><button className={filterButtonClass} onClick={lastYearFilter}>Último ano</button></li>
            <li><button className={filterButtonClass} onClick={lastMonthSelected}>Último mês</button></li>
            <li><button className={filterButtonClass} onClick={thisMonthSelected}>Este mês</button></li>
            <Period onMonthChange={setSelectedMonth} selectedMonth={selectedMonth} />
          </ul>
        </div>
        <section className="surface-card p-6">
          <p className='text-lg font-semibold text-[#0F172A] dark:text-white'>Despesas por categoria</p>
          <p className='mt-1 text-sm text-[#64748B] dark:text-[#94A3BB]'>Uma visão rápida do que mais pesa no seu mês.</p>
          <div className='mt-6 flex justify-center'>
            {loading ? (
              <AiOutlineLoading3Quarters className='h-24 w-24 animate-spin p-6 text-[#22C55E]' />
            ) : (<DonutChart results={results} />)}
          </div>
          <div className='mt-4 text-xl'>
            {loading ? (
              <Skeleton className='h-28 w-full' />
            ) : (
              <GraphicListItem results={results} />
            )}
          </div>
        </section>
      </section>
      <section className="surface-card-strong w-full overflow-hidden">
        <div className='border-b soft-divider px-5 py-5 sm:px-6'>
          <h2 className='text-xl font-semibold text-[#0F172A] dark:text-white'>Últimas transações</h2>
          <p className='mt-1 text-sm text-[#64748B] dark:text-[#94A3BB]'>Consulte suas movimentações mais recentes com mais conforto no desktop e no celular.</p>
        </div>
        <TransactionHeader />
        <div className='max-h-[70vh] overflow-auto'>
          <ul className='divide-y divide-border/40'>
            {filterItems.map((item => (loading ? (
              <TransactionsLoadings key={item.id} />
            ) : <TransactionItem key={item.id} item={item} onDelete={handleDeleteItem} />
            )))}
          </ul>
        </div>
      </section>
    </div>
  )
}
