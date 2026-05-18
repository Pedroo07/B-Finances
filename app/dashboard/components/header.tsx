import Image from 'next/image'
import Link from 'next/link';
import React from 'react'
import  ThemeToggle  from '../../ThemeToggle';
import { AccountMenu } from '@/app/AccountMenu';

const Header = () => {
  return (
    <header className='sticky top-0 z-40 border-b soft-divider bg-[#F8FAFC]/75 backdrop-blur-xl dark:bg-[#0F172A]/80'>
        <div className='mx-auto flex max-w-screen-xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between'>
            <div className='flex items-center justify-between gap-4'>
                <div className='flex items-center gap-3'>
                    <div>
                        <Image src='/Logo.png' alt='logo' width={42} height={42} className='h-10 w-10 object-contain rounded-xl' />
                    </div>
                    <div>
                        <p className='text-base font-semibold text-[#0F172A] dark:text-white'>B Finance</p>
                        <p className='text-[11px] uppercase tracking-[0.28em] text-[#94A3BB]'>Sistema financeiro</p>
                    </div>
                </div>
                <div className='flex items-center gap-2 lg:hidden'>
                    <ThemeToggle />
                    <AccountMenu />
                </div>
            </div>
            <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6'>
                <ul className='flex flex-wrap items-center gap-2 font-Inter'>
                    <li><Link href="/dashboard" className='surface-chip inline-flex items-center px-4 py-2'>Visão geral</Link></li>
                    <li><Link href="/transactions" className='surface-chip inline-flex items-center px-4 py-2'>Transações</Link></li>
                    <li><Link href="/investments" className='surface-chip inline-flex items-center px-4 py-2'>Investimentos</Link></li>
                    <li><Link href='/CreditCard' className='surface-chip inline-flex items-center px-4 py-2'>Cartões</Link></li>
                </ul>
                <div className='hidden lg:block'>
                    <ul className='flex gap-2 items-center'>
                        <li className='text-xl'><ThemeToggle/></li>
                        <li className='text-xl'><AccountMenu /></li>
                    </ul>
                </div>
            </div>
        </div>
    </header>
  )
}

export default Header
