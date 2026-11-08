"use client";

import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import type { BankKey } from "@/lib/creditCards/catalog";
import type { CardTransaction } from "@/lib/entities/cardTransaction";
import { summarizeImportBatches } from "@/lib/importer/batches";
import { collectRulesToLearn } from "@/lib/importer/learn";
import {
  countIncludedRowsInPeriods,
  getRowIdsInPeriods,
} from "@/lib/importer/periods";
import { createReviewState, getIncludedRows } from "@/lib/importer/review";
import type { ImportRule } from "@/lib/importer/rules";
import {
  getBankMismatchWarning,
  parseStatementFile,
} from "@/lib/importer/statementFile";
import {
  createImportBatchId,
  deleteCardImportBatch,
  importCardTransactions,
} from "@/lib/services/cardImports";
import { updateUserCreditCardBilling } from "@/lib/services/userCreditCards";
import { getImportRules, saveImportRule } from "@/lib/services/importRules";
import { ConfirmStep, ResultStep } from "./ConfirmStep";
import { FileStep } from "./FileStep";
import { ImportRulesDialog } from "./ImportRulesDialog";
import { ReviewStep } from "./ReviewStep";
import { useImportReview } from "./useImportReview";

type Step = "file" | "processing" | "review" | "confirm" | "result";

type ImportInvoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankKey: BankKey;
  cardName: string;
  cardItems: CardTransaction[];
  closingDay: number | null;
  dueDay: number | null;
  paidPeriodKeys: Set<string>;
  onImported: () => Promise<void>;
};

const DISCARD_MESSAGE = "Descartar a importação em andamento?";

export const ImportInvoiceDialog = ({
  open,
  onOpenChange,
  bankKey,
  cardName,
  cardItems,
  closingDay,
  dueDay,
  paidPeriodKeys,
  onImported,
}: ImportInvoiceDialogProps) => {
  const [expectedTotal, setExpectedTotal] = useState<number | undefined>(
    undefined,
  );
  const [periodLabel, setPeriodLabel] = useState<string | undefined>(undefined);
  const [extractedBilling, setExtractedBilling] = useState<{
    closingDay: number;
    dueDay: number;
  } | null>(null);
  const [appliedBilling, setAppliedBilling] = useState<{
    closingDay: number;
    dueDay: number;
  } | null>(null);
  const [isApplyingBilling, setIsApplyingBilling] = useState(false);

  const review = useImportReview(expectedTotal);
  const [step, setStep] = useState<Step>("file");
  const [fileError, setFileError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [rules, setRules] = useState<ImportRule[]>([]);
  const [rememberEdits, setRememberEdits] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmError, setConfirmError] = useState("");
  const [partialImported, setPartialImported] = useState(0);
  const [batchId, setBatchId] = useState("");
  const [importedCount, setImportedCount] = useState(0);
  const [undone, setUndone] = useState(false);
  const [undoError, setUndoError] = useState("");
  const [isUndoing, setIsUndoing] = useState(false);
  const [isRulesDialogOpen, setIsRulesDialogOpen] = useState(false);

  const effectiveClosingDay = appliedBilling?.closingDay ?? closingDay;
  const effectiveDueDay = appliedBilling?.dueDay ?? dueDay;

  const suggestedBilling = useMemo(() => {
    if (!extractedBilling) return null;
    if (
      effectiveClosingDay === extractedBilling.closingDay &&
      effectiveDueDay === extractedBilling.dueDay
    ) {
      return null;
    }
    return extractedBilling;
  }, [extractedBilling, effectiveClosingDay, effectiveDueDay]);

  const includedRows = useMemo(
    () => getIncludedRows(review.rows),
    [review.rows],
  );
  const rulesToLearn = useMemo(
    () => (rememberEdits ? collectRulesToLearn(review.rows, rules) : []),
    [rememberEdits, review.rows, rules],
  );
  const paidRowIds = useMemo(() => {
    if (!effectiveClosingDay || !effectiveDueDay) return new Set<string>();
    return getRowIdsInPeriods(
      review.rows,
      paidPeriodKeys,
      effectiveClosingDay,
      effectiveDueDay,
    );
  }, [review.rows, paidPeriodKeys, effectiveClosingDay, effectiveDueDay]);
  const paidPeriodWarning = useMemo(() => {
    if (!effectiveClosingDay || !effectiveDueDay) return null;

    const count = countIncludedRowsInPeriods(
      review.rows,
      paidPeriodKeys,
      effectiveClosingDay,
      effectiveDueDay,
    );
    if (count === 0) return null;

    return `${count} ${count === 1 ? "lançamento pertence" : "lançamentos pertencem"} a faturas que já constam como pagas. Confira as datas antes de confirmar.`;
  }, [review.rows, paidPeriodKeys, effectiveClosingDay, effectiveDueDay]);
  const batchCanUndo = useMemo(() => {
    const batch = summarizeImportBatches(cardItems).find(
      (item) => item.batchId === batchId,
    );
    return batch ? batch.canUndo : true;
  }, [cardItems, batchId]);

  const resetAll = () => {
    review.reset();
    setExpectedTotal(undefined);
    setPeriodLabel(undefined);
    setExtractedBilling(null);
    setAppliedBilling(null);
    setIsApplyingBilling(false);
    setStep("file");
    setFileError("");
    setWarnings([]);
    setRules([]);
    setRememberEdits(true);
    setIsSaving(false);
    setConfirmError("");
    setPartialImported(0);
    setBatchId("");
    setImportedCount(0);
    setUndone(false);
    setUndoError("");
    setIsUndoing(false);
    setIsRulesDialogOpen(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    if (step === "processing" || isSaving || isUndoing) return;

    const hasWorkInProgress =
      (step === "review" || step === "confirm") && review.rows.length > 0;
    if (hasWorkInProgress && !window.confirm(DISCARD_MESSAGE)) return;

    onOpenChange(false);
    resetAll();
  };

  const handleFileSelected = async (file: File) => {
    setFileError("");
    setStep("processing");

    try {
      const buffer = await file.arrayBuffer();
      const statement = await parseStatementFile(file.name, buffer);

      if (statement.entries.length === 0) {
        throw new Error("Não encontrei lançamentos neste arquivo.");
      }

      const nextWarnings = [...statement.warnings];
      let loadedRules: ImportRule[] = [];
      try {
        loadedRules = await getImportRules();
      } catch (error) {
        console.error("Error loading import rules:", error);
        nextWarnings.push(
          "Não foi possível carregar suas regras aprendidas. As sugestões padrão serão usadas.",
        );
      }

      const mismatch = getBankMismatchWarning(statement, bankKey, cardName);
      if (mismatch) nextWarnings.unshift(mismatch);

      const existing = cardItems
        .filter((item) => item.card === cardName)
        .map((item) => ({
          date: item.date,
          amount: item.amount,
          description: item.description,
          importKey: item.importKey,
          importExternalId: item.importExternalId,
        }));

      setRules(loadedRules);
      setWarnings(nextWarnings);
      setExpectedTotal(statement.expectedTotal);
      setPeriodLabel(statement.periodLabel);
      setExtractedBilling(
        statement.closingDay && statement.dueDay
          ? { closingDay: statement.closingDay, dueDay: statement.dueDay }
          : null,
      );
      review.load(
        createReviewState(statement.entries, { rules: loadedRules, existing }),
      );
      setStep("review");
    } catch (error) {
      setFileError(
        error instanceof Error
          ? error.message
          : "Não foi possível ler o arquivo.",
      );
      setStep("file");
    }
  };

  const handleApplySuggestedBilling = async () => {
    if (!suggestedBilling || isApplyingBilling) return;

    setIsApplyingBilling(true);
    try {
      await updateUserCreditCardBilling(bankKey, suggestedBilling);
      setAppliedBilling(suggestedBilling);
      await onImported();
    } catch (error) {
      console.error("Error applying suggested billing days:", error);
    } finally {
      setIsApplyingBilling(false);
    }
  };

  const learnRules = async () => {
    let currentRules = rules;

    for (const input of rulesToLearn) {
      try {
        const saved = await saveImportRule(input, currentRules);
        currentRules = [
          ...currentRules.filter((rule) => rule.id !== saved.id),
          saved,
        ];
      } catch (error) {
        console.error("Error saving import rule:", error);
        break;
      }
    }

    setRules(currentRules);
  };

  const handleConfirm = async () => {
    if (isSaving) return;

    setIsSaving(true);
    setConfirmError("");

    const currentBatchId = batchId || createImportBatchId();
    setBatchId(currentBatchId);

    try {
      const result = await importCardTransactions({
        rows: includedRows.slice(partialImported),
        card: cardName,
        batchId: currentBatchId,
      });
      const totalImported = partialImported + result.importedCount;

      if (result.errorMessage) {
        setPartialImported(totalImported);
        setConfirmError(
          `Foram adicionadas ${totalImported} de ${includedRows.length} compras. ${result.errorMessage}. Tente novamente para concluir.`,
        );
        await onImported();
        return;
      }

      await learnRules();
      await onImported();
      setImportedCount(totalImported);
      setStep("result");
    } catch (error) {
      setConfirmError(
        error instanceof Error
          ? error.message
          : "Não foi possível adicionar os lançamentos.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleUndo = async () => {
    if (isUndoing || !batchId) return;

    setIsUndoing(true);
    setUndoError("");

    try {
      await deleteCardImportBatch(batchId);
      await onImported();
      setUndone(true);
    } catch (error) {
      setUndoError(
        error instanceof Error
          ? error.message
          : "Não foi possível desfazer a importação.",
      );
    } finally {
      setIsUndoing(false);
    }
  };

  const canContinue =
    review.blockingErrors.size === 0 && review.summary.includedCount > 0;

  const descriptions: Record<Step, string> = {
    file: "Envie o arquivo da fatura mensal para adicionar as compras de uma vez.",
    processing: "Lendo o arquivo...",
    review:
      "Confira as compras antes de adicionar. Você pode corrigir nome, data, valor e categoria.",
    confirm: "Revise o resumo e confirme a importação.",
    result: "Importação concluída.",
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Importar fatura do {cardName}</DialogTitle>
          <DialogDescription>{descriptions[step]}</DialogDescription>
        </DialogHeader>

        {step === "file" || step === "processing" ? (
          <>
            <FileStep
              cardName={cardName}
              error={fileError}
              disabled={step === "processing"}
              onFileSelected={handleFileSelected}
              onManageRules={() => setIsRulesDialogOpen(true)}
            />
            {step === "processing" ? (
              <p className="flex items-center justify-center gap-2 text-sm text-[#64748B] dark:text-[#94A3BB]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando arquivo...
              </p>
            ) : null}
          </>
        ) : null}

        {step === "review" ? (
          <ReviewStep
            review={review}
            warnings={warnings}
            rememberEdits={rememberEdits}
            onRememberEditsChange={setRememberEdits}
            paidPeriodWarning={paidPeriodWarning}
            paidRowIds={paidRowIds}
            periodLabel={periodLabel}
            suggestedBilling={suggestedBilling}
            isApplyingBilling={isApplyingBilling}
            onApplySuggestedBilling={handleApplySuggestedBilling}
            onManageRules={() => setIsRulesDialogOpen(true)}
          />
        ) : null}

        {step === "confirm" ? (
          <ConfirmStep
            cardName={cardName}
            includedCount={review.summary.includedCount}
            ignoredCount={review.summary.ignoredCount}
            total={review.summary.total}
            learnedHint={rulesToLearn.length > 0}
            paidPeriodWarning={paidPeriodWarning}
            errorMessage={confirmError}
          />
        ) : null}

        {step === "result" ? (
          <ResultStep
            importedCount={importedCount}
            undone={undone}
            canUndo={batchCanUndo}
            undoError={undoError}
          />
        ) : null}

        <DialogFooter>
          {step === "file" || step === "processing" ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={step === "processing"}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
          ) : null}

          {step === "review" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => setStep("confirm")}
                disabled={!canContinue}
                className="w-full sm:w-auto"
              >
                Continuar
              </Button>
            </>
          ) : null}

          {step === "confirm" ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("review")}
                disabled={isSaving || partialImported > 0}
                className="w-full sm:w-auto"
              >
                Voltar à revisão
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={isSaving}
                className="w-full sm:w-auto"
              >
                {isSaving
                  ? "Adicionando..."
                  : partialImported > 0
                    ? "Tentar novamente"
                    : "Adicionar à fatura"}
              </Button>
            </>
          ) : null}

          {step === "result" ? (
            <>
              {!undone && batchCanUndo ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleUndo}
                  disabled={isUndoing}
                  className="w-full sm:w-auto"
                >
                  {isUndoing ? "Desfazendo..." : "Desfazer importação"}
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="w-full sm:w-auto"
              >
                Concluir
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
      <ImportRulesDialog
        open={isRulesDialogOpen}
        onOpenChange={setIsRulesDialogOpen}
        initialRules={rules}
        onRulesChange={setRules}
      />
    </Dialog>
  );
};
