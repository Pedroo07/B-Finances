import React from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"


type PeriodProps = {
    selectedMonth: number,
    onMonthChange: (month: number) => void
}

const Period: React.FC<PeriodProps> = ({ onMonthChange, selectedMonth }) => {


    return (
            <li>
                <Select name='Escolher mês' value={String(selectedMonth)} onValueChange={(value) => onMonthChange(Number(value))}  >
                    <SelectTrigger className='min-w-[170px]'>
                        <SelectValue placeholder='Escolher mês' />
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
    )
}

export default Period
