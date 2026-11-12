"use client";
import { FC, useEffect, useState } from "react";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "@/lib/firebase";
import { formatCurrency } from "@/lib/utils";
import { Investment } from "@/lib/entities/investment";
import {
  getInvestments,
  addInvestmentYield,
  createInvestment,
  deleteInvestment,
  redeemInvestmentBalance,
} from "@/lib/services/investments";
import { FiPlusCircle } from "react-icons/fi";
import { Trash2 } from "lucide-react";
import { AiOutlineLoading3Quarters } from "react-icons/ai";
import { Skeleton } from "@/components/ui/skeleton";
import dynamic from "next/dynamic";
import { getCachedData } from "@/lib/services/clientCache";

const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type ChartData = {
  category: string;
  value: number;
};

type SeparateResults = {
  chartData: ChartData[];
  percentageData: ChartData[];
};

function separateAmountByCategory(items: Investment[]): SeparateResults {
  const totalPatrimony = items.reduce((acc, item) => acc + item.balance, 0);
  const byCategory: Record<string, number> = {};

  items.forEach((item) => {
    if (!byCategory[item.category]) {
      byCategory[item.category] = 0;
    }
    byCategory[item.category] += item.balance;
  });

  const chartData = Object.entries(byCategory).map(([category, value]) => ({
    category,
    value,
  }));

  const percentageData = Object.entries(byCategory).map(
    ([category, value]) => ({
      category,
      value: (value / totalPatrimony) * 100,
    }),
  );

  return { chartData, percentageData };
}

const DonutChartInvestments: FC<{ results: SeparateResults }> = ({
  results,
}) => {
  const [customScale, setCustomScale] = useState(1.0);

  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth <= 768;
      setCustomScale(isMobile ? 0.8 : 1.0);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const chartData = {
    options: {
      chart: {
        toolbar: {
          show: false,
        },
      },
      colors: ["#22C55E", "#94A3BB", "#334155", "#0F172A", "#16A34A"],
      stroke: {
        width: 0,
      },
      plotOptions: {
        pie: {
          customScale,
          donut: { size: "60%" },
        },
      },
      labels: results.chartData.map((item) => item.category),
      dataLabels: {
        enabled: false,
      },
      legend: {
        show: false,
      },
    },
    series: results.chartData.map((item) => item.value),
  };

  return (
    <div className="w-full max-w-95">
      <Chart
        options={chartData.options}
        series={chartData.series}
        type="donut"
        width="100%"
      />
    </div>
  );
};

const GraphicListItem: FC<{ results: SeparateResults }> = ({ results }) => {
  return (
    <ul className="divide-y p-1">
      {results.percentageData.map((item, index) => (
        <li className="flex justify-between items-center p-2" key={index}>
          <p className="capitalize text-[#334155] dark:text-[#E2E8F0]">
            {item.category}
          </p>
          <p className="text-[#0F172A] dark:text-white font-semibold">
            {item.value.toFixed(2)}%
          </p>
        </li>
      ))}
    </ul>
  );
};

export const Main: FC = () => {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [user, authLoading] = useAuthState(auth);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [hasHydratedCache, setHasHydratedCache] = useState(false);
  const loading = !hasHydratedCache && (authLoading || isDataLoading);
  const [categoryInput, setCategoryInput] = useState("");
  const [balance, setBalance] = useState(0);
  const [liquidez, setLiquidez] = useState<"imediata" | "longo_prazo">(
    "imediata",
  );
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [yieldValue, setYieldValue] = useState(0);
  const [yieldDate, setYieldDate] = useState("");
  const [selectedInvestmentId, setSelectedInvestmentId] = useState("");
  const [filteredCategories, setFilteredCategories] = useState<string[]>([]);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedExistingCategory, setSelectedExistingCategory] = useState("");
  const [redeemAmount, setRedeemAmount] = useState(0);
  const [selectedInvestmentIdForRedeem, setSelectedInvestmentIdForRedeem] =
    useState("");

  const resetNewInvestmentForm = () => {
    setCategoryInput("");
    setBalance(0);
    setLiquidez("imediata");
    setIsAddingNew(false);
    setFilteredCategories([]);
    setSelectedExistingCategory("");
  };

  const resetYieldForm = () => {
    setYieldValue(0);
    setYieldDate("");
    setSelectedInvestmentId("");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = getCachedData<Investment[]>("investments", user?.uid);
    if (cached) {
      setInvestments(cached);
      setHasHydratedCache(true);
      setIsDataLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (authLoading || !user || typeof window === "undefined") return;

    let isMounted = true;

    const fetchInvestments = async () => {
      try {
        const data = (await getInvestments()) || [];
        if (isMounted) {
          setInvestments(data);
          setIsDataLoading(false);
        }
      } catch (error) {
        console.error("Error fetching investments:", error);
        if (isMounted) {
          setIsDataLoading(false);
        }
      }
    };

    void fetchInvestments();

    return () => {
      isMounted = false;
    };
  }, [user, authLoading]);

  const handleCategoryInput = (value: string) => {
    setCategoryInput(value);
    if (value.trim()) {
      const existing = investments
        .map((inv) => inv.category)
        .filter((cat) => cat.toLowerCase().includes(value.toLowerCase()));
      setFilteredCategories(existing);
      setShowCategorySuggestions(true);
    } else {
      setFilteredCategories([]);
      setShowCategorySuggestions(false);
    }
  };

  const handleAddNewInvestment = async () => {
    const category = selectedInvestmentId
      ? investments.find((inv) => inv.id === selectedInvestmentId)?.category
      : categoryInput.trim();

    if (!category || balance <= 0) return;

    const newInvestment = {
      category,
      balance,
      liquidez,
      created_at: new Date().toISOString().split("T")[0],
      rendimentos: [],
      total_yield: 0,
    };

    try {
      await createInvestment(newInvestment);
      const allInvestments = await getInvestments();
      setInvestments(allInvestments);
      resetNewInvestmentForm();
      setSelectedInvestmentId("");
    } catch (error) {
      console.error("Error adding investment:", error);
    }
  };

  const handleDeleteInvestment = async (id: string) => {
    try {
      setIsDeleting(true);
      await deleteInvestment(id);
      const allInvestments = await getInvestments();
      setInvestments(allInvestments);
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Error deleting investment:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddYield = async () => {
    if (!selectedInvestmentId || yieldValue <= 0 || !yieldDate) return;

    try {
      await addInvestmentYield(selectedInvestmentId, yieldValue, yieldDate);
      const allInvestments = await getInvestments();
      setInvestments(allInvestments);
      resetYieldForm();
    } catch (error) {
      console.error("Error adding yield:", error);
    }
  };

  const handleRedeemBalance = async () => {
    if (!selectedInvestmentIdForRedeem || redeemAmount <= 0) return;

    try {
      await redeemInvestmentBalance(
        selectedInvestmentIdForRedeem,
        redeemAmount,
      );
      const allInvestments = await getInvestments();
      setInvestments(allInvestments);
      setSelectedInvestmentIdForRedeem("");
      setRedeemAmount(0);
    } catch (error) {
      console.error("Error redeeming balance:", error);
    }
  };

  const totalPatrimony = investments.reduce((acc, inv) => acc + inv.balance, 0);
  const immediateRescue = investments
    .filter((inv) => inv.liquidez === "imediata")
    .reduce((acc, inv) => acc + inv.balance, 0);

  const results =
    investments.length > 0
      ? separateAmountByCategory(investments)
      : { chartData: [], percentageData: [] };

  const getCurrentMonthYields = (investmentId: string) => {
    const investment = investments.find((inv) => inv.id === investmentId);
    if (!investment) return { total: 0, percentage: 0 };

    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    const currentYearMonth = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

    const monthYields = investment.rendimentos.filter((y) =>
      y.date.startsWith(currentYearMonth),
    );
    const total = monthYields.reduce((acc, y) => acc + y.value, 0);
    const percentage =
      investment.balance > 0 ? (total / investment.balance) * 100 : 0;

    return { total, percentage };
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6">
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <DialogContent className="sm:max-w-106">
          <DialogHeader>
            <DialogTitle>Remover investimento?</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover a categoria de investimento{" "}
              <span className="font-semibold text-[#0F172A] dark:text-white capitalize">
                {
                  investments.find((inv) => inv.id === deleteConfirmId)
                    ?.category
                }
              </span>
              ? Todo o saldo e histórico de rendimentos dessa categoria serão
              apagados permanentemente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                deleteConfirmId && handleDeleteInvestment(deleteConfirmId)
              }
              disabled={isDeleting || !deleteConfirmId}
              className="w-full sm:w-auto"
            >
              <span>
                {isDeleting ? "Removendo..." : "Remover investimento"}
              </span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <section className="surface-card p-4 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-1.5 sm:space-y-2">
            <span className="inline-flex rounded-full border border-[#22C55E]/20 bg-[#22C55E]/10 px-3 py-1 text-xs font-medium text-[#15803D] sm:px-4 sm:py-2 sm:text-sm dark:text-[#4ADE80]">
              Patrimônio
            </span>
            <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl dark:text-white">
              Investimentos
            </h1>
            <p className="hidden max-w-2xl text-sm leading-6 text-[#64748B] sm:block dark:text-[#94A3BB]">
              Acompanhe seu patrimônio investido, distribua entre categorias e
              controle seus rendimentos mensais.
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        {loading ? (
          <>
            <Skeleton className="h-24 sm:h-32" />
            <Skeleton className="h-24 sm:h-32" />
            <Skeleton className="col-span-2 h-20 sm:h-32 md:col-span-1" />
          </>
        ) : (
          <>
            <div className="surface-card flex flex-col justify-between gap-2 p-4 sm:p-6">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#94A3BB] sm:text-xs sm:tracking-[0.22em]">
                  Patrimônio Total
                </p>
                <h2 className="mt-1.5 truncate text-lg font-semibold text-[#0F172A] sm:mt-3 sm:text-3xl dark:text-white">
                  {formatCurrency(totalPatrimony)}
                </h2>
              </div>
              <p className="hidden text-xs text-[#64748B] sm:block dark:text-[#94A3BB]">
                Soma de todos os investimentos
              </p>
            </div>

            <div className="surface-card flex flex-col justify-between gap-2 p-4 sm:p-6">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#94A3BB] sm:text-xs sm:tracking-[0.22em]">
                  Resgate Imediato
                </p>
                <h2 className="mt-1.5 truncate text-lg font-semibold text-[#16A34A] sm:mt-3 sm:text-3xl dark:text-[#4ADE80]">
                  {formatCurrency(immediateRescue)}
                </h2>
              </div>
              <p className="hidden text-xs text-[#64748B] sm:block dark:text-[#94A3BB]">
                Disponível para resgate imediato
              </p>
            </div>

            <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="surface-card col-span-2 flex w-full cursor-pointer items-center gap-3.5 p-4 text-left transition-all hover:scale-[1.01] hover:border-[#22C55E]/30 active:scale-[0.98] sm:gap-4 sm:p-6 md:col-span-1"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#22C55E]/12 text-[#16A34A] sm:h-14 sm:w-14 dark:bg-[#22C55E]/18 dark:text-[#4ADE80]">
                    <FiPlusCircle className="text-xl sm:text-2xl" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0F172A] sm:text-base dark:text-white">
                      Novo investimento
                    </p>
                    <p className="text-xs text-[#64748B] sm:text-sm dark:text-[#94A3BB]">
                      Crie uma nova categoria de investimento.
                    </p>
                  </div>
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-106">
                <DialogHeader>
                  <DialogTitle>Adicionar novo investimento</DialogTitle>
                </DialogHeader>
                <div className="relative grid gap-4 py-4">
                  {investments.length > 0 && (
                    <Select
                      value={selectedExistingCategory}
                      onValueChange={(val) => {
                        if (val === "none") {
                          setSelectedExistingCategory("");
                          setCategoryInput("");
                          setLiquidez("imediata");
                        } else {
                          setSelectedExistingCategory(val);
                          setCategoryInput(val);
                          const existingInv = investments.find(
                            (inv) => inv.category === val,
                          );
                          if (existingInv) {
                            setLiquidez(existingInv.liquidez);
                          }
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Adicionar a categoria existente (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Categorias</SelectLabel>
                          <SelectItem value="none">
                            -- Nova categoria --
                          </SelectItem>
                          {investments.map((inv) => (
                            <SelectItem key={inv.id} value={inv.category}>
                              {inv.category} (Atual:{" "}
                              {formatCurrency(inv.balance)})
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                  <div>
                    <Input
                      type="text"
                      placeholder="Nome da categoria"
                      value={categoryInput}
                      onChange={(e) => handleCategoryInput(e.target.value)}
                      disabled={!!selectedExistingCategory}
                    />
                    {showCategorySuggestions &&
                      filteredCategories.length > 0 && (
                        <div className="absolute top-12 right-0 left-0 z-10 rounded-lg border border-border bg-white shadow-lg dark:bg-[#1E293B]">
                          {filteredCategories.map((cat) => (
                            <button
                              key={cat}
                              onClick={() => {
                                setCategoryInput(cat);
                                setShowCategorySuggestions(false);
                              }}
                              className="w-full px-4 py-2 text-left text-[#0F172A] hover:bg-[#22C55E]/10 dark:text-white dark:hover:bg-[#22C55E]/20"
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                  <Input
                    type="number"
                    placeholder="Saldo"
                    value={balance || ""}
                    onChange={(e) => setBalance(+e.target.value)}
                  />
                  <Select
                    value={liquidez}
                    onValueChange={(val) =>
                      setLiquidez(val as "imediata" | "longo_prazo")
                    }
                    disabled={!!selectedExistingCategory}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Liquidez" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Tipo de liquidez</SelectLabel>
                        <SelectItem value="imediata">Imediata</SelectItem>
                        <SelectItem value="longo_prazo">
                          Longo prazo
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleAddNewInvestment}
                    type="button"
                    disabled={!categoryInput.trim() || balance <= 0}
                    className="w-full sm:w-auto"
                  >
                    <span>Adicionar investimento</span>
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </section>

      <div className="flex flex-col gap-4 sm:gap-6 xl:flex-row xl:items-stretch">
        <section className="surface-card order-2 w-full p-5 sm:p-6 xl:order-1 xl:max-w-105">
          <p className="text-lg font-semibold text-[#0F172A] dark:text-white">
            Alocação Patrimonial
          </p>
          <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3BB]">
            Veja como seu patrimônio está distribuído.
          </p>
          <div className="mx-auto mt-6 flex items-center justify-center max-md:max-w-82">
            {loading ? (
              <AiOutlineLoading3Quarters className="h-24 w-24 animate-spin p-6 text-[#22C55E]" />
            ) : results.chartData.length > 0 ? (
              <DonutChartInvestments results={results} />
            ) : (
              <p className="rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-[#64748B] dark:text-[#94A3BB]">
                Nenhum investimento encontrado. Crie um novo para começar.
              </p>
            )}
          </div>
          <div className="mt-4">
            {loading ? (
              <Skeleton className="h-28 w-full" />
            ) : results.percentageData.length > 0 ? (
              <GraphicListItem results={results} />
            ) : (
              <p className="text-sm text-[#64748B] dark:text-[#94A3BB]">
                Adicione investimentos para visualizar a distribuição.
              </p>
            )}
          </div>
        </section>

        <div className="order-1 w-full xl:order-2 xl:relative xl:flex-1">
          <section className="surface-card-strong flex w-full flex-col overflow-hidden xl:absolute xl:inset-0">
            <header className="border-b soft-divider px-4 py-4 sm:px-6 sm:py-5">
              <h4 className="text-lg font-semibold text-[#0F172A] sm:text-xl dark:text-white">
                Categorias e Rendimentos
              </h4>
              <p className="text-xs text-[#64748B] sm:text-sm dark:text-[#94A3BB]">
                Controle seus investimentos e rendimentos mensais.
              </p>
            </header>
            <main className="flex min-h-0 flex-1 flex-col overflow-auto">
              {loading ? (
                <div className="space-y-3 p-4 sm:p-6">
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              ) : investments.length > 0 ? (
                <ul className="divide-y divide-border/40">
                  {investments.map((investment) => {
                    const yields = getCurrentMonthYields(investment.id);
                    const investedAmount =
                      (investment.balance || 0) +
                      (investment.rescued_amount || 0) -
                      (investment.total_yield || 0);
                    const totalWithYield =
                      investedAmount + (investment.total_yield || 0);
                    const hasRescued = (investment.rescued_amount || 0) > 0;

                    return (
                      <li
                        key={investment.id}
                        className="p-4 transition-colors hover:bg-surface-card/50 sm:p-6 dark:hover:bg-surface-card/20"
                      >
                        <div className="flex flex-col gap-3.5 sm:gap-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h5 className="font-semibold text-[#0F172A] capitalize dark:text-white">
                                {investment.category}
                              </h5>
                              <div className="mt-1.5 space-y-1 sm:mt-2">
                                <p className="text-xs text-[#64748B] sm:text-sm dark:text-[#94A3BB]">
                                  Valor investido:{" "}
                                  <span className="font-medium text-[#0F172A] dark:text-white">
                                    {formatCurrency(investedAmount)}
                                  </span>
                                </p>
                                <p className="text-xs text-[#64748B] sm:text-sm dark:text-[#94A3BB]">
                                  Total com rendimentos:{" "}
                                  <span className="font-medium text-[#0F172A] dark:text-white">
                                    {formatCurrency(totalWithYield)}
                                  </span>
                                </p>
                                {hasRescued && (
                                  <p className="text-xs text-[#64748B] sm:text-sm dark:text-[#94A3BB]">
                                    Saldo atual:{" "}
                                    <span className="font-medium text-[#16A34A] dark:text-[#4ADE80]">
                                      {formatCurrency(investment.balance)}
                                    </span>
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="inline-flex rounded-full border border-[#22C55E]/20 bg-[#22C55E]/10 px-2.5 py-1 text-xs font-medium whitespace-nowrap text-[#15803D] sm:px-3 dark:text-[#4ADE80]">
                              {investment.liquidez === "imediata"
                                ? "Imediata"
                                : "Longo prazo"}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2.5 text-sm sm:gap-3">
                            <div className="rounded-lg bg-[#22C55E]/5 p-2.5 sm:p-3 dark:bg-[#22C55E]/10">
                              <p className="text-[11px] uppercase tracking-wider text-[#64748B] sm:text-xs dark:text-[#94A3BB]">
                                Rendimento do mês
                              </p>
                              <p className="mt-1.5 text-xs font-semibold text-[#22C55E] sm:mt-2 sm:text-sm dark:text-[#4ADE80]">
                                {formatCurrency(yields.total)} (
                                {yields.percentage.toFixed(2)}%)
                              </p>
                            </div>
                            <div className="rounded-lg bg-[#16A34A]/5 p-2.5 sm:p-3 dark:bg-[#16A34A]/10">
                              <p className="text-[11px] uppercase tracking-wider text-[#64748B] sm:text-xs dark:text-[#94A3BB]">
                                Rendimento total
                              </p>
                              <p className="mt-1.5 text-xs font-semibold text-[#16A34A] sm:mt-2 sm:text-sm dark:text-[#86EFAC]">
                                {formatCurrency(investment.total_yield || 0)}
                              </p>
                            </div>
                            {!!investment.rescued_amount &&
                              investment.rescued_amount > 0 && (
                                <div className="col-span-2 rounded-lg bg-rose-500/5 p-2.5 sm:p-3 dark:bg-rose-500/10">
                                  <p className="text-[11px] uppercase tracking-wider text-[#64748B] sm:text-xs dark:text-[#94A3BB]">
                                    Valor já resgatado
                                  </p>
                                  <p className="mt-1.5 text-xs font-semibold text-rose-500 sm:mt-2 sm:text-sm dark:text-rose-300">
                                    {formatCurrency(investment.rescued_amount)}
                                  </p>
                                </div>
                              )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <button
                                  onClick={() =>
                                    setSelectedInvestmentId(investment.id)
                                  }
                                  className="inline-flex flex-1 items-center justify-center rounded-lg bg-[#22C55E]/10 px-3 py-2 text-xs font-medium text-[#16A34A] transition-colors hover:bg-[#22C55E]/20 sm:flex-initial sm:text-sm dark:bg-[#22C55E]/18 dark:text-[#4ADE80] dark:hover:bg-[#22C55E]/25"
                                >
                                  Adicionar Rendimento
                                </button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-106">
                                <DialogHeader>
                                  <DialogTitle>
                                    Adicionar rendimento
                                  </DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                  <p className="text-sm text-[#64748B] dark:text-[#94A3BB]">
                                    Categoria:{" "}
                                    <span className="font-semibold text-[#0F172A] capitalize dark:text-white">
                                      {investment.category}
                                    </span>
                                  </p>
                                  <div>
                                    <label className="text-sm font-medium text-[#0F172A] dark:text-white">
                                      Período (Mês/Ano)
                                    </label>
                                    <Input
                                      type="month"
                                      value={yieldDate}
                                      onChange={(e) =>
                                        setYieldDate(e.target.value)
                                      }
                                      className="mt-2"
                                    />
                                  </div>
                                  <Input
                                    type="number"
                                    placeholder="Valor do rendimento"
                                    value={yieldValue || ""}
                                    onChange={(e) =>
                                      setYieldValue(+e.target.value)
                                    }
                                  />
                                </div>
                                <DialogFooter>
                                  <Button
                                    onClick={handleAddYield}
                                    type="button"
                                    disabled={yieldValue <= 0 || !yieldDate}
                                    className="w-full sm:w-auto"
                                  >
                                    <span>Registrar rendimento</span>
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>

                            <Dialog
                              open={
                                selectedInvestmentIdForRedeem === investment.id
                              }
                              onOpenChange={(open) => {
                                if (!open) {
                                  setSelectedInvestmentIdForRedeem("");
                                  setRedeemAmount(0);
                                } else {
                                  setSelectedInvestmentIdForRedeem(
                                    investment.id,
                                  );
                                }
                              }}
                            >
                              <DialogTrigger asChild>
                                <button className="inline-flex flex-1 items-center justify-center rounded-lg bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-500/20 sm:flex-initial sm:text-sm dark:bg-rose-500/18 dark:text-rose-400 dark:hover:bg-rose-500/25">
                                  Resgatar Saldo
                                </button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-106">
                                <DialogHeader>
                                  <DialogTitle>Resgatar saldo</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                  <p className="text-sm text-[#64748B] dark:text-[#94A3BB]">
                                    Categoria:{" "}
                                    <span className="font-semibold text-[#0F172A] capitalize dark:text-white">
                                      {investment.category}
                                    </span>
                                  </p>
                                  <p className="text-sm font-medium text-[#0F172A] dark:text-white">
                                    Saldo disponível:{" "}
                                    {formatCurrency(investment.balance)}
                                  </p>
                                  <Input
                                    type="number"
                                    placeholder="Valor a ser resgatado"
                                    value={redeemAmount || ""}
                                    onChange={(e) =>
                                      setRedeemAmount(+e.target.value)
                                    }
                                  />
                                </div>
                                <DialogFooter>
                                  <Button
                                    onClick={handleRedeemBalance}
                                    type="button"
                                    disabled={
                                      redeemAmount <= 0 ||
                                      redeemAmount > investment.balance
                                    }
                                    className="w-full sm:w-auto"
                                  >
                                    <span>Confirmar resgate</span>
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setDeleteConfirmId(investment.id)}
                              className="h-9 w-9 shrink-0 border-rose-200 p-0 text-rose-600 hover:bg-rose-50 hover:text-rose-600 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/50 dark:hover:text-rose-400"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <li className="flex items-center justify-center px-5 py-8 text-center text-sm text-[#64748B] sm:px-6 dark:text-[#94A3BB]">
                  Nenhum investimento cadastrado. Crie um novo para começar.
                </li>
              )}
            </main>
          </section>
        </div>
      </div>
    </div>
  );
};
