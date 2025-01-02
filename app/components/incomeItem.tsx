import { FcCurrencyExchange } from "react-icons/fc";
import { Income } from "../incomes";



export const IncomeListItem: React.FC<Income> = ({ amount, date, description, method }) => {
    return (
        <li className='flex justify-between items-center p-2' >
            <p className='flex gap-4 items-center pr-8 pl-4'><FcCurrencyExchange />{description}</p>
            <p className='text-slate-500 text-sm'>{method}</p>
            <p className='text-slate-500 text-sm'>{date}</p>
            <p className='text-sm pr-8'>{amount}</p>
            <p className='rotate-90 font-semibold text-slate-500'><button>...</button></p>
        </li >
    )
}