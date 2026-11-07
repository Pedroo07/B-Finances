"use client";

import React from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXPENSE_CATEGORIES } from "@/lib/transactionCategories";
import { isRowEdited } from "@/lib/importer/review";
import type { ReviewRow, ReviewValues } from "@/lib/importer/review";
import { cn } from "@/lib/utils";

type ReviewRowItemProps = {
  row: ReviewRow;
  errors?: string[];
  outOfSyncCount: number;
  onToggle: () => void;
  onEdit: (patch: Partial<ReviewValues>) => void;
  onRestore: () => void;
  onRemove: () => void;
  onApplyToSimilar: () => void;
};

const BADGE_BASE =
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold";

const Badge = ({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "amber" | "slate" | "green" | "rose";
}) => {
  const tones = {
    amber:
      "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    slate:
      "border-border/70 bg-background/60 text-[#475569] dark:text-[#CBD5E1]",
    green:
      "border-[#22C55E]/30 bg-[#22C55E]/10 text-[#15803D] dark:text-[#4ADE80]",
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  };

  return <span className={cn(BADGE_BASE, tones[tone])}>{children}</span>;
};

function getKindLabel(row: ReviewRow): string | null {
  if (row.kind === "payment") return "pagamento";
  if (row.kind === "fee") return "encargo";
  if (row.kind === "refund") return "crédito";
  return null;
}

function getDuplicateLabel(row: ReviewRow): string | null {
  if (row.duplicateReason === "imported-before") return "já importada";
  if (row.duplicateReason === "matches-existing") return "já existe na fatura";
  return null;
}

export const ReviewRowItem = ({
  row,
  errors,
  outOfSyncCount,
  onToggle,
  onEdit,
  onRestore,
  onRemove,
  onApplyToSimilar,
}: ReviewRowItemProps) => {
  const { values } = row;
  const edited = isRowEdited(row);
  const kindLabel = getKindLabel(row);
  const duplicateLabel = getDuplicateLabel(row);
  const hasInstallment =
    values.installmentNumber !== undefined &&
    values.installmentCount !== undefined;
  const showOriginal =
    row.original && row.original.rawDescription !== values.description;

  return (
    <li
      className={cn(
        "grid gap-2 rounded-2xl border border-border/60 bg-background/60 p-3 sm:grid-cols-[auto_minmax(0,1.6fr)_9rem_9rem_7rem_auto] sm:items-start",
        !row.included && "opacity-60",
        errors && errors.length > 0 && "border-rose-500/50",
      )}
    >
      <input
        type="checkbox"
        checked={row.included}
        onChange={onToggle}
        aria-label={`Incluir ${values.description || "lançamento"}`}
        className="mt-3 h-4 w-4 accent-[#22C55E]"
      />

      <div className="grid min-w-0 gap-1.5">
        <Input
          value={values.description}
          onChange={(event) => onEdit({ description: event.target.value })}
          placeholder="Descrição"
          aria-label="Descrição"
          className="h-10 rounded-xl px-3 text-sm"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {showOriginal ? (
            <span className="truncate text-[11px] text-[#64748B] dark:text-[#94A3BB]">
              No banco: {row.original?.rawDescription}
            </span>
          ) : null}
          {hasInstallment ? (
            <Badge tone="slate">
              parcela {values.installmentNumber}/{values.installmentCount}
            </Badge>
          ) : null}
          {kindLabel ? <Badge tone="slate">{kindLabel}</Badge> : null}
          {duplicateLabel ? <Badge tone="amber">{duplicateLabel}</Badge> : null}
          {row.ruleId ? <Badge tone="green">regra aplicada</Badge> : null}
          {row.manual ? <Badge tone="slate">manual</Badge> : null}
          {edited ? <Badge tone="green">editada</Badge> : null}
        </div>
        {errors && errors.length > 0 ? (
          <p className="text-[11px] font-medium text-rose-600 dark:text-rose-300">
            {errors.join(". ")}
          </p>
        ) : null}
        {outOfSyncCount > 0 ? (
          <button
            type="button"
            onClick={onApplyToSimilar}
            className="w-fit text-left text-[11px] font-semibold text-[#15803D] underline underline-offset-2 dark:text-[#4ADE80]"
          >
            Aplicar a outras {outOfSyncCount}{" "}
            {outOfSyncCount === 1 ? "linha igual" : "linhas iguais"}
          </button>
        ) : null}
      </div>

      <Input
        type="date"
        value={values.date}
        onChange={(event) => onEdit({ date: event.target.value })}
        aria-label="Data"
        className="h-10 rounded-xl px-3 text-sm"
      />

      <Select
        value={values.category}
        onValueChange={(category) => onEdit({ category })}
      >
        <SelectTrigger
          className="h-10 w-full rounded-xl text-sm"
          aria-label="Categoria"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EXPENSE_CATEGORIES.map((category) => (
            <SelectItem key={category.value} value={category.value}>
              {category.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="number"
        step="0.01"
        inputMode="decimal"
        value={Number.isFinite(values.amount) ? values.amount : ""}
        onChange={(event) =>
          onEdit({
            amount:
              event.target.value === ""
                ? Number.NaN
                : Number(event.target.value),
          })
        }
        aria-label="Valor"
        className="h-10 rounded-xl px-3 text-sm"
      />

      <div className="flex items-center gap-1 sm:pt-1">
        {edited ? (
          <button
            type="button"
            onClick={onRestore}
            aria-label="Restaurar valores originais"
            title="Restaurar valores originais"
            className="rounded-full p-2 text-[#64748B] transition-colors hover:bg-accent dark:text-[#94A3BB]"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        ) : null}
        {row.manual ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remover linha"
            title="Remover linha"
            className="rounded-full p-2 text-rose-500 transition-colors hover:bg-rose-500/10"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </li>
  );
};
