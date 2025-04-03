import Chart from "react-apexcharts"
import { FC, useEffect, useState } from "react"
import { BiHome, BiGroup} from "react-icons/bi"
import { IoFastFood } from "react-icons/io5";
import { RiMoneyDollarCircleLine } from "react-icons/ri";

 type Transaction = {
    description: string
    method: string
    date: string
    amount: number
    type?: string
}

type ChartData = {
    method: string;
    value: number;
};

type SeparateResults = {
    chartData: ChartData[];
    percentageData: ChartData[];
};

export function separateAmountByMethod(items: Transaction[]): SeparateResults {
    const totalExpenses = items.filter(item => item.amount < 0).reduce((acc, item) => acc + Math.abs(item.amount), 0)
    const expensesByMethod: Record<string, number> = {}
    items.forEach((item) => {
        if (item.amount < 0) {
            if (!expensesByMethod[item.method]) {
                expensesByMethod[item.method] = 0
            }
            expensesByMethod[item.method] += item.amount
        }
    })

    const chartData = Object.entries(expensesByMethod).map(([method, value]) => ({
        method,
        value
    }))

    const percentageData = Object.entries(expensesByMethod).map(([method, value]) => ({
        method,
        value: (value / totalExpenses) * 100
    }))
    return { chartData, percentageData }

}

type DonutChartProps = {
    results: SeparateResults
}

export const DonutChart: FC<DonutChartProps> = ({ results }) => {
    const [chartData, setChartData] = useState({
        options: {
            labels: results.chartData.map((item) => item.method),
            dataLabels: {
                enabled: false
            },
        },
        series: results.chartData.map((item) => Math.abs(item.value))

    });
    useEffect(() => {
        setChartData({
            options: {
                labels: results.chartData.map((item) => item.method),
                dataLabels: {
                    enabled: false,
                },
            },
            series: results.chartData.map((item) => Math.abs(item.value)),
        });
    }, [results]);
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
                    <p className='flex items-center gap-2 capitalize' >{(item.method === "fixes") ? (<BiHome className='size-6 bg-blue-500 rounded-xl fill-white p-1' />) : item.method === "entertainment" ? <BiGroup className='size-6 bg-blue-500 rounded-xl fill-white p-1' /> : item.method === "foods" ? <IoFastFood className='size-6 bg-blue-500 rounded-xl text-white p-1' /> : <RiMoneyDollarCircleLine className='size-6 bg-blue-500 rounded-xl text-white p-1' />}{item.method}</p>
                    <p>{(Math.abs(item.value)).toFixed(2)}%</p>
                </li>
            ))}
        </ul>
    )

} 