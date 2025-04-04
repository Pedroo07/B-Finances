"use client"
import React, { useEffect, useState } from 'react'
import { TransactionHeader, TransactionItem } from "@/app/components/transactions"
import { DonutChart, GraphicListItem, separateAmountByMethod } from "@/app/components/graphic"
import Period from '@/app/components/period'
import { getTransaction } from '@/lib/services/transactions'
import { Transaction } from '@/lib/entities/transaction'
export const Main = () => {
  const [items, setItems] = useState<Transaction[]>([])
  const [filterItems, setFilterItems] = useState<Transaction[]>([])
  
  const handleFetchItems = async () => {
    try {
      const itemsOnStorage = await getTransaction() || "[]"
      setItems(itemsOnStorage)
    } catch (e) {
      console.error("error parsing 'items' from localStorage", e)
      return []
    }
  }
  const handleDeleteItem = () => {}


  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1)

  const [activeFilter, setActiveFilter] = useState('month')
  useEffect(() => {
    if (activeFilter !== "month") return
    handleFetchItems()
    const currentYear = new Date().getFullYear()

    const filteredItems = items.filter((item) => {
      const [year, month] = item.date.split('-').map(Number)
      return year === currentYear && month === selectedMonth
    })

    setFilterItems(filteredItems)

  }, [selectedMonth, items])

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

  const results = separateAmountByMethod(filterItems)

  return (
    <div className='flex justify-around items-center'>
      <section>
        <ul className='flex text-sm font-semibold divide-x justify-center my-2'>
          <li className='border p-2 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-200'><button onClick={lastYearFilter}>Last Year</button></li>
          <li className='border p-2 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-200'><button onClick={lastMonthSelected}>Last Month</button></li>
          <li className='border p-2 bg-white text-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-200'><button onClick={thisMonthSelected}>This Month</button></li>
          <Period onMonthChange={setSelectedMonth} selectedMonth={selectedMonth} />
        </ul>
        <section className='border rounded-lg bg-white p-16 m-8 dark:bg-slate-700'>
          <p className='font-semibold text-2xl p-4'>Expenses by category</p>
          <div >
            <DonutChart results={results} />
          </div>
          <div className='text-xl'>
            <GraphicListItem results={results} />
          </div>
        </section>
      </section>
      <section className='bg-white dark:bg-slate-700'>
        <TransactionHeader />
        <div className='border rounded-b-lg max-h-[80vh] overflow-auto'>
          <ul className='divide-y '>
            {filterItems.map((item => (
              <TransactionItem key={item.id} item={item} onDelete={handleDeleteItem} />
            )))}
          </ul>
        </div>
      </section>
    </div>
  )
}

