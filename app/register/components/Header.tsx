import Image from 'next/image'
import React from 'react'
import  ThemeToggle  from '../../ThemeToggle';

const Header = () => {
  return (
    <div className='w-full h-12  flex items-center justify-around border-b-2 bg-white dark:bg-slate-700 border-none'>
        <div><Image src='/Logo.png' alt='logo' width={120} height={120} className='dark:invert'/></div>
        <div>
            <ul className='flex gap-1'>
                <li className='text-xl'><ThemeToggle/></li>
            </ul>
        </div>
    </div>
  )
}

export default Header