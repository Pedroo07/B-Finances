import { buildParsedEntry, parseAmount } from "../normalize.ts";
import type { ParsedEntry, ParsedStatement } from "../types.ts";

const ENTRY_LINE_REGEX =
  /^(\d{2})\/(\d{2})\s*(.+?)\s*([\u2212\u2013\-+]?\s*R\$\s*[\d.]+,\d{2})$/i;

const CARD_SECTION_REGEX = /^Cart[aã]o\s+.*?\[[*•·\s]*(\d{4})\]/i;

const SECTION_TOTAL_REGEX = /^Total\s*R\$\s*([\d.]+,\d{2})$/i;

const END_DETAILS_REGEX =
  /^(parcele a fatura|seu cart[aã]o de cr[eé]dito|compras internacionais|conhe[cç]a as op[cç][oõ]es de parcelamento)\b/i;

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
  expectedTotal?: number;
  periodLabel?: string;
} {
  const dueMatch =
    /Vencimento:\s*(\d{2})\/(\d{2})\/(\d{4})/i.exec(text) ??
    /Vence em\s+(\d{2})\/(\d{2})\/(\d{4})/i.exec(text);

  const dueDay = dueMatch ? Number(dueMatch[1]) : undefined;
  const dueMonth = dueMatch ? Number(dueMatch[2]) : undefined;
  const dueYear = dueMatch ? Number(dueMatch[3]) : undefined;

  const closingMatch = /Fechamento da fatura\s+(\d{2})\/(\d{2})\/(\d{4})/i.exec(
    text,
  );
  const periodMatch =
    /Consumos de\s+(\d{2}\/\d{2})\s+a\s+((\d{2})\/(\d{2}))\s*R\$\s*([\d.]+,\d{2})/i.exec(
      text,
    );

  const closingDay = closingMatch
    ? Number(closingMatch[1])
    : periodMatch
      ? Number(periodMatch[3])
      : undefined;

  const expectedTotal = periodMatch
    ? (parseAmount(periodMatch[5]) ?? undefined)
    : undefined;

  const periodLabel = periodMatch
    ? `${periodMatch[1]} a ${periodMatch[2]}`
    : undefined;

  return {
    dueDay,
    dueMonth,
    dueYear,
    closingDay,
    expectedTotal,
    periodLabel,
  };
}

export function parseMercadoPagoPdf(text: string): ParsedStatement {
  const metadata = extractMetadata(text);
  const referenceYear = metadata.dueYear ?? new Date().getUTCFullYear();
  const referenceMonth = metadata.dueMonth ?? 12;

  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const entries: ParsedEntry[] = [];
  const warnings: string[] = [];

  let section: "none" | "movements" | "card" = "none";
  let currentCardLast4: string | undefined;
  let cardSectionsTotal = 0;
  let hasCardSectionTotal = false;

  for (const line of lines) {
    if (/^Movimenta[cç][oõ]es na fatura$/i.test(line)) {
      section = "movements";
      currentCardLast4 = undefined;
      continue;
    }

    const cardMatch = CARD_SECTION_REGEX.exec(line);
    if (cardMatch) {
      section = "card";
      currentCardLast4 = cardMatch[1];
      continue;
    }

    if (section === "none") continue;

    if (END_DETAILS_REGEX.test(line)) {
      section = "none";
      currentCardLast4 = undefined;
      continue;
    }

    if (section === "card") {
      const totalMatch = SECTION_TOTAL_REGEX.exec(line);
      if (totalMatch) {
        const parsedTotal = parseAmount(totalMatch[1]);
        if (parsedTotal !== null) {
          cardSectionsTotal =
            Math.round((cardSectionsTotal + parsedTotal) * 100) / 100;
          hasCardSectionTotal = true;
        }
        continue;
      }
    }

    const entryMatch = ENTRY_LINE_REGEX.exec(line);
    if (!entryMatch) continue;

    const day = Number(entryMatch[1]);
    const month = Number(entryMatch[2]);
    const rawDescription = entryMatch[3].trim();
    const amount = parseAmount(entryMatch[4]);

    if (!month || !day || amount === null || !rawDescription) continue;

    const year = resolveYear(month, referenceMonth, referenceYear);
    const entry = buildParsedEntry({
      date: formatIsoDate(year, month, day),
      rawDescription,
      amount,
      ...(section === "card" &&
        currentCardLast4 && { cardLast4: currentCardLast4 }),
    });

    if (section === "movements" && entry.kind === "purchase") {
      entry.kind = /pagamento|cr[eé]dito/i.test(rawDescription)
        ? "payment"
        : "fee";
    }

    entries.push(entry);
  }

  const expectedTotal = hasCardSectionTotal
    ? cardSectionsTotal
    : metadata.expectedTotal;

  return {
    source: "pdf",
    accountKind: "credit-card",
    bankHint: "Mercado Pago",
    ...(expectedTotal !== undefined && { expectedTotal }),
    ...(metadata.closingDay !== undefined && {
      closingDay: metadata.closingDay,
    }),
    ...(metadata.dueDay !== undefined && { dueDay: metadata.dueDay }),
    ...(metadata.periodLabel && { periodLabel: metadata.periodLabel }),
    entries,
    warnings,
  };
}
