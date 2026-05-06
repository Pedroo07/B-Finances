import { Skeleton } from "@/components/ui/skeleton"

export const TransactionsLoadings= () => {
    return (
        <li className="w-full">
            <div className="flex flex-col gap-3 px-4 py-4 md:grid md:grid-cols-5 md:items-center md:gap-3 md:px-5">
                <p className="col-span-2 flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-2xl" />
                    <Skeleton className="h-5 w-32" />
                </p>
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <div className="flex justify-between items-center md:justify-start">
                    <Skeleton className="h-4 w-20" />
                </div>
            </div>
      </li>
    )
}
