"use client"
import React, { useEffect } from 'react'
import Header from '../dashboard/components/header'
import { Main } from "./components/main"
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'

const Transactions = () => {
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
      <Header></Header>
      <Main></Main>
    </div>
  )
}

export default Transactions