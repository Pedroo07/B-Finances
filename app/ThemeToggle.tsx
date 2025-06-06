'use client'
import React, { useEffect, useState } from 'react'

 const ThemeToggle = () => {
    const date = new Date()
    const hoursUtc = date.getHours()

    
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window === 'undefined') return false
        const storedTheme = localStorage.getItem('theme')
        if (storedTheme === 'dark') return true
        if (storedTheme === 'light') return false

        return hoursUtc >= 18 || hoursUtc < 6
    })

    const toggleTheme = () => {
        const newTheme = !isDarkMode
        setIsDarkMode(newTheme)
        localStorage.setItem('theme', newTheme ? 'dark' : 'light')
    }

    useEffect(() => {
        if(isDarkMode) {
            document.documentElement.classList.add('dark')
        }else {
            document.documentElement.classList.remove('dark')
        }

    }, [isDarkMode])
  return (
    <button
    onClick={toggleTheme}
    className='p-2 bg-gray-200 dark:bg-gray-800 rounded-lg'
    >
        {isDarkMode ? '🌙' : '☀️'}
    </button>
  )
}

export default ThemeToggle
