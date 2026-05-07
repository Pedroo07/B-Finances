'use client'
import React from 'react'
import { MoonStar, SunMedium } from 'lucide-react'

import { useTheme } from 'next-themes'

const ThemeToggle = () => {
    const { resolvedTheme, setTheme } = useTheme()

    if (!resolvedTheme) return null

    const isDarkMode = resolvedTheme === 'dark'

    const toggleTheme = () => {
        setTheme(isDarkMode ? 'light' : 'dark')
    }

    return (
        <button
            onClick={toggleTheme}
            className='flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/80 text-[#334155] shadow-[0_10px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-all hover:scale-[1.02] hover:border-[#22C55E]/40 hover:text-[#22C55E] dark:bg-white/5 dark:text-[#E2E8F0] dark:hover:text-[#22C55E]'
            aria-label={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
            title={isDarkMode ? 'Ativar modo claro' : 'Ativar modo escuro'}
        >
            {isDarkMode ? <SunMedium className='h-5 w-5' /> : <MoonStar className='h-5 w-5' />}
        </button>
    )
}

export default ThemeToggle
