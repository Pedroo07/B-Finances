import React from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const ValuesLoadings = () => {
  return (
    <div className="surface-card flex flex-col justify-between gap-3 p-4 sm:p-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#94A3BB] sm:text-xs sm:tracking-[0.22em]">
          Saldo
        </p>
        <Skeleton className="mt-2 h-6 w-24 sm:mt-3 sm:h-8 sm:w-40" />
      </div>
      <div className="flex w-fit items-center rounded-full border border-border/60 px-2.5 py-1 text-center sm:px-3 sm:py-2">
        <Skeleton className="h-3.5 w-10 sm:h-4 sm:w-12" />
      </div>
    </div>
  );
};
