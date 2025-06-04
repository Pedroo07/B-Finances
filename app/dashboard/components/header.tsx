import Image from 'next/image'
import Link from 'next/link';
import React from 'react'
import  ThemeToggle  from '../../ThemeToggle';
import { AccountMenu } from '@/app/AccountMenu';

const Header = () => {
  return (
    <div className='w-full h-12  flex items-center justify-around border-b-2 bg-white dark:bg-slate-700 border-none'>
        <div><Image src='/Logo.png' alt='logo' width={140} height={120} className='dark:invert'/></div>
        <div>
            <ul className='flex items-center gap-2 font-Inter'>
                <li className='text-sm font-semibold text-slate-400 active:text-blue-400 cursor-pointer'><Link href="/dashboard">Overview</Link></li>
                <li className='text-sm font-semibold text-slate-400 active:text-blue-400 cursor-pointer'><Link href="/transactions">Transactions</Link></li>
                <li className='text-sm font-semibold text-slate-400 active:text-blue-400 cursor-pointer'><Link href='/CreditCard'>Credid cards</Link></li>
            </ul>
        </div>
        <div>
            <ul className='flex gap-1 items-center'>
                <li className='text-xl'><ThemeToggle/></li>
                <li className='text-xl'><AccountMenu /></li>
            </ul>
        </div>
    </div>
  )
}

export default Header