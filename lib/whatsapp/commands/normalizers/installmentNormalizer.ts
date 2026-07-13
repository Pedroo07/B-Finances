import type { BFinanceCommand } from "../types";

const NUMBER_WORDS: Record<string, number> = {
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function toInstallmentNumber(value: string): number | null {
  if (/^\d{1,3}$/.test(value)) return Number(value);
  return NUMBER_WORDS[value] ?? null;
}

export type InstallmentMention = {
  requested: boolean;
  count: number | null;
};

export function extractInstallmentMention(messageText: string): InstallmentMention {
  const normalized = normalizeText(messageText);

  if (/\b(?:a|à)\s*vista\b/.test(normalized)) {
    return { requested: false, count: 1 };
  }

  const compactMatch = /\b(\d{1,3})\s*x\b/.exec(normalized);
  if (compactMatch) {
    return { requested: true, count: Number(compactMatch[1]) };
  }

  const installmentWord = "(?:\\d{1,3}|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze)";
  const patterns = [
    new RegExp(`\\b(?:parcelad[oa]|parcelamento|parcelei|dividid[oa]|dividi|recorrent[ea])\\s*(?:em\\s*)?(${installmentWord})\\s*(?:x|vezes|parcelas)?\\b`),
    new RegExp(`\\b(?:em\\s*)?(${installmentWord})\\s*(?:vezes|parcelas)\\b`),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(normalized);
    if (match) return { requested: true, count: toInstallmentNumber(match[1]) };
  }

  const requested = /\b(?:parcelad[oa]|parcelamento|parcelei|dividid[oa]|dividi|recorrent[ea]|parcelas)\b/.test(normalized);
  return requested ? { requested: true, count: null } : { requested: false, count: 1 };
}

export function normalizeCommandInstallments(
  messageText: string,
  command: BFinanceCommand,
): BFinanceCommand {
  if (command.action !== "create" || command.transactionType === "income") {
    return command;
  }

  const installment = extractInstallmentMention(messageText);
  return {
    ...command,
    data: {
      ...command.data,
      installmentCount: installment.count,
      installmentRequested: installment.requested,
    },
  };
}
