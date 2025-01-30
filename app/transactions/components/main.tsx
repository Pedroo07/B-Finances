"use client"
import React, { useState } from 'react'
import { TransactionHeader, TransactionItem } from "@/app/components/transactions"
import { Income } from "@/app/incomes"
import { DonutChart, GraphicListItem, separateAmountByMethod } from "@/app/components/graphic"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  const handleDeleteItem = (id: string) => {
    const itemArray = items.filter(item => {
      return item.id !== id
    })
    setItems(itemArray)

    localStorage.setItem("items", JSON.stringify(itemArray))
  }
  const results = separateAmountByMethod(items)
  return (
    <div className='flex justify-around items-center'>
      <section>
        <div>
          <ul className='flex text-sm font-semibold divide-x'>
            <li className='border p-2 bg-white text-slate-600'><button>Last Month</button></li>
            <li className='border p-2 bg-white text-slate-600'><button>This Month</button></li>
            <li>
              <Select name='Choose the Month'>
                <SelectTrigger className='bg-white text-slate-600 rounded-none p-2'>
                  <SelectValue placeholder="Choose the Month" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="january">january</SelectItem>
                  <SelectItem value="february">february</SelectItem>
                  <SelectItem value="march">march</SelectItem>
                  <SelectItem value="april">april</SelectItem>
                  <SelectItem value="may">may</SelectItem>
                  <SelectItem value="june">june</SelectItem>
                  <SelectItem value="july">july</SelectItem>
                  <SelectItem value="august">august</SelectItem>
                  <SelectItem value="september">september</SelectItem>
                  <SelectItem value="october">october</SelectItem>
                  <SelectItem value="november">november</SelectItem>
                  <SelectItem value="december">december</SelectItem>
                </SelectContent>
              </Select>
            </li>
          </ul>
        </div>
        <section className='border rounded-lg bg-white p-16 m-8'>
          <p className='font-semibold text-2xl p-4'>Expenses by category</p>
          <div >
            <DonutChart results={results} />
          </div>
          <div className='text-xl'>
            <GraphicListItem results={results} />
          </div>
        </section>
      </section>
      <section className='bg-white'>
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

