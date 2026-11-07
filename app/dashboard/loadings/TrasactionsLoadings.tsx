import { Skeleton } from "@/components/ui/skeleton";

export const TransactionsLoadings = () => {
  return (
    <li className="w-full">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 md:grid md:grid-cols-5 md:items-center md:gap-3 md:px-5 md:py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 md:col-span-2">
          <Skeleton className="h-9 w-9 shrink-0 rounded-2xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-28 sm:w-32" />
            <Skeleton className="h-3 w-36 md:hidden" />
          </div>
        </div>
        <Skeleton className="hidden h-4 w-20 md:block" />
        <Skeleton className="hidden h-4 w-24 md:block" />
        <div className="flex shrink-0 items-center gap-2.5 md:justify-start">
          <Skeleton className="h-4 w-16 sm:w-20" />
          <Skeleton className="h-8 w-8 rounded-full md:hidden" />
        </div>
      </div>
    </li>
  );
};
