"use client";

import React, { useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImportRule } from "@/lib/importer/rules";
import { deleteImportRule, getImportRules } from "@/lib/services/importRules";
import { EXPENSE_CATEGORIES } from "@/lib/transactionCategories";

type ImportRulesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRules?: ImportRule[];
  onRulesChange?: (rules: ImportRule[]) => void;
};

function getCategoryLabel(value: string): string {
  return (
    EXPENSE_CATEGORIES.find((item) => item.value === value)?.label ?? value
  );
}

const ImportRulesList = ({
  initialRules,
  onRulesChange,
}: {
  initialRules?: ImportRule[];
  onRulesChange?: (rules: ImportRule[]) => void;
}) => {
  const [rules, setRules] = useState<ImportRule[]>(initialRules ?? []);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    getImportRules()
      .then((loaded) => {
        if (!active) return;
        setRules(loaded);
        onRulesChange?.(loaded);
      })
      .catch(() => {
        if (!active) return;
        setError(
          "Não foi possível carregar suas regras aprendidas. Verifique sua conexão ou permissões.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [onRulesChange]);

  const handleDelete = async (id: string) => {
    if (deletingId) return;

    setDeletingId(id);
    setError("");

    try {
      await deleteImportRule(id);
      const nextRules = rules.filter((rule) => rule.id !== id);
      setRules(nextRules);
      onRulesChange?.(nextRules);
    } catch {
      setError("Não foi possível excluir a regra. Tente novamente.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      {error ? (
        <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-[#64748B] dark:text-[#94A3BB]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando regras...</span>
        </div>
      ) : rules.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#64748B] dark:text-[#94A3BB]">
          Nenhuma regra salva ainda. Suas edições de nome e categoria na revisão
          aparecerão aqui.
        </p>
      ) : (
        <ul className="grid max-h-80 gap-2 overflow-y-auto pr-1">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background/60 px-3.5 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-[#64748B] dark:text-[#94A3BB]">
                  Quando contiver:{" "}
                  <span className="font-mono font-medium text-[#334155] dark:text-[#E2E8F0]">
                    {rule.matchText}
                  </span>
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm font-medium text-[#0F172A] dark:text-white">
                  {rule.rewriteDescription ? (
                    <span>
                      Renomear para &quot;{rule.rewriteDescription}&quot;
                    </span>
                  ) : null}
                  {rule.category ? (
                    <span className="inline-flex items-center rounded-full border border-border/70 bg-background/80 px-2 py-0.5 text-xs font-semibold text-[#475569] dark:text-[#CBD5E1]">
                      {getCategoryLabel(rule.category)}
                    </span>
                  ) : null}
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleDelete(rule.id)}
                disabled={deletingId === rule.id}
                aria-label={`Excluir regra ${rule.matchText}`}
                className="shrink-0 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
              >
                {deletingId === rule.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

export const ImportRulesDialog = ({
  open,
  onOpenChange,
  initialRules,
  onRulesChange,
}: ImportRulesDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Regras aprendidas</DialogTitle>
          <DialogDescription>
            Quando você edita o nome ou a categoria de um lançamento, o app
            aplica essas escolhas automaticamente nas próximas faturas.
          </DialogDescription>
        </DialogHeader>

        {open ? (
          <ImportRulesList
            initialRules={initialRules}
            onRulesChange={onRulesChange}
          />
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
