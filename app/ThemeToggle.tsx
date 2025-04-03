'use client'
import React, { useEffect, useState } from 'react'

 const ThemeToggle = () => {
    const date = new Date()
    const hoursUtc = date.getHours()

    const [isDarkMode, setIsDarkMode] = useState((hoursUtc >= 18 || hoursUtc <= 5) ? true : false)

    const toggleTheme = () => {
        setIsDarkMode(!isDarkMode)
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
