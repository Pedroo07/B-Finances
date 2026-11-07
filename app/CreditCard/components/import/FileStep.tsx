"use client";

import React, { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { ACCEPTED_STATEMENT_EXTENSIONS } from "@/lib/importer/statementFile";
import { cn } from "@/lib/utils";

type FileStepProps = {
  cardName: string;
  error: string;
  disabled?: boolean;
  onFileSelected: (file: File) => void;
};

export const FileStep = ({
  cardName,
  error,
  disabled,
  onFileSelected,
}: FileStepProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file && !disabled) onFileSelected(file);
  };

  return (
    <div className="grid gap-3">
      <label
        htmlFor="import-statement-file"
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-border/70 px-4 py-10 text-center transition-colors hover:border-[#22C55E]/60",
          isDragging && "border-[#22C55E] bg-[#22C55E]/8",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <FileUp className="h-8 w-8 text-[#22C55E]" />
        <div>
          <p className="text-sm font-semibold text-[#0F172A] dark:text-white">
            Arraste a fatura do {cardName} aqui ou toque para escolher
          </p>
          <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3BB]">
            Formatos aceitos: {ACCEPTED_STATEMENT_EXTENSIONS.join(", ")}
          </p>
        </div>
        <input
          ref={inputRef}
          id="import-statement-file"
          type="file"
          accept={ACCEPTED_STATEMENT_EXTENSIONS.join(",")}
          className="sr-only"
          onChange={(event) => {
            handleFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      <p className="text-xs text-[#64748B] dark:text-[#94A3BB]">
        O arquivo é lido no seu dispositivo. Nada é salvo antes de você revisar
        e confirmar.
      </p>
      {error ? (
        <p
          role="alert"
          className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
};
