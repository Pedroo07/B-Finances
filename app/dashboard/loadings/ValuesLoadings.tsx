import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export const ValuesLoadings = () => {
    return (
        <div className='bg-white flex justify-between p-6 rounded-lg border items-end shadow-md dark:bg-slate-700 '>
            <div>
                <p className='text-xs text-slate-400 dark:text-slate-200'>Balance</p>
                <Skeleton className='w-48 h-6' />
            </div>
            <div className='border flex items-center text-center rounded-sm max-h-3 p-2.5 font-semibold tracking-wider shadow-md'>
                <Skeleton className='w-3 h-1' />
            </div>
        </div>
    )
}
