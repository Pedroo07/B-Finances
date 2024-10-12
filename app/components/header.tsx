import Image from 'next/image'
import React from 'react'
import { CiSettings } from "react-icons/ci";
import { IoIosNotificationsOutline } from "react-icons/io";

const Header = () => {
  return (
    <div className='w-full h-10  flex items-center justify-around border-b-2 bg-white'>
        <div><Image src='/Logo.png' alt='logo' width={100} height={100}/></div>
        <div>
            <ul className='flex items-center gap-2 font-Inter'>
                <li className='text-xxs font-semibold text-slate-400 active:text-blue-400 cursor-pointer'>Overview</li>
                <li className='text-xxs font-semibold text-slate-400 active:text-blue-400 cursor-pointer'>Transactions</li>
                <li className='text-xxs font-semibold text-slate-400 active:text-blue-400 cursor-pointer'>Credid cards</li>
                <li className='text-xxs font-semibold text-slate-400 active:text-blue-400 cursor-pointer'>Ivestiments</li>
            </ul>
        </div>
        <div>
            <ul className='flex gap-1'>
                <li className='text-sm'><CiSettings /></li>
                <li className='text-sm'><IoIosNotificationsOutline /></li>
            </ul>
        </div>
    </div>
  )
}

export default Header