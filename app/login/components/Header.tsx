import Image from 'next/image'
import React from 'react'
import  ThemeToggle  from '../../ThemeToggle';

const Header = () => {
  return (
    <header className='sticky top-0 z-40 border-b soft-divider bg-[#F8FAFC]/75 backdrop-blur-xl dark:bg-[#0F172A]/80'>
        <div className='mx-auto flex max-w-screen-xl items-center justify-between gap-4 px-4 py-4 sm:px-6'>
            <div className='flex items-center gap-3'>
                <div >
                    <Image src='/Logo.png' alt='logo' width={40} height={40} className='h-10 w-10 object-contain rounded-xl' />
                </div>
                <div>
                    <p className='text-base font-semibold text-[#0F172A] dark:text-white'>B Finance</p>
                    <p className='text-[11px] uppercase tracking-[0.28em] text-[#94A3BB]'>Sistema financeiro</p>
                </div>
            </div>
            <ThemeToggle/>
        </div>
    </header>
  )
}

export default Header
