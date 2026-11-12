import React from "react";
import { Trash2 } from "lucide-react";
import { formatCurrency, translateCategory } from "@/lib/utils";
import { PaymentMethodIconBadge } from "./transactionIcons";

export type Item = {
  id: string;
  description: string;
  date: string;
  amount: number;
  category: string;
  type?: string;
  paymentMethod?: string;
  card?: string;
  installmentNumber?: number;
  installmentCount?: number;
  invoicePaid?: boolean;
  invoicePeriodKey?: string;
  invoicePeriodLabel?: string;
};

type TransactionItemProps = {
  item: Item;
  onDelete: (id: string) => void;
  showInstallment?: boolean;
};

export const TransactionHeader = () => {
  return (
    <div className="hidden w-full md:block">
      <ul className="grid grid-cols-5 rounded-t-[26px] border-b border-border/60 bg-[#E2E8F0]/65 px-5 py-3 text-sm font-semibold text-[#334155] dark:bg-[#0F172A]/45 dark:text-[#CBD5E1]">
        <li className="col-span-2">Descrição</li>
        <li>Categoria</li>
        <li>Data</li>
        <li>Valor</li>
      </ul>
    </div>
  );
};

export const TransactionItem: React.FC<TransactionItemProps> = ({
  item,
  onDelete,
  showInstallment = false,
}) => {
  const paymentMethod =
    item.paymentMethod ?? (item.card ? "credit_card" : undefined);

  return (
    <li className="w-full border-b border-border/50 last:border-b-0">
      <div className="flex items-center justify-between gap-3 px-4 py-3.5 md:grid md:grid-cols-5 md:items-center md:gap-3 md:px-5 md:py-4">
        <div className="flex min-w-0 flex-1 items-center gap-3 md:col-span-2">
          <PaymentMethodIconBadge
            method={paymentMethod}
            isIncome={item.amount > 0}
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-sm font-medium text-[#0F172A] dark:text-[#E2E8F0]">
                {item.description}
              </p>
              {item.invoicePaid ? (
                <span className="inline-flex shrink-0 items-center rounded-full border border-[#22C55E]/30 bg-[#22C55E]/10 px-2 py-0.5 text-[11px] font-semibold text-[#15803D] dark:text-[#4ADE80]">
                  Paga
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-[#64748B] dark:text-[#94A3BB] md:hidden">
              <span>{translateCategory(item.category)}</span>
              <span aria-hidden="true">•</span>
              <span>{item.date}</span>
              {showInstallment &&
              item.installmentNumber &&
              item.installmentCount ? (
                <>
                  <span aria-hidden="true">•</span>
                  <span>
                    Parcela {item.installmentNumber}/{item.installmentCount}
                  </span>
                </>
              ) : null}
            </div>
            {showInstallment &&
            item.installmentNumber &&
            item.installmentCount ? (
              <p className="mt-1 hidden text-xs text-[#64748B] dark:text-[#94A3BB] md:block">
                Parcela {item.installmentNumber}/{item.installmentCount}
              </p>
            ) : null}
          </div>
        </div>

        <p className="hidden text-sm text-[#334155] dark:text-[#CBD5E1] md:block">
          {translateCategory(item.category)}
        </p>

        <p className="hidden text-sm text-[#64748B] dark:text-[#94A3BB] md:block">
          {item.date}
        </p>

        <div className="flex shrink-0 items-center gap-2.5 text-sm md:justify-between md:gap-3">
          <span
            className={`font-semibold whitespace-nowrap ${item.amount > 0 ? "text-[#16A34A] dark:text-[#4ADE80]" : "text-rose-500 dark:text-rose-300"}`}
          >
            {item.amount > 0
              ? `+${formatCurrency(item.amount)}`
              : formatCurrency(item.amount)}
          </span>
          <button
            onClick={() => onDelete(item.id)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 text-[#64748B] transition-all hover:border-rose-400/50 hover:text-rose-500 active:scale-95 md:h-auto md:w-auto md:p-2 dark:text-[#94A3BB]"
            aria-label="Excluir transação"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
};
