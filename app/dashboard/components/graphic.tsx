import dynamic from 'next/dynamic';
const Chart = dynamic (() => import( "react-apexcharts"), {ssr: false} )
import { FC, useEffect, useState } from "react"
import { BiHome, BiGroup} from "react-icons/bi"
import { IoFastFood } from "react-icons/io5";
import { RiMoneyDollarCircleLine } from "react-icons/ri";

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

    const [chartData, setChartData] = useState({
        options: {
            plotOptions: {
                pie: {
                    customScale,
                    donut: { size: '60%' }
                }
            },
            labels: results.chartData.map((item) => item.category),
            dataLabels: {
                enabled: false
            }
        },
        series: results.chartData.map((item) => Math.abs(item.value))
    })

    useEffect(() => {
        setChartData({
            options: {
                plotOptions: {
                    pie: {
                        customScale,
                        donut: { size: '60%' }
                    }
                },
                labels: results.chartData.map((item) => item.category),
                dataLabels: {
                    enabled: false
                }
            },
            series: results.chartData.map((item) => Math.abs(item.value))
        })
    }, [results, customScale])
    return (
        <Chart options={chartData.options} series={chartData.series} type='donut' width={380} />
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
                    <p className='flex items-center gap-2 capitalize' >{(item.category === "fixes") ? (<BiHome className='size-6 bg-blue-500 rounded-xl fill-white p-1' />) : item.category === "entertainment" ? <BiGroup className='size-6 bg-blue-500 rounded-xl fill-white p-1' /> : item.category === "foods" ? <IoFastFood className='size-6 bg-blue-500 rounded-xl text-white p-1' /> : <RiMoneyDollarCircleLine className='size-6 bg-blue-500 rounded-xl text-white p-1' />}{item.category}</p>
                    <p>{(Math.abs(item.value)).toFixed(2)}%</p>
                </li>
            ))}
        </ul>
    )

} 