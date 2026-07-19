'use client'
import React from 'react'
import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem enableColorScheme={false}>
      {children}
      <Toaster richColors />
    </ThemeProvider>
  )
}
