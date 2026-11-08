"use client";

import React, { useState } from "react";
import { Plus, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXPENSE_CATEGORIES } from "@/lib/transactionCategories";
import { countSimilarRowsOutOfSync } from "@/lib/importer/review";
import type { ImportedEntryKind } from "@/lib/importer/types";
import { formatCurrency } from "@/lib/utils";
import { ReviewRowItem, ReviewRowSheet } from "./ReviewRow";
import type { ImportReview } from "./useImportReview";

type SuggestedBilling = {
  closingDay: number;
  dueDay: number;
};

type ReviewStepProps = {
  review: ImportReview;
  warnings: string[];
  rememberEdits: boolean;
  onRememberEditsChange: (value: boolean) => void;
  paidPeriodWarning?: string | null;
  periodLabel?: string;
  suggestedBilling?: SuggestedBilling | null;
  isApplyingBilling?: boolean;
  onApplySuggestedBilling?: () => void;
  onManageRules?: () => void;
};

const BULK_FILTERS: {
  filter: ImportedEntryKind | "duplicate";
  label: string;
}[] = [
  { filter: "payment", label: "pagamentos" },
  { filter: "fee", label: "encargos" },
  { filter: "refund", label: "créditos" },
  { filter: "duplicate", label: "duplicadas" },
];

const getTodayDate = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .split("T")[0];
};

export const ReviewStep = ({
  review,
  warnings,
  rememberEdits,
  onRememberEditsChange,
  paidPeriodWarning,
  periodLabel,
  suggestedBilling,
  isApplyingBilling,
  onApplySuggestedBilling,
  onManageRules,
}: ReviewStepProps) => {
  const { rows, summary, blockingErrors, dispatch, canUndo } = review;
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const editingRow = rows.find((row) => row.id === editingRowId) ?? null;
  const hasDifference =
    summary.difference !== undefined && Math.abs(summary.difference) > 0.005;

  const handleAddManual = () => {
    const lastDate = rows.length > 0 ? rows[rows.length - 1].values.date : "";
    dispatch({
      type: "addManual",
      values: {
        description: "",
        date: lastDate || getTodayDate(),
        amount: 0,
        category: "other",
      },
    });
  };

  return (
    <div className="grid gap-4">
      <div className="sticky top-0 z-10 -mx-1 grid gap-2 rounded-2xl border border-border/60 bg-background/95 px-4 py-3 backdrop-blur-sm sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-[#0F172A] dark:text-white">
            Selecionadas: {summary.includedCount} · Total{" "}
            {formatCurrency(summary.total)}
          </p>
          <p className="text-xs text-[#64748B] dark:text-[#94A3BB]">
            {summary.ignoredCount} fora da importação
            {summary.expectedTotal !== undefined
              ? ` · Fatura: ${formatCurrency(summary.expectedTotal)}`
              : ""}
            {periodLabel ? ` · Período: ${periodLabel}` : ""}
          </p>
          {hasDifference ? (
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              Diferença de {formatCurrency(summary.difference ?? 0)} em relação
              à fatura
            </p>
          ) : summary.expectedTotal !== undefined ? (
            <p className="text-xs font-semibold text-[#15803D] dark:text-[#4ADE80]">
              Total confere com o valor de compras da fatura
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => dispatch({ type: "undo" })}
            disabled={!canUndo}
          >
            <Undo2 />
            Desfazer
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddManual}
          >
            <Plus />
            Adicionar linha
          </Button>
        </div>
      </div>

      {suggestedBilling && onApplySuggestedBilling ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#22C55E]/30 bg-[#22C55E]/10 px-4 py-3 text-xs text-[#15803D] dark:text-[#4ADE80]">
          <span>
            O PDF informa fechamento dia {suggestedBilling.closingDay} e
            vencimento dia {suggestedBilling.dueDay}.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onApplySuggestedBilling}
            disabled={isApplyingBilling}
          >
            {isApplyingBilling ? "Salvando..." : "Usar estas datas no cartão"}
          </Button>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <ul className="grid gap-1 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {paidPeriodWarning ? (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
          {paidPeriodWarning}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => dispatch({ type: "setIncluded", included: true })}
        >
          Marcar todas
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => dispatch({ type: "setIncluded", included: false })}
        >
          Desmarcar todas
        </Button>
        {BULK_FILTERS.map(({ filter, label }) => {
          const count = rows.filter((row) =>
            filter === "duplicate"
              ? Boolean(row.duplicateReason)
              : row.kind === filter,
          ).length;
          if (count === 0) return null;

          return (
            <Button
              key={filter}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                dispatch({ type: "setIncluded", included: true, filter })
              }
            >
              Incluir {label} ({count})
            </Button>
          );
        })}
        <div className="w-full sm:ml-auto sm:w-56">
          <Select
            value=""
            onValueChange={(category) =>
              dispatch({ type: "setCategoryForIncluded", category })
            }
          >
            <SelectTrigger className="h-9 w-full rounded-full text-xs">
              <SelectValue placeholder="Categoria para as selecionadas" />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_CATEGORIES.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#64748B] dark:text-[#94A3BB]">
          Nenhum lançamento encontrado no arquivo. Use &quot;Adicionar
          linha&quot; para incluir manualmente.
        </p>
      ) : (
        <ul className="grid gap-2">
          {rows.map((row) => (
            <ReviewRowItem
              key={row.id}
              row={row}
              errors={blockingErrors.get(row.id)}
              outOfSyncCount={countSimilarRowsOutOfSync(rows, row.id)}
              onToggle={() => dispatch({ type: "toggle", id: row.id })}
              onEdit={(patch) => dispatch({ type: "edit", id: row.id, patch })}
              onRestore={() => dispatch({ type: "restore", id: row.id })}
              onRemove={() => dispatch({ type: "remove", id: row.id })}
              onApplyToSimilar={() =>
                dispatch({
                  type: "applyToSimilar",
                  id: row.id,
                  patch: {
                    description: row.values.description,
                    category: row.values.category,
                  },
                })
              }
              onOpenMobileEdit={() => setEditingRowId(row.id)}
            />
          ))}
        </ul>
      )}

      <ReviewRowSheet
        row={editingRow}
        summary={summary}
        errors={editingRow ? blockingErrors.get(editingRow.id) : undefined}
        outOfSyncCount={
          editingRow ? countSimilarRowsOutOfSync(rows, editingRow.id) : 0
        }
        onClose={() => setEditingRowId(null)}
        onToggle={() =>
          editingRow && dispatch({ type: "toggle", id: editingRow.id })
        }
        onEdit={(patch) =>
          editingRow && dispatch({ type: "edit", id: editingRow.id, patch })
        }
        onRestore={() =>
          editingRow && dispatch({ type: "restore", id: editingRow.id })
        }
        onRemove={() =>
          editingRow && dispatch({ type: "remove", id: editingRow.id })
        }
        onApplyToSimilar={() =>
          editingRow &&
          dispatch({
            type: "applyToSimilar",
            id: editingRow.id,
            patch: {
              description: editingRow.values.description,
              category: editingRow.values.category,
            },
          })
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-start gap-2 text-sm text-[#334155] dark:text-[#E2E8F0]">
          <input
            type="checkbox"
            checked={rememberEdits}
            onChange={(event) => onRememberEditsChange(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#22C55E]"
          />
          <span>
            Lembrar minhas edições de nome e categoria para as próximas faturas
          </span>
        </label>
        {onManageRules ? (
          <button
            type="button"
            onClick={onManageRules}
            className="text-xs font-semibold text-[#15803D] underline underline-offset-2 dark:text-[#4ADE80]"
          >
            Gerenciar regras aprendidas
          </button>
        ) : null}
      </div>
    </div>
  );
};
