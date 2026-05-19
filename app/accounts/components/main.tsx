'use client'
import  { FC, useEffect, useState } from 'react'
import { useAuthState } from 'react-firebase-hooks/auth'
import { auth } from '@/lib/firebase'
import { BillAccountDto, createBillAccount, getBillAccounts, payBillAccount, deleteBillAccount, updateBillAccount } from '@/lib/services/billAccounts'
import { BillAccount } from '@/lib/entities/billAccount'
import { getTransaction } from '@/lib/services/transactions'
import { getUserCreditCards } from '@/lib/services/userCreditCards'
import { getCardTransaction } from '@/lib/services/cardTransactions'
import { CardTransaction } from '@/lib/entities/cardTransaction'
import { BANKS, BankKey } from '@/app/CreditCard/banks'
import { Dialog, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, SelectLabel } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { FiPlusCircle } from 'react-icons/fi'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { UserCreditCard } from '@/lib/entities/userCreditCard'
import { Transaction } from '@/lib/entities/transaction'

const getTodayDate = () => {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

const getInvoicePeriodKey = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`

const getBillStatus = (bill: BillAccount): 'paid' | 'overdue' | 'due-soon' | 'pending' => {
  if (bill.status === 'paid') return 'paid'

  const today = getTodayDate()
  const dueDate = bill.dueDate

  if (dueDate < today) return 'overdue'

  const todayDate = new Date(today)
  const dueDateObj = new Date(dueDate)
  const diffTime = dueDateObj.getTime() - todayDate.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays <= 5 && diffDays >= 0) return 'due-soon'

  return 'pending'
}

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    paid: 'border-[#22C55E]/20 bg-[#22C55E]/10 text-[#15803D] dark:bg-[#22C55E]/18 dark:text-[#4ADE80]',
    overdue: 'border-rose-500/20 bg-rose-500/10 text-rose-700 dark:bg-rose-500/18 dark:text-rose-300',
    'due-soon': 'border-amber-500/20 bg-amber-500/10 text-amber-700 dark:bg-amber-500/18 dark:text-amber-300',
    pending: 'border-border/60 bg-[#F8FAFC] text-[#334155] dark:bg-white/5 dark:text-[#CBD5E1]',
  }
  return colors[status] || colors.pending
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    paid: 'Pago',
    overdue: 'Atrasado',
    'due-soon': 'Vence em breve',
    pending: 'Pendente',
  }
  return labels[status] || 'Pendente'
}

const getTodayDate_YYYYMMDD = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const Main: FC = () => {
  const [bills, setBills] = useState<BillAccount[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [userCards, setUserCards] = useState<UserCreditCard[]>([])
  const [cardTransactions, setCardTransactions] = useState<CardTransaction[]>([])
  const [user, loading] = useAuthState(auth)
  const [isLoading, setIsLoading] = useState(true)

  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState(0)
  const [dueDate, setDueDate] = useState('')
  const [recurrence, setRecurrence] = useState<'unique' | 'monthly' | 'installments'>('unique')
  const [installments, setInstallments] = useState(1)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false)
  const [paymentDate, setPaymentDate] = useState(getTodayDate_YYYYMMDD())
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false)
  const [selectedBillForPayment, setSelectedBillForPayment] = useState<BillAccount | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [dateError, setDateError] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'overdue' | 'pending'>('all')
  const [periodFilter, setPeriodFilter] = useState<'current' | 'next' | 'all' | 'custom'>('current')
  const [customMonth, setCustomMonth] = useState<string>('')

  const sortBillsByDate = (bills: BillAccount[]): BillAccount[] => {
    return [...bills].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
  }

  const getCurrentMonthRange = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const start = new Date(year, month, 1).toISOString().split('T')[0]
    const end = new Date(year, month + 1, 0).toISOString().split('T')[0]
    return { start, end }
  }

  const getNextMonthRange = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const start = new Date(year, month, 1).toISOString().split('T')[0]
    const end = new Date(year, month + 1, 0).toISOString().split('T')[0]
    return { start, end }
  }

  const filterBillsByPeriod = (bills: BillAccount[], period: 'current' | 'next' | 'all' | 'custom', customMonthStr: string) => {
    if (period === 'all') return bills

    let start = '', end = ''
    if (period === 'current') {
      const range = getCurrentMonthRange()
      start = range.start
      end = range.end
    } else if (period === 'next') {
      const range = getNextMonthRange()
      start = range.start
      end = range.end
    } else if (period === 'custom' && customMonthStr) {
      const [year, month] = customMonthStr.split('-').map(Number)
      start = new Date(year, month - 1, 1).toISOString().split('T')[0]
      end = new Date(year, month, 0).toISOString().split('T')[0]
    } else {
      return bills
    }

    return bills.filter((bill) => bill.dueDate >= start && bill.dueDate <= end)
  }

  const filterBillsByStatus = (bills: BillAccount[], status: string) => {
    if (status === 'all') return bills

    return bills.map((bill) => ({ bill, billStatus: getBillStatus(bill) }))
      .filter(({ billStatus }) => {
        if (status === 'pending') return billStatus === 'pending' || billStatus === 'due-soon'
        return billStatus === status
      })
      .map(({ bill }) => bill)
  }

  const getFilteredBills = () => {
    const byPeriod = filterBillsByPeriod(bills, periodFilter, customMonth)
    const byStatus = filterBillsByStatus(byPeriod, statusFilter)
    return sortBillsByDate(byStatus)
  }

  useEffect(() => {
    if (loading || !user || typeof window === 'undefined') return

    let isMounted = true

    const fetchData = async () => {
      try {
        const [billsData, transactionsData, cardsData, cardTransactionsData] = await Promise.all([
          getBillAccounts(),
          getTransaction(),
          getUserCreditCards(),
          getCardTransaction(),
        ])

        if (isMounted) {
          setBills(sortBillsByDate(billsData))
          setTransactions(transactionsData || [])
          setUserCards(cardsData || [])
          setCardTransactions(cardTransactionsData || [])
          setIsLoading(false)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        if (isMounted) setIsLoading(false)
      }
    }

    void fetchData()

    return () => {
      isMounted = false
    }
  }, [user, loading])

  const calculateProjection = () => {
    const { start, end } = getCurrentMonthRange()

    const currentMonthTransactions = transactions.filter((t) => t.date >= start && t.date <= end)
    const totalBalance = currentMonthTransactions.reduce((acc, t) => acc + t.amount, 0)

    const filteredBills = getFilteredBills()
    const totalPending = filteredBills.reduce((acc, b) => {
      if (b.status === 'paid') return acc
      return acc + b.amount
    }, 0)

    const projectedBalance = totalBalance - totalPending

    return { totalBalance, totalPending, projectedBalance }
  }

  const { totalBalance, totalPending, projectedBalance } = calculateProjection()

  const resetForm = () => {
    setDescription('')
    setAmount(0)
    setDueDate('')
    setRecurrence('unique')
    setInstallments(1)
    setDateError('')
  }

  const getCardsWithOpenInvoices = () => {
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    const periodKey = getInvoicePeriodKey(currentYear, currentMonth)

    return userCards
      .map((card) => {
        const cardName = BANKS[card.bankKey as BankKey]?.name
        const cardItems = cardTransactions.filter((t) => t.card === cardName)
        const currentMonthItems = cardItems.filter((item) => {
          const [year, month] = item.date.split('-').map(Number)
          return year === currentYear && month === currentMonth
        })

        const totalAmount = Math.abs(
          currentMonthItems.reduce((acc, item) => acc + item.amount, 0)
        )

        const invoicePaidAmount = card.invoices?.[periodKey]?.amountPaid || 0
        const isPaid = totalAmount > 0 && invoicePaidAmount >= totalAmount
        const invoiceAmount = totalAmount - invoicePaidAmount

        return { card, invoiceAmount, isPaid }
      })
      .filter(({ invoiceAmount, isPaid }) => invoiceAmount > 0 && !isPaid)
  }

  const handleSelectCardSuggestion = (card: UserCreditCard, invoiceAmount: number) => {
    const cardName = BANKS[card.bankKey as BankKey]?.name || card.bankKey
    setDescription(`Fatura do cartão ${cardName}`)
    setAmount(invoiceAmount)
    setIsDescriptionFocused(false)
  }

  const handleDueDateChange = (newDate: string) => {
    const today = getTodayDate_YYYYMMDD()
    if (newDate < today) {
      setDateError('A data de vencimento não pode ser menor que a data atual')
    } else {
      setDateError('')
    }
    setDueDate(newDate)
  }

  const handleAddBill = async () => {
    if (dateError || !dueDate || dueDate < getTodayDate_YYYYMMDD()) {
      setDateError('A data de vencimento não pode ser menor que a data atual')
      return
    }

    if (!description || !amount) return

    setIsProcessing(true)

    try {
      if (recurrence === 'installments' && installments > 1) {
        for (let i = 1; i <= installments; i++) {
          const billData: BillAccountDto = {
            description: `${description} (${i}/${installments})`,
            amount: amount / installments,
            dueDate,
            status: 'pending',
            recurrence: 'installments',
            currentInstallment: i,
            installments,
          }
          const newBill = await createBillAccount(billData)
          setBills((prev) => sortBillsByDate([...prev, newBill]))
        }
      } else {
        const billData: BillAccountDto = {
          description,
          amount,
          dueDate,
          status: 'pending',
          recurrence,
        }
        const newBill = await createBillAccount(billData)
        setBills((prev) => sortBillsByDate([...prev, newBill]))
      }

      resetForm()
      setIsDialogOpen(false)
    } catch (error) {
      console.error('Error creating bill:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handlePayBill = async () => {
    if (!selectedBillForPayment) return

    setIsProcessing(true)

    try {
      await payBillAccount(selectedBillForPayment.id, paymentDate)
      setBills((prev) =>
        prev.map((bill) =>
          bill.id === selectedBillForPayment.id ? { ...bill, status: 'paid' } : bill
        )
      )
      setIsPaymentDialogOpen(false)
      setSelectedBillForPayment(null)
    } catch (error) {
      console.error('Error paying bill:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeleteBill = async (billId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta conta?')) return

    try {
      await deleteBillAccount(billId)
      setBills((prev) => prev.filter((bill) => bill.id !== billId))
    } catch (error) {
      console.error('Error deleting bill:', error)
    }
  }

  const handleUnpayBill = async (billId: string) => {
    setIsProcessing(true)
    try {
      await updateBillAccount(billId, { status: 'pending' })
      setBills((prev) =>
        prev.map((bill) =>
          bill.id === billId ? { ...bill, status: 'pending' } : bill
        )
      )
    } catch (error) {
      console.error('Error unpaying bill:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const openPaymentDialog = (bill: BillAccount) => {
    setSelectedBillForPayment(bill)
    setPaymentDate(getTodayDate_YYYYMMDD())
    setIsPaymentDialogOpen(true)
  }

  const pendingBills = bills.filter((b) => b.status === 'pending')
  const filterButtonClass = 'surface-chip inline-flex items-center px-4 py-2'

  return (
    <div className='mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6'>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className='sm:max-w-106'>
          <DialogHeader>
            <DialogTitle>Adicionar nova conta</DialogTitle>
          </DialogHeader>
          <div className='grid gap-4 py-4'>
            <div className='relative'>
              <Input
                type='text'
                placeholder='Descrição'
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onFocus={() => setIsDescriptionFocused(true)}
                onBlur={() => setTimeout(() => setIsDescriptionFocused(false), 150)}
              />
              {isDescriptionFocused && getCardsWithOpenInvoices().length > 0 && (
                <div className='absolute top-full left-0 right-0 z-10 mt-1 rounded-lg border border-border/60 bg-white shadow-lg dark:bg-slate-900'>
                  {getCardsWithOpenInvoices().map(({ card, invoiceAmount }) => (
                    <button
                      key={card.id}
                      onClick={() => handleSelectCardSuggestion(card, invoiceAmount)}
                      className='w-full px-3 py-1 text-left hover:bg-[#F8FAFC] dark:hover:bg-white/10 border-b border-border/30 last:border-b-0 transition-colors'>
                      <p className='text-sm text-[#0F172A] dark:text-white'>
                        Fatura do cartão {BANKS[card.bankKey as BankKey]?.name || card.bankKey}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Input
              type='number'
              placeholder='Valor'
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
            <div>
              <Input
                type='date'
                placeholder='Data de vencimento'
                value={dueDate}
                onChange={(e) => handleDueDateChange(e.target.value)}
              />
              {dateError && <p className='mt-1 text-xs text-rose-500'>{dateError}</p>}
            </div>

            <Select value={recurrence} onValueChange={(val) => setRecurrence(val as any)}>
              <SelectTrigger className='w-full'>
                <SelectValue placeholder='Tipo de recorrência' />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Recorrência</SelectLabel>
                  <SelectItem value='unique'>Única</SelectItem>
                  <SelectItem value='monthly'>Fixa Mensal</SelectItem>
                  <SelectItem value='installments'>Parcelada</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>

            {recurrence === 'installments' && (
              <Input
                type='number'
                placeholder='Quantidade de parcelas'
                value={installments}
                onChange={(e) => setInstallments(Number(e.target.value))}
                min='2'
              />
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={handleAddBill}
              type='button'
              disabled={!description || !amount || !dueDate || !!dateError || isProcessing}
              className='w-full sm:w-auto'
            >
              <span>{isProcessing ? 'Criando...' : 'Criar conta'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className='sm:max-w-106'>
          <DialogHeader>
            <DialogTitle>Pagar conta</DialogTitle>
          </DialogHeader>
          {selectedBillForPayment && (
            <div className='grid gap-4 py-4'>
              <div className='rounded-2xl border border-border/60 bg-[#F8FAFC] px-4 py-4 dark:bg-white/5'>
                <p className='text-xs uppercase tracking-[0.22em] text-[#94A3BB]'>Valor da conta</p>
                <p className='mt-2 text-2xl font-semibold text-[#0F172A] dark:text-white'>
                  {formatCurrency(selectedBillForPayment.amount)}
                </p>
              </div>
              <Input
                type='date'
                placeholder='Data do pagamento'
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setIsPaymentDialogOpen(false)}
              className='w-full sm:w-auto'
            >
              Cancelar
            </Button>
            <Button
              type='button'
              onClick={handlePayBill}
              disabled={!paymentDate || isProcessing}
              className='w-full sm:w-auto'
            >
              <span>{isProcessing ? 'Pagando...' : 'Confirmar pagamento'}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className='surface-card p-6 sm:p-7'>
        <div className='flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between'>
          <div className='space-y-2'>
            <span className='inline-flex rounded-full border border-[#22C55E]/20 bg-[#22C55E]/10 px-4 py-2 text-sm font-medium text-[#15803D] dark:text-[#4ADE80]'>
              Agenda financeira
            </span>
            <h1 className='text-3xl font-semibold tracking-tight text-[#0F172A] dark:text-white'>
              Contas a Pagar
            </h1>
            <p className='max-w-2xl text-sm leading-6 text-[#64748B] dark:text-[#94A3BB]'>
              Acompanhe suas contas a pagar, visualize seu saldo projetado e registre novos compromissos financeiros.
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className='w-fit'>
                <FiPlusCircle className='text-base' />
                <span>Nova conta</span>
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </section>

      <section className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex flex-wrap items-center gap-2'>
          <Button variant={statusFilter === 'all' ? 'default' : 'outline'} onClick={() => setStatusFilter('all')} size='sm' className='rounded-full'>Todas</Button>
          <Button variant={statusFilter === 'paid' ? 'default' : 'outline'} onClick={() => setStatusFilter('paid')} size='sm' className='rounded-full'>Pagas</Button>
          <Button variant={statusFilter === 'pending' ? 'default' : 'outline'} onClick={() => setStatusFilter('pending')} size='sm' className='rounded-full'>A Pagar</Button>
          <Button variant={statusFilter === 'overdue' ? 'default' : 'outline'} onClick={() => setStatusFilter('overdue')} size='sm' className='rounded-full'>Vencidas</Button>
        </div>
        <div className='flex flex-wrap items-center gap-2'>
          <Button variant={periodFilter === 'current' ? 'default' : 'outline'} onClick={() => setPeriodFilter('current')} size='sm' className='rounded-full'>Mês Atual</Button>
          <Button variant={periodFilter === 'next' ? 'default' : 'outline'} onClick={() => setPeriodFilter('next')} size='sm' className='rounded-full'>Próximo Mês</Button>
          <Button variant={periodFilter === 'all' ? 'default' : 'outline'} onClick={() => setPeriodFilter('all')} size='sm' className='rounded-full'>Todos os Meses</Button>
          <Select 
            value={periodFilter === 'custom' ? customMonth : ''} 
            onValueChange={(val) => { 
              setPeriodFilter('custom')
              setCustomMonth(val) 
            }}
          >
            <SelectTrigger className='h-9 w-37 rounded-full'>
              <SelectValue placeholder='Mês específico' />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }).map((_, i) => {
                const d = new Date()
                const y = d.getFullYear()
                const val = `${y}-${String(i + 1).padStart(2, '0')}`
                const dateObj = new Date(y, i, 1)
                const label = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
                return <SelectItem key={val} value={val}>{label.charAt(0).toUpperCase() + label.slice(1)}</SelectItem>
              })}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className='grid gap-4 md:grid-cols-3'>
        {loading || isLoading ? (
          <>
            <Skeleton className='h-32' />
            <Skeleton className='h-32' />
            <Skeleton className='h-32' />
          </>
        ) : (
          <>
            <div className='surface-card flex flex-col justify-between gap-2 p-5 sm:p-6'>
              <div>
                <p className='text-xs uppercase tracking-[0.22em] text-[#94A3BB]'>Saldo do mês Atual</p>
                <h2 className='mt-3 text-3xl font-semibold text-[#0F172A] dark:text-white'>
                  {formatCurrency(totalBalance)}
                </h2>
              </div>
            </div>

            <div className='surface-card flex flex-col justify-between gap-2 p-5 sm:p-6'>
              <div>
                <p className='text-xs uppercase tracking-[0.22em] text-[#94A3BB]'>Total a Pagar</p>
                <h2 className='mt-3 text-3xl font-semibold text-rose-500 dark:text-rose-300'>
                  {formatCurrency(totalPending)}
                </h2>
              </div>
            </div>

            <div className='surface-card flex flex-col justify-between gap-2 p-5 sm:p-6'>
              <div>
                <p className='text-xs uppercase tracking-[0.22em] text-[#94A3BB]'>Saldo do mês Projetado</p>
                <h2 className={`mt-3 text-3xl font-semibold ${
                  projectedBalance >= 0
                    ? 'text-[#22C55E] dark:text-[#4ADE80]'
                    : 'text-rose-500 dark:text-rose-300'
                }`}>
                  {formatCurrency(projectedBalance)}
                </h2>
              </div>
            </div>
          </>
        )}
      </section>

      <section className='surface-card p-6'>
        {loading || isLoading ? (
          <div className='space-y-4'>
            <Skeleton className='h-24' />
            <Skeleton className='h-24' />
            <Skeleton className='h-24' />
          </div>
        ) : getFilteredBills().length === 0 ? (
          <div className='rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center'>
            <p className='text-sm text-[#64748B] dark:text-[#94A3BB]'>
              Nenhuma conta encontrada para os filtros selecionados.
            </p>
          </div>
        ) : (
          <div className='space-y-3'>
            {getFilteredBills().map((bill) => {
              const billStatus = getBillStatus(bill)
              const statusLabel = getStatusLabel(billStatus)
              const statusColor = getStatusColor(billStatus)
              const isPending = bill.status === 'pending'

              return (
                <div
                  key={bill.id}
                  className='flex items-center justify-between rounded-xl border border-border/40 p-4 hover:bg-white/50 transition-colors dark:hover:bg-white/5'
                >
                  <div className='flex flex-1 items-center gap-4'>
                    <div className={`h-3 w-3 rounded-full ${
                      billStatus === 'paid'
                        ? 'bg-[#22C55E]'
                        : billStatus === 'overdue'
                          ? 'bg-rose-500'
                          : billStatus === 'due-soon'
                            ? 'bg-amber-500'
                            : 'bg-border'
                    }`} />
                    <div className='flex-1'>
                      <p className='font-semibold text-[#0F172A] dark:text-white'>{bill.description}</p>
                      <p className='text-sm text-[#64748B] dark:text-[#94A3BB]'>
                        Vence em {new Date(bill.dueDate).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  <div className='flex items-center gap-3'>
                    <div className='text-right'>
                      <p className='text-lg font-semibold text-[#0F172A] dark:text-white'>
                        {formatCurrency(bill.amount)}
                      </p>
                      <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </div>

                    <div className='flex gap-2'>
                      {isPending ? (
                        <>
                          <Button
                            size='sm'
                            onClick={() => openPaymentDialog(bill)}
                            className='h-8'
                          >
                            Pagar
                          </Button>
                          <Button
                            size='sm'
                            variant='outline'
                            onClick={() => handleDeleteBill(bill.id)}
                            className='h-8'
                          >
                            Remover
                          </Button>
                        </>
                      ) : (
                        <Button
                          size='sm'
                          variant='outline'
                          onClick={() => handleUnpayBill(bill.id)}
                          className='h-8'
                        >
                          Desfazer Pag.
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
