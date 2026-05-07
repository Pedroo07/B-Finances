"use client"
import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useSignInWithEmailAndPassword } from 'react-firebase-hooks/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'

const authErrorMessages: Record<string, string> = {
  "auth/invalid-credential": "E-mail ou senha inválidos.",
  "auth/invalid-email": "Digite um e-mail válido.",
  "auth/missing-password": "Digite sua senha.",
  "auth/too-many-requests": "Muitas tentativas. Tente novamente em instantes.",
}

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

  const handleSignIn = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (loading) return
    e.preventDefault()
    if (!email || !password) return
    try {
      await SignInWithEmailAndPassword(email.trim(), password)
    } catch (error) {
      console.error('Error signing in:', error)
    }
  }

  useEffect(() => {
    if (user) {
      router.push('/dashboard')
    }
  }, [user, router])

  const translatedError = error?.code ? authErrorMessages[error.code] ?? 'Não foi possível entrar na sua conta.' : ''

  return (
    <div className='relative flex min-h-[calc(100vh-5.5rem)] items-center justify-center px-4 py-8 sm:px-6'>
      <div className='surface-card-strong grid w-full max-w-6xl overflow-hidden lg:grid-cols-[1.1fr_0.9fr]'>
        <div className='hidden  p-10 dark:text-white lg:flex lg:flex-col lg:justify-between'>
          <div className='space-y-6'>
            <div className='flex items-center gap-4'>
              <div>
                <Image src='/Logo.png' alt='logo' width={64} height={64} className='h-16 w-16 object-contain rounded-2xl' />
              </div>
              <div>
                <h1 className='text-4xl font-semibold tracking-tight'>B Finance</h1>
                <p className='mt-2 text-sm uppercase tracking-[0.34em] text-[#94A3BB]'>Sistema financeiro</p>
              </div>
            </div>
            <div className='space-y-3'>
              <span className='inline-flex rounded-full border dark:border-white/15 dark:bg-white/10 px-4 py-2 text-sm font-medium dark:text-[#E2E8F0] backdrop-blur-sm'>
                Visual mais claro para sua rotina financeira
              </span>
              <h2 className='text-3xl font-semibold leading-tight'>
                Entre e acompanhe suas finanças com uma experiência mais moderna.
              </h2>
            </div>
          </div>
          <div className='grid gap-3 text-sm dark:text-[#CBD5E1]'>
            <p className='rounded-2xl border dark:border-white/10 dark:bg-white/5 px-4 py-4 backdrop-blur-sm'>Controle receitas, despesas e cartões em um único lugar.</p>
            <p className='rounded-2xl border dark:border-white/10 dark:bg-white/5 px-4 py-4 backdrop-blur-sm'>Visual refinado, leitura fácil e foco no que realmente importa.</p>
          </div>
        </div>
        <div className='p-6 sm:p-8 lg:p-10'>
          <div className='mb-8 flex items-center gap-4 lg:hidden'>
            <div>
              <Image src='/Logo.png' alt='logo' width={40} height={40} className='h-10 w-10 object-container rounded' />
            </div>
            <div>
              <p className='text-base font-semibold text-[#0F172A] dark:text-white'>B Finance</p>
              <p className='text-[11px] uppercase tracking-[0.28em] text-[#94A3BB]'>Sistema financeiro</p>
            </div>
          </div>
          <div className='space-y-3 text-left'>
            <span className='inline-flex rounded-full border border-[#22C55E]/20 bg-[#22C55E]/10 px-4 py-2 text-sm font-medium text-[#15803D] dark:text-[#4ADE80]'>
              Acesse sua conta
            </span>
            <h2 className='text-3xl font-semibold tracking-tight text-[#0F172A] dark:text-white'>Entrar</h2>
            <p className='max-w-md text-sm leading-6 text-[#64748B] dark:text-[#94A3BB]'>
              Faça login para visualizar seu painel, acompanhar movimentações e manter sua vida financeira organizada.
            </p>
          </div>
          <div className='mt-8 flex flex-col gap-3'>
            <Input type='email' placeholder='E-mail' className='h-12' onChange={(e) => setEmail(e.target.value)} />
            <Input type='password' placeholder='Senha' className='h-12' onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className='mt-6 flex flex-col gap-4 text-left'>
            <Button onClick={handleSignIn} disabled={!password || !email} className='h-12 w-full'>Entrar</Button>
            {translatedError && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">{translatedError}</p>}
            <p className='text-sm text-[#64748B] dark:text-[#94A3BB]'>
              Ainda não tem uma conta? <Link href='/register' className='font-semibold text-[#15803D] underline-offset-4 hover:underline dark:text-[#4ADE80]'>Cadastre-se agora</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
