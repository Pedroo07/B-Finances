import type { ImportedEntryKind, ParsedEntry } from "./types.ts";

const PAYMENT_PATTERN =
  /^(pagamento (recebido|efetuado|em\b|da fatura|de fatura)|cr[eé]dito de (atraso|rotativo)|saldo (em atraso|financiado))/i;
const FEE_PATTERN = /\b(juros|iof|multa|encargos?|mora|anuidade)\b/i;
const INSTALLMENT_PATTERN =
  /\s*[-–]?\s*parc(?:ela|\.)?\s+(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\s*$/i;

export function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeForMatch(value: string): string {
  return collapseSpaces(
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " "),
  )
    .split(" ")
    .filter((token) => token && !/\d/.test(token))
    .join(" ");
}

export function parseAmount(value: string): number | null {
  const cleaned = value
    .replace(/[\u2212\u2013]/g, "-")
    .replace(/R\$/gi, "")
    .replace(/\s+/g, "");

  if (!/^[-+]?[\d.,]+$/.test(cleaned)) return null;

  const negative = cleaned.startsWith("-");
  const digits = cleaned.replace(/^[-+]/, "");
  const normalized = digits.includes(",")
    ? digits.replace(/\./g, "").replace(",", ".")
    : digits;
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) return null;

  const rounded = Math.round(parsed * 100) / 100;
  return negative && rounded !== 0 ? -rounded : rounded;
}

export function parseDateToIso(value: string): string | null {
  const text = value.trim();
  let year: number;
  let month: number;
  let day: number;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  const brMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  const compactMatch = /^(\d{4})(\d{2})(\d{2})/.exec(text);

  if (isoMatch) {
    year = Number(isoMatch[1]);
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else if (brMatch) {
    day = Number(brMatch[1]);
    month = Number(brMatch[2]);
    year = Number(brMatch[3]);
  } else if (compactMatch) {
    year = Number(compactMatch[1]);
    month = Number(compactMatch[2]);
    day = Number(compactMatch[3]);
  } else {
    return null;
  }

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function extractInstallment(description: string): {
  description: string;
  installmentNumber?: number;
  installmentCount?: number;
} {
  const match = INSTALLMENT_PATTERN.exec(description);
  if (!match) return { description };

  const installmentNumber = Number(match[1]);
  const installmentCount = Number(match[2]);

  if (
    installmentCount < 2 ||
    installmentNumber < 1 ||
    installmentNumber > installmentCount
  ) {
    return { description };
  }

  return {
    description: description.slice(0, match.index).trim(),
    installmentNumber,
    installmentCount,
  };
}

export function classifyEntry(
  description: string,
  amount: number,
): ImportedEntryKind {
  if (PAYMENT_PATTERN.test(description.trim())) return "payment";
  if (amount < 0) return "refund";
  if (FEE_PATTERN.test(description)) return "fee";
  return "purchase";
}

export function buildParsedEntry(input: {
  date: string;
  rawDescription: string;
  amount: number;
  externalId?: string;
  cardLast4?: string;
}): ParsedEntry {
  const rawDescription = collapseSpaces(input.rawDescription);
  const installment = extractInstallment(rawDescription);
  const description = installment.description || rawDescription;

  return {
    date: input.date,
    description,
    rawDescription,
    amount: input.amount,
    kind: classifyEntry(rawDescription, input.amount),
    ...(installment.installmentNumber !== undefined && {
      installmentNumber: installment.installmentNumber,
      installmentCount: installment.installmentCount,
    }),
    ...(input.externalId && { externalId: input.externalId }),
    ...(input.cardLast4 && { cardLast4: input.cardLast4 }),
  };
}
