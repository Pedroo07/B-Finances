import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"


type PeriodProps = {
    selectedMonth: number,
    onMonthChange: (month: number) => void
}

const Period: React.FC<PeriodProps> = ({ onMonthChange, selectedMonth }) => {

    return (

        <ul className='flex text-sm font-semibold divide-x'>
            <li className='border p-2 bg-white text-slate-600'><button>Last Month</button></li>
            <li className='border p-2 bg-white text-slate-600'><button>This Month</button></li>
            <li>
                <Select name='Choose the Month' value={String(selectedMonth)} onValueChange={(value) => onMonthChange(Number(value))}  >
                    <SelectTrigger className='bg-white text-slate-600 rounded-none p-2'>
                        <SelectValue placeholder='Choose the Month' />
                    </SelectTrigger>
                    <SelectContent >
                        {Array.from({ length: 12 }, (_, i) => (
                            <SelectItem key={i + 1} value={String(i + 1)}>
                                {new Date(0, i).toLocaleString("pt-BR", { month: "long" })}
                            </SelectItem>
                        ))}

                    </SelectContent>
                </Select>
            </li>
        </ul>
    )
}

export default Period