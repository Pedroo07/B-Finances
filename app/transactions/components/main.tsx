"use client"
import React, { useEffect, useState } from 'react'
import { TransactionHeader, TransactionItem } from "@/app/components/transactions"
import { Income } from "@/app/incomes"
import { DonutChart, GraphicListItem, separateAmountByMethod } from "@/app/components/graphic"
import Period from '@/app/components/period'
export const Main = () => {
  const [items, setItems] = useState<Income[]>(() => {

    try {
      const itemsOnStorage = localStorage.getItem("items")
      return itemsOnStorage ? JSON.parse(itemsOnStorage) : []
    } catch (e) {
      console.error("error parsing 'items' from localStorage", e)
      return []
    }

  })
  const handleDeleteItem = () => {

  }

  const results = separateAmountByMethod(items)

  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1)



  useEffect(() => {
    const storedItems: Income[] = JSON.parse(localStorage.getItem("items") || " []")
    const currentYear = new Date().getFullYear()

    const filteredItems = storedItems.filter((item) => {
      const [year, month] = item.date.split('-').map(Number)
      return year === currentYear && month === selectedMonth
    })

    setItems(filteredItems)

  }, [selectedMonth])

  const thisMonthSelected = () => {
    const thisMonth = new Date().getMonth() + 1
    setSelectedMonth(thisMonth)
  }
  const lastMonthSelected = () => {
    const lastMonth = new Date().getMonth()
    setSelectedMonth(lastMonth)
  }
  const lastYearFilter = () => {
    const storedItems: Income[] = JSON.parse(localStorage.getItem("items") || " []")
    const currentYear = new Date().getFullYear()

    const filteredItems = storedItems.filter((item) => {
      const [year] = item.date.split('-').map(Number)
      return year === currentYear
    })

    setItems(filteredItems)
  }

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
            {items.map((item => (
              <TransactionItem key={item.id} item={item} onDelete={handleDeleteItem} />
            )))}
          </ul>
        </div>
      </section>
    </div>
  )
}

