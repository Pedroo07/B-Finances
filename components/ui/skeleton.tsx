import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-linear-to-r from-[#94A3BB]/20 via-[#E2E8F0]/55 to-[#94A3BB]/20 dark:from-[#334155]/60 dark:via-[#1E293B]/80 dark:to-[#334155]/60", className)}
      {...props}
    />
  )
}

export { Skeleton }
