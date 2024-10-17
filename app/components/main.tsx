import React from 'react'
import { CiCalendarDate } from "react-icons/ci";
import { IoIosArrowRoundUp, IoIosArrowRoundDown } from "react-icons/io";
import { FiMinusCircle, FiPlusCircle } from "react-icons/fi";
import { BiTransfer } from "react-icons/bi";
import { FcCurrencyExchange } from "react-icons/fc";

export const Main = () => {
    return (
        <div>
            <section>
                <div className='flex justify-around items-center py-12'>
                    <h1 className='font-semibold text-2xl'>Hello!</h1>
                    <ul className='flex text-xs font-semibold divide-x-reverse '>
                        <li className='border text-slate-600 active:text-blue-400 p-2 bg-white rounded-s-sm'><button>This month</button></li>
                        <li className='border text-slate-600 active:text-blue-400 p-2 bg-white'><button>Last month</button></li>
                        <li className='border text-slate-600 active:text-blue-400 p-2 bg-white rounded-e-sm'><button>This year</button></li>
                        <li className='flex border text-slate-600 active:text-blue-400 p-2 bg-white items-center gap-0.5 rounded mx-2'><CiCalendarDate className='text-sm' /><button>Select period</button></li>

                    </ul>
                </div>
                <div className='grid grid-flow-col grid-rows-2 grid-cols-3 gap-8 mx-auto max-w-screen-xl items-center'>
                    <div className='bg-white flex justify-between p-6 rounded-lg border items-end shadow-md'>
                        <div>
                            <p className='text-xs text-slate-400'>Balance</p>
                            <h2 className='text-4xl font-semibold text-blue-600'>$5,000</h2>
                        </div>
                        <div className='border flex items-center text-center rounded-sm max-h-3 p-2.5 font-semibold tracking-wider shadow-md'>
                            <p className='text-sm flex items-center'><IoIosArrowRoundUp className='text-green-500 text-lg' />12%</p>
                        </div>
                    </div>
                    <div className='bg-white border shadow-md rounded-lg flex items-center gap-4 p-4'>
                        <div className='bg-green-200 rounded-md p-3 text-green-700 '><FiPlusCircle className='text-xl' /></div>
                        <div>
                            <p className='font-semibold'>Add income</p>
                            <p className='text-sm text-slate-500'>Create an income manually</p>
                        </div>
                    </div>
                    <div className='bg-white flex justify-between p-6 rounded-lg border items-end shadow-md'>
                        <div>
                            <p className='text-xs text-slate-400'>Incomes</p>
                            <h2 className='text-4xl font-semibold '>$9,000</h2>
                        </div>
                        <div className='border flex items-center text-center rounded-sm max-h-3 p-2.5 font-semibold tracking-wider shadow-md'>
                            <p className='text-sm flex items-center'><IoIosArrowRoundUp className='text-green-500 text-lg' />27%</p>
                        </div>
                    </div>
                    <div className='bg-white border shadow-md rounded-lg flex items-center gap-4 p-4'>
                        <div className='bg-red-200 rounded-md p-3 text-red-700'><FiMinusCircle className='text-xl' /></div>
                        <div>
                            <p className='font-semibold'>Add expense</p>
                            <p className='text-sm text-slate-500'>Create an expense manually</p>
                        </div>
                    </div>
                    <div className='bg-white flex justify-between p-6 rounded-lg border items-end shadow-md'>
                        <div>
                            <p className='text-xs text-slate-400'>Expenses</p>
                            <h2 className='text-4xl font-semibold '>$3,000</h2>
                        </div>
                        <div className='border flex items-center text-center rounded-sm max-h-3 p-2.5 font-semibold tracking-wider shadow-md'>
                            <p className='text-sm flex items-center'><IoIosArrowRoundDown className='text-red-500 text-lg' />-15%</p>
                        </div>
                    </div>
                    <div className='bg-white border shadow-md rounded-lg flex items-center gap-4 p-4'>
                        <div className='bg-slate-200 rounded-md p-3 text-blue-700 '><BiTransfer className='text-xl' /></div>
                        <div>
                            <p className='font-semibold'>Tranfer money</p>
                            <p className='text-sm text-slate-500'>Select the amount and make a transfer</p>
                        </div>
                    </div>
                </div>
            </section>
            <div className='flex justify-center'>
                <section></section>
                <section className='bg-white'>
                    <header className='p-4 border rounded-t-lg'>
                        <h4 className='font-semibold text-lg'>Last transactions</h4>
                        <p className='text-sm font-semibold text-slate-400'>Check your last transactions</p>
                    </header>
                    <main>
                        <div>
                            <ul className='flex justify-between bg-neutral-100 border gap-20 pl-6 pr-20'>
                                <li className='text-sm font-medium text-slate-500  pr-8'>Description</li>
                                <li className='text-sm font-medium text-slate-500'>Method</li>
                                <li className='text-sm font-medium text-slate-500'>Date</li>
                                <li className='text-sm font-medium text-slate-500'>Amount</li>
                            </ul>
                        </div>
                        <div className='border rounded-b-lg '>
                            <ul className='divide-y'>
                                <li className='flex justify-between items-center p-2'>
                                    <p className='flex gap-4 items-center pr-8 pl-4'><FcCurrencyExchange />Netflix</p>
                                    <p className='text-slate-500 text-sm'>Credit Card</p>
                                    <p className='text-slate-500 text-sm'>2024/10/16</p>
                                    <p className='text-sm'>-9.90</p>
                                    <p className='rotate-90 font-semibold text-slate-500'><button>...</button></p>
                                </li>
                                <li className='flex justify-between items-center p-2'>
                                    <p className='flex gap-4 items-center pr-8 pl-4'><FcCurrencyExchange />Netflix</p>
                                    <p className='text-slate-500 text-sm'>Credit Card</p>
                                    <p className='text-slate-500 text-sm'>2024/10/16</p>
                                    <p className='text-sm'>-9.90</p>
                                    <p className='rotate-90 font-semibold text-slate-500'><button>...</button></p>
                                </li>
                                <li className='flex justify-between items-center p-2'>
                                    <p className='flex gap-4 items-center pr-8 pl-4'><FcCurrencyExchange />Netflix</p>
                                    <p className='text-slate-500 text-sm'>Credit Card</p>
                                    <p className='text-slate-500 text-sm'>2024/10/16</p>
                                    <p className='text-sm'>-9.90</p>
                                    <p className='rotate-90 font-semibold text-slate-500'><button>...</button></p>
                                </li>
                                <li className='flex justify-between items-center p-2'>
                                    <p className='flex gap-4 items-center pr-8 pl-4'><FcCurrencyExchange />Netflix</p>
                                    <p className='text-slate-500 text-sm'>Credit Card</p>
                                    <p className='text-slate-500 text-sm'>2024/10/16</p>
                                    <p className='text-sm'>-9.90</p>
                                    <p className='rotate-90 font-semibold text-slate-500'><button>...</button></p>
                                </li>
                                <li className='flex justify-between items-center p-2'>
                                    <p className='flex gap-4 items-center pr-8 pl-4'><FcCurrencyExchange />Netflix</p>
                                    <p className='text-slate-500 text-sm'>Credit Card</p>
                                    <p className='text-slate-500 text-sm'>2024/10/16</p>
                                    <p className='text-sm'>-9.90</p>
                                    <p className='rotate-90 font-semibold text-slate-500'><button>...</button></p>
                                </li>
                                <li className='flex justify-between items-center p-2'>
                                    <p className='flex gap-4 items-center pr-8 pl-4'><FcCurrencyExchange />Netflix</p>
                                    <p className='text-slate-500 text-sm'>Credit Card</p>
                                    <p className='text-slate-500 text-sm'>2024/10/16</p>
                                    <p className='text-sm'>-9.90</p>
                                    <p className='rotate-90 font-semibold text-slate-500'><button>...</button></p>
                                </li>
                                <li className='flex justify-between items-center p-2'>
                                    <p className='flex gap-4 items-center pr-8 pl-4'><FcCurrencyExchange />Netflix</p>
                                    <p className='text-slate-500 text-sm'>Credit Card</p>
                                    <p className='text-slate-500 text-sm'>2024/10/16</p>
                                    <p className='text-sm'>-9.90</p>
                                    <p className='rotate-90 font-semibold text-slate-500'><button>...</button></p>
                                </li>
                                
                            </ul>
                        </div>
                    </main>
                </section>
            </div>
        </div>
    )
}

