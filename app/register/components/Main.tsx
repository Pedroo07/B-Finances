import React, { useState } from 'react'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useCreateUserWithEmailAndPassword } from 'react-firebase-hooks/auth'
import { auth } from '@/lib/firebase'
import { toast } from 'sonner'

export const Main = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState('')
  const [
    createUserWithEmailAndPassword,
    user,
    loading,
    error
  ] = useCreateUserWithEmailAndPassword(auth)

  const handleSignIn = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/ 

    if (!email || !password) {
      setLocalError("Email and password are required.")
      return
    }

    if (!emailRegex.test(email)) {
      setLocalError('Please enter a valid email address.')
      return
    }

    if (password.length < 6) {
      setLocalError("Password must be at least 6 characters.")
      return
    }
    try{
      await createUserWithEmailAndPassword(email.trim(), password)
      toast.success('Regsiter is sucessfull')

    }
    catch{
      toast.error((error?.message || 'error registering'))
    }
  }
  return (
    <div className='flex items-center justify-center flex-col h-screen gap-4 text-center w-[380px] mx-auto' >
      <div>
        <Image src='/Logo.png' alt='logo' width={380} height={300} className='dark:invert' />
        <h2 className='text-lg font-medium dark:text-white '>Create your account and take control of your finances.</h2>
      </div>
      <div className='w-full flex flex-col gap-1'>
        <Input type='email' placeholder='Email' className='h-12' onChange={(e) => setEmail(e.target.value)} />
        <Input type='password' placeholder='Password' className='h-12' onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div className='flex  flex-col gap-4'>
        <Button onClick={handleSignIn} disabled={!email || !password}>{loading && (
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-4 border-t-transparent border-blue-500 rounded-full animate-spin"></div>
            </div>
          )}
          {!loading ? 'Register' : ''}</Button>
        {localError && (
          <p className="text-red-500 text-sm">{localError}</p>
        )}
        <p>Already have an account? <Link href='/login' className='underline text-slate-700 dark:text-slate-400'>Log in now</Link>!</p>
      </div>
    </div>
  )
}