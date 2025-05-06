/* eslint-disable react/no-unescaped-entities */
import React from 'react'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export const Main = () => {
  return (
    <div className='flex items-center justify-center flex-col h-screen gap-4 text-center w-[380px] mx-auto' >
      <div>
        <Image src='/Logo.png' alt='logo' width={380} height={300} className='dark:invert' />
        <h2 className='text-lg font-medium dark:text-white '>Log in to manage your finances with ease.</h2>
      </div>
      <div className='w-full flex flex-col gap-1'>
        <Input type='email' placeholder='Email' className='h-12' />
        <Input type='password' placeholder='Password' className='h-12' />
      </div>
      <div className='flex  flex-col gap-4'>
        <Button>Login</Button>
        <p>"If you don’t have an account, <Link href='/register' className='underline  text-slate-700 dark:text-slate-300'>register now</Link>!"</p>
      </div>
    </div>
  )
}
