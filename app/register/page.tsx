"use client"
import React from 'react'
import { Main } from './components/Main'
import Header from './components/Header'
import { Toaster } from 'sonner'

const Login = () => {
  return (
    <div>
      <Header />
      <Toaster richColors/>
      <Main />
    </div>
  )
}

export default Login