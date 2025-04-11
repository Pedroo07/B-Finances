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
        <div>
            <ul className='flex justify-between bg-neutral-100 dark:bg-slate-800 border gap-20 pl-6 pr-28 py-1'>
                <li className='text-sm  text-slate-500 dark:text-slate-200  pr-8'>Description</li>
                <li className='text-sm  text-slate-500 dark:text-slate-200'>Category</li>
                <li className='text-sm  text-slate-500 dark:text-slate-200'>Date</li>
                <li className='text-sm  text-slate-500 dark:text-slate-200'>Amount</li>
            </ul>
        </div>
    )
}

export const TransactionItem: React.FC<TransactionItemProps> = ({ item, onDelete }) => {
    return (
        <li className='flex justify-between items-center p-2'>
            <p className='flex gap-4 items-center pr-8 pl-4'><FcCurrencyExchange />{item.description}</p>
            <p className='text-slate-600 dark:text-slate-300 text-sm'>{item.category}</p>
            <p className='text-slate-500 dark:text-slate-200 text-sm'>{item.date}</p>
            <p className={`text-sm pr-8 ${item.amount > 0 ? 'text-green-500' : 'text-red-500'
                }`}>{item.amount > 0 ? '+' : ''}{item.amount}</p>
            <p className='font-semibold text-slate-500 px-2'><button onClick={() => { onDelete(item.id) }}>X</button></p>
        </li>
    )
}