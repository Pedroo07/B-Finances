"use client"
import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import Header from '@/app/dashboard/components/header'
import { Main } from "./components/main"

const Accounts = () => {
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
      <Header />
      <Main />
    </div>
  )
}

export default Accounts
