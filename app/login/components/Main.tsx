"use client"
import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useSignInWithEmailAndPassword } from 'react-firebase-hooks/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'

export const Main = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()
  const [
    SignInWithEmailAndPassword,
    user,
    loading,
    error,
  ] = useSignInWithEmailAndPassword(auth)

  const handleSignIn = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (loading) return
    e.preventDefault()
      if (!email || !password) return
      SignInWithEmailAndPassword(email.trim(), password)
  }

  useEffect(() => {
    if (user) {
      router.push('/dashboard')
    }
  }, [user, router])
  return (
    <div className='flex items-center justify-center flex-col h-screen gap-4 text-center w-[380px] mx-auto' >
      <div>
        <Image src='/Logo.png' alt='logo' width={380} height={300} className='dark:invert' />
        <h2 className='text-lg font-medium dark:text-white '>Log in to manage your finances with ease.</h2>
      </div>
      <div className='w-full flex flex-col gap-1'>
        <Input type='email' placeholder='Email' className='h-12' onChange={(e) => setEmail(e.target.value)} />
        <Input type='password' placeholder='Password' className='h-12' onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className='flex flex-col gap-4'>
        <Button onClick={handleSignIn} disabled={!password || !email}>Login</Button>
        {error?.message && <p className="text-red-500 text-sm">{error.message}</p>}
        <p>If you don’t have an account, <Link href='/register' className='underline  text-slate-700 dark:text-slate-400'>Register now</Link>!</p>
      </div>
    </div>
  )
}
