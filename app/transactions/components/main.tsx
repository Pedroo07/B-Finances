"use client"
import { useEffect, useState } from 'react'
import { TransactionHeader, TransactionItem } from "@/app/dashboard/components/transactions"
import { DonutChart, GraphicListItem } from "@/app/dashboard/components/graphic"
import Period from '@/app/dashboard/components/period'
import { getTransaction } from '@/lib/services/transactions'
import { Transaction } from '@/lib/entities/transaction'
import { useAuthState } from 'react-firebase-hooks/auth'
import { auth } from '@/lib/firebase'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { Skeleton } from '@/components/ui/skeleton'
import { TransactionsLoadings } from '@/app/dashboard/loadings/TrasactionsLoadings'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { translateCategory } from '@/lib/utils'

type TransactionTypeFilter = 'all' | 'income' | 'expense'

type CategoryResult = {
  category: string
  value: number
}

type CategoryResults = {
  chartData: CategoryResult[]
  percentageData: CategoryResult[]
}

const sortItemByDate = (currentItems: Transaction[]): Transaction[] => {
  return [...currentItems].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

const separateAmountByCategoryAndType = (
  currentItems: Transaction[],
  selectedTransactionType: TransactionTypeFilter
): CategoryResults => {
  const totalsByCategory: Record<string, number> = {}
  let totalAmount = 0

  currentItems.forEach((item) => {
    const isIncome = item.amount > 0

    if (selectedTransactionType === 'income' && !isIncome) {
      return
    }

    if (selectedTransactionType === 'expense' && isIncome) {
      return
    }

    const absoluteAmount = Math.abs(item.amount)

    if (!absoluteAmount) {
      return
    }

    totalsByCategory[item.category] = (totalsByCategory[item.category] ?? 0) + absoluteAmount
    totalAmount += absoluteAmount
  })

  const chartData = Object.entries(totalsByCategory).map(([category, value]) => ({
    category,
    value,
  }))

  const percentageData = totalAmount > 0
    ? chartData.map((item) => ({
      category: item.category,
      value: (item.value / totalAmount) * 100,
    }))
    : []

  return { chartData, percentageData }
}

export const Main = () => {
  const [user, loading] = useAuthState(auth)
  const [items, setItems] = useState<Transaction[]>([])
  const handleDeleteItem = () => { }

  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1)
  const [activeFilter, setActiveFilter] = useState<'month' | 'last-month' | 'year'>('month')
  const [selectedTransactionType, setSelectedTransactionType] = useState<TransactionTypeFilter>('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    if (loading || !user || typeof window === 'undefined') return

    let isMounted = true

    const fetchItems = async () => {
      try {
        const itemsOnStorage = await getTransaction() || []
        if (isMounted) {
          setItems(sortItemByDate(itemsOnStorage))
        }
      } catch (error) {
        console.error("error parsing 'items'", error)
      }
    }

    void fetchItems()

    return () => {
      isMounted = false
    }
  }, [loading, user])

  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()
  const previousMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
  const normalizedStartDate = startDate && endDate && startDate > endDate ? endDate : startDate
  const normalizedEndDate = startDate && endDate && startDate > endDate ? startDate : endDate
  const hasCustomDateRange = Boolean(startDate || endDate)

  const periodFilteredItems = items.filter((item) => {
    if (hasCustomDateRange) {
      if (normalizedStartDate && item.date < normalizedStartDate) {
        return false
      }

      if (normalizedEndDate && item.date > normalizedEndDate) {
        return false
      }

      return true
    }

    const [year, month] = item.date.split('-').map(Number)

    if (activeFilter === 'year') {
      return year === currentYear
    }

    if (activeFilter === 'last-month') {
      return year === previousMonthDate.getFullYear() && month === previousMonthDate.getMonth() + 1
    }

    return year === currentYear && month === selectedMonth
  })

  const typeFilteredItems = periodFilteredItems.filter((item) => {
    if (selectedTransactionType === 'income') {
      return item.amount > 0
    }

    if (selectedTransactionType === 'expense') {
      return item.amount < 0
    }

    return true
  })

  const availableCategories = Array.from(
    new Set(typeFilteredItems.map((item) => item.category))
  ).sort((firstCategory, secondCategory) => (
    translateCategory(firstCategory).localeCompare(translateCategory(secondCategory), 'pt-BR')
  ))

  const currentSelectedCategory = (
    selectedCategory === 'all' || availableCategories.includes(selectedCategory)
  )
    ? selectedCategory
    : 'all'

  const filterItems = sortItemByDate(typeFilteredItems.filter((item) => {
    if (currentSelectedCategory === 'all') {
      return true
    }

    return item.category === currentSelectedCategory
  }))

  const thisMonthSelected = () => {
    setActiveFilter('month')
    setSelectedMonth(currentDate.getMonth() + 1)
  }

  const lastMonthSelected = () => {
    setActiveFilter('last-month')
    setSelectedMonth(previousMonthDate.getMonth() + 1)
  }

  const lastYearFilter = () => {
    setActiveFilter('year')
  }

  const handleMonthChange = (month: number) => {
    setActiveFilter('month')
    setSelectedMonth(month)
  }

  const clearExtraFilters = () => {
    setSelectedTransactionType('all')
    setSelectedCategory('all')
    setStartDate('')
    setEndDate('')
  }

  const results = separateAmountByCategoryAndType(filterItems, selectedTransactionType)
  const filterButtonClass = 'surface-chip inline-flex items-center px-4 py-2'
  const hasExtraFilters = (
    selectedTransactionType !== 'all' ||
    currentSelectedCategory !== 'all' ||
    Boolean(startDate) ||
    Boolean(endDate)
  )

  const chartTitle = selectedTransactionType === 'income'
    ? 'Receitas por categoria'
    : selectedTransactionType === 'expense'
      ? 'Despesas por categoria'
      : 'Transações por categoria'

  const chartDescription = selectedTransactionType === 'income'
    ? 'Entenda rapidamente a distribuicao das entradas por categoria.'
    : selectedTransactionType === 'expense'
      ? 'Entenda rapidamente a distribuição das saidas por categoria.'
      : 'Entenda rapidamente a distribuição das suas transações por categoria.'

  const emptyChartMessage = selectedTransactionType === 'income'
    ? 'Nenhuma receita encontrada para os filtros selecionados.'
    : selectedTransactionType === 'expense'
      ? 'Nenhuma despesa encontrada para os filtros selecionados.'
      : 'Nenhuma transação encontrada para os filtros selecionados.'

  return (
    <div className='mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 xl:flex-row xl:items-stretch'>
      <section className="flex w-full flex-col gap-6 xl:w-90 xl:flex-none">
        <div className="surface-card p-6">
          <div className='space-y-2'>
            <span className='inline-flex rounded-full border border-[#22C55E]/20 bg-[#22C55E]/10 px-4 py-2 text-sm font-medium text-[#15803D] dark:text-[#4ADE80]'>
              Historico financeiro
            </span>
            <h1 className='text-3xl font-semibold tracking-tight text-[#0F172A] dark:text-white'>Transações</h1>
            <p className='text-sm leading-6 text-[#64748B] dark:text-[#94A3BB]'>
              Filtre seu historico e acompanhe a distribuição das transações por categoria.
            </p>
          </div>
          <ul className='mt-6 flex flex-wrap gap-2'>
            <li><button className={filterButtonClass} onClick={lastYearFilter}>Ultimo ano</button></li>
            <li><button className={filterButtonClass} onClick={lastMonthSelected}>Ultimo mes</button></li>
            <li><button className={filterButtonClass} onClick={thisMonthSelected}>Este mes</button></li>
            <Period onMonthChange={handleMonthChange} selectedMonth={selectedMonth} />
          </ul>
          <div className='mt-6 space-y-3'>
            <div className='grid gap-2 md:grid-cols-2'>
              <Select value={selectedTransactionType} onValueChange={(value) => setSelectedTransactionType(value as TransactionTypeFilter)}>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Tipo da transação' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Todas</SelectItem>
                  <SelectItem value='expense'>Despesas</SelectItem>
                  <SelectItem value='income'>Receitas</SelectItem>
                </SelectContent>
              </Select>
              <Select value={currentSelectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='Categoria' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>Todas as categorias</SelectItem>
                  {availableCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {translateCategory(category)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type='date'
                aria-label='Data inicial'
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
              <Input
                type='date'
                aria-label='Data final'
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
            <div className='flex flex-wrap items-center gap-3'>
              {hasExtraFilters ? (
                <button className={filterButtonClass} onClick={clearExtraFilters}>
                  Limpar filtros
                </button>
              ) : null}
              <p className='text-xs leading-5 text-[#64748B] dark:text-[#94A3BB]'>
                Ao preencher as datas, o intervalo abaixo substitui os atalhos acima.
              </p>
            </div>
          </div>
        </div>
        <section className="surface-card p-6">
          <p className='text-lg font-semibold text-[#0F172A] dark:text-white'>{chartTitle}</p>
          <p className='mt-1 text-sm text-[#64748B] dark:text-[#94A3BB]'>{chartDescription}</p>
          <div className='mt-6 flex justify-center'>
            {loading ? (
              <AiOutlineLoading3Quarters className='h-24 w-24 animate-spin p-6 text-[#22C55E]' />
            ) : results.chartData.length > 0 ? (
              <DonutChart results={results} />
            ) : (
              <p className='rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-[#64748B] dark:text-[#94A3BB]'>
                {emptyChartMessage}
              </p>
            )}
          </div>
          <div className='mt-4 text-xl'>
            {loading ? (
              <Skeleton className='h-28 w-full' />
            ) : results.percentageData.length > 0 ? (
              <GraphicListItem results={results} />
            ) : (
              <p className='text-sm text-[#64748B] dark:text-[#94A3BB]'>
                Ajuste os filtros para visualizar a distribuição por categoria.
              </p>
            )}
          </div>
        </section>
      </section>
      <div className='w-full xl:relative xl:flex-1'>
        <section className="surface-card-strong w-full flex flex-col xl:absolute xl:inset-0 overflow-hidden">
          <div className='border-b soft-divider px-5 py-5 sm:px-6 flex-none'>
            <h2 className='text-xl font-semibold text-[#0F172A] dark:text-white'>Ultimas transações</h2>
            <p className='mt-1 text-sm text-[#64748B] dark:text-[#94A3BB]'>
              Consulte suas movimentações mais recentes.
            </p>
          </div>
          <TransactionHeader />
          <div className='min-h-0 flex-1 overflow-auto'>
            <ul className='w-full divide-y divide-border/40'>
              {loading ? (
                Array.from({ length: 4 }, (_, index) => (
                  <TransactionsLoadings key={`transaction-loading-${index}`} />
                ))
              ) : filterItems.length > 0 ? (
                filterItems.map((item) => (
                  <TransactionItem key={item.id} item={item} onDelete={handleDeleteItem} />
                ))
              ) : (
                <li className='px-5 py-8 text-center text-sm text-[#64748B] dark:text-[#94A3BB] sm:px-6'>
                  Nenhuma transação encontrada com os filtros selecionados.
                </li>
              )}
            </ul>
          </div>
        </section>
      </div>
    </div>
  )
}