"use client"
import React, { useState } from 'react'
import Image from 'next/image'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useCreateUserWithEmailAndPassword } from 'react-firebase-hooks/auth'
import { auth } from '@/lib/firebase'
import { toast } from 'sonner'

const authErrorMessages: Record<string, string> = {
  "auth/email-already-in-use": "Este e-mail já está em uso.",
  "auth/invalid-email": "Digite um e-mail válido.",
  "auth/weak-password": "A senha deve ter pelo menos 6 caracteres.",
}

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
    if (user) {
      setLocalError('Preencha os campos corretamente para continuar.')
      return
    }

    if (!email || !password) {
      setLocalError("E-mail e senha são obrigatórios.")
      return
    }

    if (!emailRegex.test(email)) {
      setLocalError('Digite um endereço de e-mail válido.')
      return
    }

    if (password.length < 6) {
      setLocalError("A senha deve ter pelo menos 6 caracteres.")
      return
    }
    await createUserWithEmailAndPassword(email.trim(), password)
    if (error) {
      toast.error(authErrorMessages[error.code] ?? 'Não foi possível concluir o cadastro.')
      return
    }
    toast.success('Cadastro realizado com sucesso.')
  }

  return (
    <div className='relative flex min-h-[calc(100vh-5.5rem)] items-center justify-center px-4 py-8 sm:px-6'>
      <div className='surface-card-strong grid w-full max-w-6xl overflow-hidden lg:grid-cols-[1.05fr_0.95fr]'>
        <div className='hidden p-10 dark:text-white lg:flex lg:flex-col lg:justify-between'>
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
                Comece com um ambiente mais elegante e intuitivo
              </span>
              <h2 className='text-3xl font-semibold leading-tight'>
                Crie sua conta e organize receitas, despesas e cartões com mais clareza.
              </h2>
            </div>
          </div>
          <div className='grid gap-3 text-sm dark:text-[#CBD5E1]'>
            <p className='rounded-2xl border dark:border-white/10 dark:bg-white/5 px-4 py-4 backdrop-blur-sm'>Uma interface mais moderna para acompanhar tudo com rapidez.</p>
            <p className='rounded-2xl border dark:border-white/10 dark:bg-white/5 px-4 py-4 backdrop-blur-sm'>Paleta refinada, leitura confortável e foco no essencial.</p>
          </div>
        </div>
        <div className='p-6 sm:p-8 lg:p-10'>
          <div className='mb-8 flex items-center gap-4 lg:hidden'>
            <div className='rounded-2xl border border-white/20 bg-white/70 p-2 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:bg-white/5'>
              <Image src='/Logo.png' alt='logo' width={40} height={40} className='h-10 w-10 object-contain dark:invert' />
            </div>
            <div>
              <p className='text-base font-semibold text-[#0F172A] dark:text-white'>B Finance</p>
              <p className='text-[11px] uppercase tracking-[0.28em] text-[#94A3BB]'>Sistema financeiro</p>
            </div>
          </div>
          <div className='space-y-3 text-left'>
            <span className='inline-flex rounded-full border border-[#22C55E]/20 bg-[#22C55E]/10 px-4 py-2 text-sm font-medium text-[#15803D] dark:text-[#4ADE80]'>
              Crie sua conta
            </span>
            <h2 className='text-3xl font-semibold tracking-tight text-[#0F172A] dark:text-white'>Cadastro</h2>
            <p className='max-w-md text-sm leading-6 text-[#64748B] dark:text-[#94A3BB]'>
              Abra sua conta para acompanhar seu financeiro em um painel moderno, organizado e pronto para o dia a dia.
            </p>
          </div>
          <div className='mt-8 flex flex-col gap-3'>
            <Input type='email' placeholder='E-mail' className='h-12' onChange={(e) => setEmail(e.target.value)} />
            <Input type='password' placeholder='Senha' className='h-12' onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className='mt-6 flex flex-col gap-4 text-left'>
            <Button onClick={handleSignIn} disabled={!email || !password} className='relative h-12 w-full'>
              {loading && (
                <div className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 transform rounded-full border-2 border-white/60 border-t-transparent animate-spin"></div>
              )}
              {!loading ? 'Criar conta' : ''}
            </Button>
            {localError && (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                {localError}
              </p>
            )}
            <p className='text-sm text-[#64748B] dark:text-[#94A3BB]'>
              Já tem uma conta? <Link href='/login' className='font-semibold text-[#15803D] underline-offset-4 hover:underline dark:text-[#4ADE80]'>Entre agora</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
