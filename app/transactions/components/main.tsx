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
  const [filterItems, setFilterItems] = useState<Transaction[]>([])

  const handleFetchItems = async () => {
    if (typeof window !== 'undefined') {
      try {
        const itemsOnStorage = await getTransaction() || "[]"
        setItems(itemsOnStorage)
      } catch (e) {
        console.error("error parsing 'items'", e)
        return []
      }
    }
  }
  const handleDeleteItem = () => { }


  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1)

  const [activeFilter, setActiveFilter] = useState('month')
  useEffect(() => {
    if (activeFilter !== "month") return

    const currentYear = new Date().getFullYear()

    const filteredItems = items.filter((item) => {
      const [year, month] = item.date.split('-').map(Number)
      return year === currentYear && month === selectedMonth
    })

    setFilterItems(filteredItems)

  }, [selectedMonth, items])
  useEffect(() => {
    if (!loading && user) {
      handleFetchItems()
    }

  }, [loading, user])

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
    handleFetchItems()

    const filteredItems = items.filter(item => {
      const [year] = item.date.split("-").map(Number);
      return year === new Date().getFullYear()
    });

    setFilterItems(filteredItems);
    setSelectedMonth(0)

  }

  const results = separateAmountByCategory(filterItems)

  return (
    <div className='lg:flex max-w-screen-xl mx-auto w-full px-4 py-4 lg:items-center'>
      <section className="flex flex-col gap-6 lg:justify-between">
        <div className="flex flex-col w-full">
          <ul className='flex flex-wrap  text-sm font-semibold justify-center my-4'>
            <li className='border p-2 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-200'><button onClick={lastYearFilter}>Last Year</button></li>
            <li className='border p-2 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-200'><button onClick={lastMonthSelected}>Last Month</button></li>
            <li className='border p-2 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-200'><button onClick={thisMonthSelected}>This Month</button></li>
            <Period onMonthChange={setSelectedMonth} selectedMonth={selectedMonth} />
          </ul>
          <section className="border rounded-lg bg-white dark:bg-slate-700 p-6 shadow-md lg:m-8">
            <p className='font-semibold text-2xl p-4'>Expenses by category</p>
            <div >
              {loading ? (
                <AiOutlineLoading3Quarters className='animate-spin m-auto h-28 w-28 p-8' />

              ) : (<DonutChart results={results} />)}
            </div>
            <div className='text-xl'>
              {loading ?
                (<Skeleton className='h-3' />)
                : (<GraphicListItem results={results} />)}
            </div>
          </section>
        </div>
      </section>
      <section className="bg-white dark:bg-slate-700 border rounded-lg w-full sm:w-[58%] flex flex-col">
        <TransactionHeader />
        <div className='border-t rounded-b-lg max-h-[70vh] overflow-auto'>
          <ul className='divide-y '>
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

