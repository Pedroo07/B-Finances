import type { LucideIcon } from 'lucide-react'
import type { IconType } from 'react-icons'
import { MdPix } from 'react-icons/md'
import {
  ArrowRightLeft,
  Banknote,
  BriefcaseBusiness,
  BusFront,
  CalendarSync,
  CircleDollarSign,
  CreditCard,
  FileClock,
  HandCoins,
  House,
  PackageCheck,
  PartyPopper,
  ReceiptText,
  Shapes,
  ShoppingBag,
  Utensils,
  WalletCards,
} from 'lucide-react'
import { cn, translatePaymentMethod } from '@/lib/utils'

type TransactionIcon = LucideIcon | IconType

const creditCardIcon: TransactionIcon = WalletCards

const categoryIcons: Record<string, { icon: TransactionIcon; className: string }> = {
  salary: {
    icon: BriefcaseBusiness,
    className: 'bg-emerald-500/12 text-emerald-600 dark:bg-emerald-500/18 dark:text-emerald-400',
  },
  extra: {
    icon: CircleDollarSign,
    className: 'bg-cyan-500/12 text-cyan-600 dark:bg-cyan-500/18 dark:text-cyan-400',
  },
  fixes: {
    icon: ReceiptText,
    className: 'bg-amber-500/12 text-amber-600 dark:bg-amber-500/18 dark:text-amber-400',
  },
  contas: {
    icon: FileClock,
    className: 'bg-yellow-500/12 text-yellow-700 dark:bg-yellow-500/18 dark:text-yellow-400',
  },
  'Credit Card': {
    icon: creditCardIcon,
    className: 'bg-indigo-500/12 text-indigo-600 dark:bg-indigo-500/18 dark:text-indigo-400',
  },
  credit_card: {
    icon: creditCardIcon,
    className: 'bg-indigo-500/12 text-indigo-600 dark:bg-indigo-500/18 dark:text-indigo-400',
  },
  foods: {
    icon: Utensils,
    className: 'bg-orange-500/12 text-orange-600 dark:bg-orange-500/18 dark:text-orange-400',
  },
  housing: {
    icon: House,
    className: 'bg-blue-500/12 text-blue-600 dark:bg-blue-500/18 dark:text-blue-400',
  },
  transport: {
    icon: BusFront,
    className: 'bg-sky-500/12 text-sky-600 dark:bg-sky-500/18 dark:text-sky-400',
  },
  delivery: {
    icon: PackageCheck,
    className: 'bg-lime-500/12 text-lime-700 dark:bg-lime-500/18 dark:text-lime-400',
  },
  shopping: {
    icon: ShoppingBag,
    className: 'bg-pink-500/12 text-pink-600 dark:bg-pink-500/18 dark:text-pink-400',
  },
  subscriptions: {
    icon: CalendarSync,
    className: 'bg-purple-500/12 text-purple-600 dark:bg-purple-500/18 dark:text-purple-400',
  },
  entertainment: {
    icon: PartyPopper,
    className: 'bg-violet-500/12 text-violet-600 dark:bg-violet-500/18 dark:text-violet-400',
  },
  other: {
    icon: Shapes,
    className: 'bg-slate-500/12 text-slate-600 dark:bg-white/10 dark:text-slate-300',
  },
}

const paymentMethodIcons: Record<string, TransactionIcon> = {
  cash: Banknote,
  pix: MdPix,
  debit: CreditCard,
  credit_card: creditCardIcon,
}

type CategoryIconBadgeProps = {
  category: string
  className?: string
}

export function CategoryIconBadge({ category, className }: CategoryIconBadgeProps) {
  const config = categoryIcons[category] ?? {
    icon: ArrowRightLeft,
    className: categoryIcons.other.className,
  }
  const Icon = config.icon

  return (
    <span
      className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl', config.className, className)}
      aria-hidden="true"
    >
      <Icon className="h-4 w-4" />
    </span>
  )
}

type PaymentMethodIconBadgeProps = {
  method?: string
  isIncome: boolean
}

export function PaymentMethodIconBadge({ method, isIncome }: PaymentMethodIconBadgeProps) {
  const Icon = isIncome ? HandCoins : ((method && paymentMethodIcons[method]) || ArrowRightLeft)
  const label = isIncome ? 'Entrada' : (method ? translatePaymentMethod(method) : 'Transação')

  return (
    <span
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl',
        isIncome
          ? 'bg-[#22C55E]/12 text-[#16A34A] dark:bg-[#22C55E]/18 dark:text-[#4ADE80]'
          : 'bg-rose-500/12 text-rose-600 dark:bg-rose-500/18 dark:text-rose-300',
      )}
      title={label}
      aria-label={label}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  )
}
