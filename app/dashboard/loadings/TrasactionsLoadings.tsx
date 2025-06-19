import { Skeleton } from "@/components/ui/skeleton"

export const TransactionsLoadings= () => {
    return (
        <li className="w-full">
        <div className="grid grid-cols-5 items-center p-2 gap-2 text-sm">
          <p className="col-span-2 flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <Skeleton className="w-24 h-6" />
          </p>
          <p className="text-slate-600 dark:text-slate-300"><Skeleton className="h-2 w-12"/></p>
          <p className="text-slate-500 dark:text-slate-200"><Skeleton className="h-2 w-12"/></p>
          <div className="flex justify-between items-center">
            <Skeleton className="h-2 w-12"/>
          </div>
        </div>
      </li>
    )
}