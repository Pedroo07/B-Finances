"use client";

import React from "react";
import { ChevronRight, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type {
  ReviewRow,
  ReviewSummary,
  ReviewValues,
} from "@/lib/importer/review";
import { cn, formatCurrency } from "@/lib/utils";

type ReviewRowItemProps = {
  row: ReviewRow;
  errors?: string[];
  outOfSyncCount: number;
  onToggle: () => void;
  onEdit: (patch: Partial<ReviewValues>) => void;
  onRestore: () => void;
  onRemove: () => void;
  onApplyToSimilar: () => void;
  onOpenMobileEdit?: () => void;
};

type ReviewRowSheetProps = {
  row: ReviewRow | null;
  summary: ReviewSummary;
  errors?: string[];
  outOfSyncCount: number;
  onClose: () => void;
  onToggle: () => void;
  onEdit: (patch: Partial<ReviewValues>) => void;
  onRestore: () => void;
  onRemove: () => void;
  onApplyToSimilar: () => void;
};

const BADGE_BASE =
  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold";

export const ReviewBadge = ({
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

function getCategoryLabel(value: string): string {
  return (
    EXPENSE_CATEGORIES.find((item) => item.value === value)?.label ?? "Outros"
  );
}

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

function formatShortDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate || "Sem data";
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function parseInstallmentInput(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
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
  onOpenMobileEdit,
}: ReviewRowItemProps) => {
  const { values } = row;
  const edited = isRowEdited(row);
  const kindLabel = getKindLabel(row);
  const duplicateLabel = getDuplicateLabel(row);
  const hasInstallment =
    values.installmentNumber !== undefined ||
    values.installmentCount !== undefined;
  const showOriginal =
    row.original && row.original.rawDescription !== values.description;

  const badges = (
    <div className="flex flex-wrap items-center gap-1.5">
      {showOriginal ? (
        <span className="truncate text-[11px] text-[#64748B] dark:text-[#94A3BB]">
          No banco: {row.original?.rawDescription}
        </span>
      ) : null}
      {hasInstallment ? (
        <ReviewBadge tone="slate">
          parcela {values.installmentNumber ?? "?"}/
          {values.installmentCount ?? "?"}
        </ReviewBadge>
      ) : null}
      {kindLabel ? <ReviewBadge tone="slate">{kindLabel}</ReviewBadge> : null}
      {duplicateLabel ? (
        <ReviewBadge tone="amber">{duplicateLabel}</ReviewBadge>
      ) : null}
      {row.ruleId ? (
        <ReviewBadge tone="green">regra aplicada</ReviewBadge>
      ) : null}
      {row.manual ? <ReviewBadge tone="slate">manual</ReviewBadge> : null}
      {edited ? <ReviewBadge tone="green">editada</ReviewBadge> : null}
    </div>
  );

  return (
    <li
      className={cn(
        "rounded-2xl border border-border/60 bg-background/60 p-3",
        !row.included && "opacity-60",
        errors && errors.length > 0 && "border-rose-500/50",
      )}
    >
      <div className="flex items-start gap-2.5 sm:hidden">
        <input
          type="checkbox"
          checked={row.included}
          onChange={onToggle}
          aria-label={`Incluir ${values.description || "lançamento"}`}
          className="mt-1 h-4 w-4 shrink-0 accent-[#22C55E]"
        />
        <button
          type="button"
          onClick={onOpenMobileEdit}
          className="grid min-w-0 flex-1 gap-1 text-left"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-semibold text-[#0F172A] dark:text-white">
              {values.description || "Toque para informar a descrição"}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[#0F172A] dark:text-white">
              {Number.isFinite(values.amount)
                ? formatCurrency(values.amount)
                : "R$ 0,00"}
              <ChevronRight className="h-4 w-4 text-[#64748B]" />
            </span>
          </div>
          <p className="text-xs text-[#64748B] dark:text-[#94A3BB]">
            {formatShortDate(values.date)} · {getCategoryLabel(values.category)}
          </p>
          {badges}
          {errors && errors.length > 0 ? (
            <p className="text-[11px] font-medium text-rose-600 dark:text-rose-300">
              {errors.join(". ")}
            </p>
          ) : null}
        </button>
      </div>

      <div className="hidden gap-2 sm:grid sm:grid-cols-[auto_minmax(0,1.6fr)_9rem_9rem_7rem_auto] sm:items-start">
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
          {badges}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-[#64748B] dark:text-[#94A3BB]">
              Parcela:
            </span>
            <Input
              type="number"
              min={1}
              max={99}
              placeholder="Nº"
              aria-label="Número da parcela"
              value={values.installmentNumber ?? ""}
              onChange={(event) =>
                onEdit({
                  installmentNumber: parseInstallmentInput(event.target.value),
                })
              }
              className="h-7 w-14 rounded-lg px-2 text-xs"
            />
            <span className="text-xs text-[#64748B]">/</span>
            <Input
              type="number"
              min={2}
              max={99}
              placeholder="Total"
              aria-label="Total de parcelas"
              value={values.installmentCount ?? ""}
              onChange={(event) =>
                onEdit({
                  installmentCount: parseInstallmentInput(event.target.value),
                })
              }
              className="h-7 w-14 rounded-lg px-2 text-xs"
            />
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
      </div>
    </li>
  );
};

export const ReviewRowSheet = ({
  row,
  summary,
  errors,
  outOfSyncCount,
  onClose,
  onToggle,
  onEdit,
  onRestore,
  onRemove,
  onApplyToSimilar,
}: ReviewRowSheetProps) => {
  if (!row) return null;

  const { values } = row;
  const edited = isRowEdited(row);
  const hasDifference =
    summary.difference !== undefined && Math.abs(summary.difference) > 0.005;

  return (
    <Dialog open={Boolean(row)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <div className="sticky top-0 z-10 -mx-1 rounded-2xl border border-border/60 bg-background/95 px-3 py-2 backdrop-blur-sm">
          <p className="text-xs font-semibold text-[#0F172A] dark:text-white">
            Selecionadas: {summary.includedCount} · Total{" "}
            {formatCurrency(summary.total)}
          </p>
          {summary.expectedTotal !== undefined ? (
            <p
              className={cn(
                "text-[11px]",
                hasDifference
                  ? "font-semibold text-amber-700 dark:text-amber-300"
                  : "text-[#64748B] dark:text-[#94A3BB]",
              )}
            >
              Fatura: {formatCurrency(summary.expectedTotal)}
              {hasDifference
                ? ` · Diferença: ${formatCurrency(summary.difference ?? 0)}`
                : " · Total confere"}
            </p>
          ) : null}
        </div>

        <DialogHeader>
          <DialogTitle>Editar lançamento</DialogTitle>
          <DialogDescription>
            {row.original
              ? `No banco: ${row.original.rawDescription}`
              : "Lançamento adicionado manualmente."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-[#0F172A] dark:text-white">
            <input
              type="checkbox"
              checked={row.included}
              onChange={onToggle}
              className="h-4 w-4 accent-[#22C55E]"
            />
            <span>Incluir na fatura</span>
          </label>

          <div className="grid gap-1">
            <label className="text-xs font-medium text-[#475569] dark:text-[#CBD5E1]">
              Descrição
            </label>
            <Input
              value={values.description}
              onChange={(event) => onEdit({ description: event.target.value })}
              placeholder="Descrição"
              className="h-10 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-[#475569] dark:text-[#CBD5E1]">
                Data
              </label>
              <Input
                type="date"
                value={values.date}
                onChange={(event) => onEdit({ date: event.target.value })}
                className="h-10 rounded-xl"
              />
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-medium text-[#475569] dark:text-[#CBD5E1]">
                Valor (R$)
              </label>
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
                className="h-10 rounded-xl"
              />
            </div>
          </div>

          <div className="grid gap-1">
            <label className="text-xs font-medium text-[#475569] dark:text-[#CBD5E1]">
              Categoria
            </label>
            <Select
              value={values.category}
              onValueChange={(category) => onEdit({ category })}
            >
              <SelectTrigger className="h-10 w-full rounded-xl">
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
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="grid gap-1">
              <label className="text-xs font-medium text-[#475569] dark:text-[#CBD5E1]">
                Parcela atual
              </label>
              <Input
                type="number"
                min={1}
                max={99}
                placeholder="À vista"
                value={values.installmentNumber ?? ""}
                onChange={(event) =>
                  onEdit({
                    installmentNumber: parseInstallmentInput(
                      event.target.value,
                    ),
                  })
                }
                className="h-10 rounded-xl"
              />
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-medium text-[#475569] dark:text-[#CBD5E1]">
                Total de parcelas
              </label>
              <Input
                type="number"
                min={2}
                max={99}
                placeholder="À vista"
                value={values.installmentCount ?? ""}
                onChange={(event) =>
                  onEdit({
                    installmentCount: parseInstallmentInput(event.target.value),
                  })
                }
                className="h-10 rounded-xl"
              />
            </div>
          </div>

          {errors && errors.length > 0 ? (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-300">
              {errors.join(". ")}
            </p>
          ) : null}

          {outOfSyncCount > 0 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onApplyToSimilar}
              className="w-full"
            >
              Aplicar nome e categoria a outras {outOfSyncCount}{" "}
              {outOfSyncCount === 1 ? "linha igual" : "linhas iguais"}
            </Button>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            {edited ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRestore}
              >
                <RotateCcw className="h-4 w-4" />
                Restaurar original
              </Button>
            ) : null}
            {row.manual ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  onRemove();
                  onClose();
                }}
              >
                <Trash2 className="h-4 w-4" />
                Remover
              </Button>
            ) : null}
          </div>
          <Button type="button" onClick={onClose} className="w-full sm:w-auto">
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
