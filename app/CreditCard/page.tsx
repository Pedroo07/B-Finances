"use client"
import React, { useEffect } from 'react'
import { Main } from './components/main'
import Header from '../dashboard/components/header'
import { onAuthStateChanged } from 'firebase/auth'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'

const Creditcard = () => {
   const router = useRouter()
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login')
      }
    })

    return () => unsubscribe()
  }, [router])
  return (
    <div>
        <Header/>
        <Main/>
    </div>
  )
}

export default Creditcard