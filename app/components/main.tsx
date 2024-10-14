import React from 'react'
import { CiCalendarDate } from "react-icons/ci";

export const Main = () => {
  return (
    <div>
        <section>
            <div className='flex justify-around items-center py-12 '>
                <h1 className='font-semibold text-2xl'>Hello!</h1>
                <ul className='flex text-xs font-medium divide-x-reverse '>
                    <li className='border text-slate-600 active:text-blue-400 p-1 rounded-s-sm'><button>This month</button></li>
                    <li className='border text-slate-600 active:text-blue-400 p-1'><button>Last month</button></li>
                    <li className='border text-slate-600 active:text-blue-400 p-1 rounded-e-sm'><button>This year</button></li>
                    <li className='flex border text-slate-600 active:text-blue-400 p-1 items-center gap-0.5 rounded mx-2'><CiCalendarDate className='text-sm' /><button>Select period</button></li>
                    
                </ul>
            </div>
            <div>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
                <div></div>
            </div>
        </section>
        <section></section>
        <section></section>
    </div>
  )
}

