import { buildParsedEntry, parseAmount } from "../normalize.ts";
import type { ParsedEntry, ParsedStatement } from "../types.ts";

const MONTHS: Record<string, number> = {
  JAN: 1,
  FEV: 2,
  MAR: 3,
  ABR: 4,
  MAI: 5,
  JUN: 6,
  JUL: 7,
  AGO: 8,
  SET: 9,
  OUT: 10,
  NOV: 11,
  DEZ: 12,
};

const MONTH_PATTERN = "JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ";

const IGNORED_ENTRY_PATTERN =
  /^(pagamentos e financiamentos|saldo em (atraso|rotativo)|cr[eé]dito de (atraso|rotativo)|encerramento de d[ií]vida)\b/i;

const END_OF_TRANSACTIONS_PATTERN =
  /^(em cumprimento [àa] regula[cç][aã]o do banco central|como assegurado pela resolu[cç][aã]o cmn)\b/i;

const SINGLE_LINE_ENTRY_REGEX = new RegExp(
  `^(\\d{1,2})\\s+(${MONTH_PATTERN})\\s+(?:[•*·]{4}\\s*(\\d{4})\\s+)?(.+?)\\s+([\\u2212\\u2013\\-+]?\\s*R\\$\\s*[\\d.]+,\\d{2})$`,
  "i",
);

const MULTILINE_START_REGEX = new RegExp(
  `^(\\d{1,2})\\s+(${MONTH_PATTERN})\\s+(?:[•*·]{4}\\s*(\\d{4})\\s+)?(.+)$`,
  "i",
);

const STANDALONE_AMOUNT_REGEX = /^([\u2212\u2013\-+]?\s*R\$\s*[\d.]+,\d{2})$/i;

function resolveYear(
  entryMonth: number,
  referenceMonth: number,
  referenceYear: number,
): number {
  return entryMonth > referenceMonth ? referenceYear - 1 : referenceYear;
}

function formatIsoDate(year: number, month: number, day: number): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

function extractMetadata(text: string): {
  dueDay?: number;
  dueMonth?: number;
  dueYear?: number;
  closingDay?: number;
  closingMonth?: number;
  expectedTotal?: number;
  periodLabel?: string;
} {
  const dueMatch =
    /Data de vencimento:\s*(\d{1,2})\s+([A-ZÇ]{3})\s+(\d{4})/i.exec(text) ??
    /FATURA\s+(\d{1,2})\s+([A-ZÇ]{3})\s+(\d{4})/i.exec(text);

  const dueDay = dueMatch ? Number(dueMatch[1]) : undefined;
  const dueMonth = dueMatch ? MONTHS[dueMatch[2].toUpperCase()] : undefined;
  const dueYear = dueMatch ? Number(dueMatch[3]) : undefined;

  const emissionMatch =
    /EMISS[AÃ]O E ENVIO\s+(\d{1,2})\s+([A-ZÇ]{3})\s+(\d{4})/i.exec(text);
  const periodMatch =
    /Per[ií]odo vigente:\s*(\d{1,2}\s+[A-ZÇ]{3})\s+a\s+((\d{1,2})\s+([A-ZÇ]{3}))/i.exec(
      text,
    ) ??
    /TRANSA[CÇ][OÕ]ES\s+DE\s+(\d{1,2}\s+[A-ZÇ]{3})\s+A\s+((\d{1,2})\s+([A-ZÇ]{3}))/i.exec(
      text,
    );

  const closingDay = emissionMatch
    ? Number(emissionMatch[1])
    : periodMatch
      ? Number(periodMatch[3])
      : undefined;
  const closingMonth = emissionMatch
    ? MONTHS[emissionMatch[2].toUpperCase()]
    : periodMatch
      ? MONTHS[periodMatch[4].toUpperCase()]
      : undefined;

  const totalMatch = /Total de compras[^\r\n]*?R\$\s*([\d.]+,\d{2})/i.exec(
    text,
  );
  const expectedTotal = totalMatch
    ? (parseAmount(totalMatch[1]) ?? undefined)
    : undefined;

  const periodLabel = periodMatch
    ? `${periodMatch[1].toUpperCase()} a ${periodMatch[2].toUpperCase()}`
    : undefined;

  return {
    dueDay,
    dueMonth,
    dueYear,
    closingDay,
    closingMonth,
    expectedTotal,
    periodLabel,
  };
}

export function parseNubankPdf(text: string): ParsedStatement {
  const metadata = extractMetadata(text);
  const referenceYear = metadata.dueYear ?? new Date().getUTCFullYear();
  const referenceMonth = metadata.closingMonth ?? metadata.dueMonth ?? 12;

  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const entries: ParsedEntry[] = [];
  const warnings: string[] = [];

  let inTransactions = false;
  let pending: {
    day: number;
    month: number;
    cardLast4?: string;
    description: string;
  } | null = null;

  for (const line of lines) {
    if (/^TRANSA[CÇ][OÕ]ES\s+DE\s+/i.test(line)) {
      inTransactions = true;
      pending = null;
      continue;
    }

    if (!inTransactions) continue;

    if (END_OF_TRANSACTIONS_PATTERN.test(line)) {
      inTransactions = false;
      pending = null;
      continue;
    }

    if (
      /^\d+\s+de\s+\d+$/i.test(line) ||
      /^FATURA\s+\d{1,2}\s+[A-ZÇ]{3}\s+\d{4}/i.test(line)
    ) {
      continue;
    }

    const singleMatch = SINGLE_LINE_ENTRY_REGEX.exec(line);
    if (singleMatch) {
      pending = null;
      const day = Number(singleMatch[1]);
      const month = MONTHS[singleMatch[2].toUpperCase()];
      const cardLast4 = singleMatch[3];
      const rawDescription = singleMatch[4].trim();
      const amount = parseAmount(singleMatch[5]);

      if (
        !month ||
        amount === null ||
        IGNORED_ENTRY_PATTERN.test(rawDescription)
      ) {
        continue;
      }

      const year = resolveYear(month, referenceMonth, referenceYear);
      entries.push(
        buildParsedEntry({
          date: formatIsoDate(year, month, day),
          rawDescription,
          amount,
          cardLast4,
        }),
      );
      continue;
    }

    if (pending) {
      const amountMatch = STANDALONE_AMOUNT_REGEX.exec(line);
      if (amountMatch) {
        const amount = parseAmount(amountMatch[1]);
        if (
          amount !== null &&
          !IGNORED_ENTRY_PATTERN.test(pending.description)
        ) {
          const year = resolveYear(
            pending.month,
            referenceMonth,
            referenceYear,
          );
          entries.push(
            buildParsedEntry({
              date: formatIsoDate(year, pending.month, pending.day),
              rawDescription: pending.description,
              amount,
              cardLast4: pending.cardLast4,
            }),
          );
        }
        pending = null;
        continue;
      }
    }

    const multiMatch = MULTILINE_START_REGEX.exec(line);
    if (multiMatch) {
      const day = Number(multiMatch[1]);
      const month = MONTHS[multiMatch[2].toUpperCase()];
      const cardLast4 = multiMatch[3];
      const description = multiMatch[4].trim();

      if (month && !/^R\$\s*[\d.]+,\d{2}$/i.test(description)) {
        pending = { day, month, cardLast4, description };
      }
    }
  }

  return {
    source: "pdf",
    accountKind: "credit-card",
    bankHint: "Nubank",
    ...(metadata.expectedTotal !== undefined && {
      expectedTotal: metadata.expectedTotal,
    }),
    ...(metadata.closingDay !== undefined && {
      closingDay: metadata.closingDay,
    }),
    ...(metadata.dueDay !== undefined && { dueDay: metadata.dueDay }),
    ...(metadata.periodLabel && { periodLabel: metadata.periodLabel }),
    entries,
    warnings,
  };
}
