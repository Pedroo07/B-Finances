"use client";

import React from "react";
import { CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type ConfirmStepProps = {
  cardName: string;
  includedCount: number;
  ignoredCount: number;
  total: number;
  learnedHint: boolean;
  paidPeriodWarning?: string | null;
  errorMessage: string;
};

export const ConfirmStep = ({
  cardName,
  includedCount,
  ignoredCount,
  total,
  learnedHint,
  paidPeriodWarning,
  errorMessage,
}: ConfirmStepProps) => (
  <div className="grid gap-3">
    <div className="rounded-2xl border border-border/60 bg-background/60 p-4">
      <p className="text-sm font-semibold text-[#0F172A] dark:text-white">
        Vai adicionar {includedCount}{" "}
        {includedCount === 1 ? "compra" : "compras"} ({formatCurrency(total)})
        ao cartão {cardName}.
      </p>
      <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3BB]">
        {ignoredCount}{" "}
        {ignoredCount === 1 ? "linha ignorada" : "linhas ignoradas"}.
        {learnedHint
          ? " Suas edições de nome e categoria serão lembradas nas próximas faturas."
          : ""}
      </p>
    </div>
    {paidPeriodWarning ? (
      <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
        {paidPeriodWarning}
      </p>
    ) : null}
    {errorMessage ? (
      <p
        role="alert"
        className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300"
      >
        {errorMessage}
      </p>
    ) : null}
  </div>
);

type ResultStepProps = {
  importedCount: number;
  undone: boolean;
  canUndo: boolean;
  undoError: string;
};

export const ResultStep = ({
  importedCount,
  undone,
  canUndo,
  undoError,
}: ResultStepProps) => (
  <div className="grid gap-3 py-2 text-center">
    <CheckCircle2 className="mx-auto h-10 w-10 text-[#22C55E]" />
    <p className="text-sm font-semibold text-[#0F172A] dark:text-white">
      {undone
        ? "Importação desfeita. Os lançamentos foram removidos."
        : `${importedCount} ${importedCount === 1 ? "compra adicionada" : "compras adicionadas"}.`}
    </p>
    {!undone && !canUndo ? (
      <p className="text-xs text-[#64748B] dark:text-[#94A3BB]">
        Esta importação não pode mais ser desfeita porque a fatura já foi paga.
      </p>
    ) : null}
    {undoError ? (
      <p role="alert" className="text-xs text-rose-600 dark:text-rose-300">
        {undoError}
      </p>
    ) : null}
  </div>
);
