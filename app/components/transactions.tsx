import React from 'react'
import { FcCurrencyExchange } from 'react-icons/fc'

export type Item = {
    id: string
    description: string
    date: string
    amount: number
    category: string
}

type TransactionItemProps = {
    item: Item
    onDelete: (id: string) => void
}

export const TransactionHeader = () => {
    return (
        <div className="w-full">
      <ul className="grid grid-cols-5 bg-neutral-100 dark:bg-slate-800 border px-4 py-2 text-sm text-slate-500 dark:text-slate-200 font-medium">
        <li className="col-span-2">Description</li>
        <li>Category</li>
        <li>Date</li>
        <li>Amount</li>
      </ul>
    </div>
    )
}

export const TransactionItem: React.FC<TransactionItemProps> = ({ item, onDelete }) => {
    return (
        <li className="w-full">
        <div className="grid grid-cols-5 items-center p-2 gap-2 text-sm">
          <p className="col-span-2 flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <FcCurrencyExchange />
            {item.description}
          </p>
          <p className="text-slate-600 dark:text-slate-300">{item.category}</p>
          <p className="text-slate-500 dark:text-slate-200">{item.date}</p>
          <div className="flex justify-between items-center">
            <span className={`${item.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {item.amount > 0 ? '+' : ''}
              {item.amount}
            </span>
            <button
              onClick={() => onDelete(item.id)}
              className="ml-2 text-slate-500 dark:text-slate-300 font-semibold"
            >
              X
            </button>
          </div>
        </div>
      </li>
    )
}