import dynamic from 'next/dynamic';
const Chart = dynamic (() => import( "react-apexcharts"), {ssr: false} )
import { FC, useEffect, useState } from "react"
import { BiHome, BiGroup} from "react-icons/bi"
import { IoFastFood } from "react-icons/io5";
import { RiMoneyDollarCircleLine } from "react-icons/ri";
import { translateCategory } from '@/lib/utils';

 type Transaction = {
    description: string
    category: string
    date: string
    amount: number
    type?: string
}

type ChartData = {
    category: string;
    value: number;
};

type SeparateResults = {
    chartData: ChartData[];
    percentageData: ChartData[];
};

export function separateAmountByCategory(items: Transaction[]): SeparateResults {
    const totalExpenses = items.filter(item => item.amount < 0).reduce((acc, item) => acc + Math.abs(item.amount), 0)
    const expensesByCategory: Record<string, number> = {}
    items.forEach((item) => {
        if (item.amount < 0) {
            if (!expensesByCategory[item.category]) {
                expensesByCategory[item.category] = 0
            }
            expensesByCategory[item.category] += item.amount
        }
    })

    const chartData = Object.entries(expensesByCategory).map(([category, value]) => ({
        category,
        value
    }))

    const percentageData = Object.entries(expensesByCategory).map(([category, value]) => ({
        category,
        value: (value / totalExpenses) * 100
    }))
    return { chartData, percentageData }

}

type DonutChartProps = {
    results: SeparateResults
}

export const DonutChart: FC<DonutChartProps> = ({ results }) => {
    const [customScale, setCustomScale] = useState(1.0)

    useEffect(() => {
        const handleResize = () => {
            const isMobile = window.innerWidth <= 768
            setCustomScale(isMobile ? 0.8 : 1.0)
        }

        handleResize() 
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const chartData = {
        options: {
            chart: {
                toolbar: {
                    show: false
                }
            },
            colors: ["#22C55E", "#94A3BB", "#334155", "#0F172A", "#16A34A"],
            stroke: {
                width: 0
            },
            plotOptions: {
                pie: {
                    customScale,
                    donut: { size: '60%' }
                }
            },
            labels: results.chartData.map((item) => item.category),
            dataLabels: {
                enabled: false
            },
            legend: {
                show: false
            }
        },
        series: results.chartData.map((item) => Math.abs(item.value))
    }

    return (
        <div className='w-full max-w-[380px]'>
            <Chart options={chartData.options} series={chartData.series} type='donut' width="100%" />
        </div>
    )
}

type GraphicListItemProps = {
    results: SeparateResults
}

export const GraphicListItem: FC<GraphicListItemProps> = ({ results }) => {
    return (
        <ul className="divide-y p-1">
            {results.percentageData.map((item, index) => (
                <li className='flex justify-between items-center p-2' key={index}>
                    <p className='flex items-center gap-2 capitalize text-[#334155] dark:text-[#E2E8F0]' >{(item.category === "fixes") ? (<BiHome className='size-8 rounded-2xl bg-[#22C55E]/12 fill-[#16A34A] p-1.5 dark:bg-[#22C55E]/18 dark:fill-[#4ADE80]' />) : item.category === "entertainment" ? <BiGroup className='size-8 rounded-2xl bg-[#94A3BB]/20 fill-[#334155] p-1.5 dark:bg-white/10 dark:fill-[#CBD5E1]' /> : item.category === "foods" ? <IoFastFood className='size-8 rounded-2xl bg-[#22C55E]/12 p-1.5 text-[#16A34A] dark:bg-[#22C55E]/18 dark:text-[#4ADE80]' /> : <RiMoneyDollarCircleLine className='size-8 rounded-2xl bg-[#94A3BB]/20 p-1.5 text-[#334155] dark:bg-white/10 dark:text-[#CBD5E1]' />}{translateCategory(item.category)}</p>
                    <p>{(Math.abs(item.value)).toFixed(2)}%</p>
                </li>
            ))}
        </ul>
    )

} 
