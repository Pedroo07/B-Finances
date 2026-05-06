import React from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export const ValuesLoadings = () => {
    return (
        <div className='surface-card flex justify-between gap-4 p-5 sm:p-6'>
            <div>
                <p className='text-xs uppercase tracking-[0.22em] text-[#94A3BB]'>Saldo</p>
                <Skeleton className='w-48 h-6' />
            </div>
            <div className='flex items-center text-center rounded-full border border-border/60 px-3 py-2'>
                <Skeleton className='h-4 w-12' />
            </div>
        </div>
    )
}
