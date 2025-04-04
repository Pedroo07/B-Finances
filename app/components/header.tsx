import Image from 'next/image'
import Link from 'next/link';
import React from 'react'
import { CiSettings } from "react-icons/ci";
import { IoIosNotificationsOutline } from "react-icons/io";
import  ThemeToggle  from '../ThemeToggle';

const Header = () => {
  return (
    <div className='w-full h-12  flex items-center justify-around border-b-2 bg-white dark:bg-slate-700 border-none'>
        <div><Image src='/Logo.png' alt='logo' width={120} height={120} className='dark:invert'/></div>
        <div>
            <ul className='flex items-center gap-2 font-Inter'>
                <li className='text-sm font-semibold text-slate-400 active:text-blue-400 cursor-pointer'><Link href="/">Overview</Link></li>
                <li className='text-sm font-semibold text-slate-400 active:text-blue-400 cursor-pointer'><Link href="/transactions">Transactions</Link></li>
                <li className='text-sm font-semibold text-slate-400 active:text-blue-400 cursor-pointer'><Link href='/CreditCard'>Credid cards</Link></li>
            </ul>
        </div>
        <div>
            <ul className='flex gap-1'>
                <li className='text-xl'><CiSettings /></li>
                <li className='text-xl'><IoIosNotificationsOutline /></li>
                <li className='text-xl'><ThemeToggle/></li>
            </ul>
        </div>
    </div>
  )
}

export default Header