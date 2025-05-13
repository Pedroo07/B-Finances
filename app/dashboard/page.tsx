"use client"
import React, { useEffect } from 'react'
import Header from './components/header'
import { Main } from "./components/main"
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'

const Dashboard = () => {
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

export default Dashboard