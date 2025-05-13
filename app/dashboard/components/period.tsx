import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"


type PeriodProps = {
    selectedMonth: number,
    onMonthChange: (month: number) => void
}

const Period: React.FC<PeriodProps> = ({ onMonthChange, selectedMonth }) => {


    return (
            <li>
                <Select name='Choose the Month' value={String(selectedMonth)} onValueChange={(value) => onMonthChange(Number(value))}  >
                    <SelectTrigger className='bg-white text-slate-600 rounded-none p-2 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-200'>
                        <SelectValue placeholder='Choose the Month' />
                    </SelectTrigger>
                    <SelectContent >
                        {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)}>
                                {new Date(0, i).toLocaleString("en-US", { month: "long" })}
                            </SelectItem>
                        ))}

                    </SelectContent>
                </Select>
            </li>
    )
}

export default Period