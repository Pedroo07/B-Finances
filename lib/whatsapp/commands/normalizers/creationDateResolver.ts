import {
  formatBrasiliaDate,
  getBrasiliaDate,
} from "../../utils/brasiliaDate";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validDate(year: number, month: number, day: number): string | null {
  const candidate = new Date(year, month - 1, day);
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }
  return formatLocalDate(candidate);
}

function parseExplicitNumericDate(
  messageText: string,
  currentYear: number,
): string | null {
  const iso = messageText.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const brazilian = messageText.match(
    /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/,
  );
  if (!brazilian) return null;
  const rawYear = brazilian[3];
  const year = rawYear
    ? Number(rawYear.length === 2 ? `20${rawYear}` : rawYear)
    : currentYear;
  return validDate(year, Number(brazilian[2]), Number(brazilian[1]));
}

function validModelDate(value?: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match
    ? validDate(Number(match[1]), Number(match[2]), Number(match[3]))
    : null;
}

function relativeDate(now: Date, offsetInDays: number): string {
  const brasiliaDate = getBrasiliaDate(now);
  brasiliaDate.setDate(brasiliaDate.getDate() + offsetInDays);
  return formatLocalDate(brasiliaDate);
}

/**
 * Resolve a data de uma nova transação sem confiar no dia UTC inferido pelo
 * modelo. Na ausência de referência explícita, sempre usa o dia de Brasília.
 */
export function resolveCreationDate(
  messageText: string,
  modelDate?: string | null,
  now = new Date(),
): string {
  const normalized = normalizeText(messageText);
  if (/\banteontem\b/.test(normalized)) return relativeDate(now, -2);
  if (/\bontem\b/.test(normalized)) return relativeDate(now, -1);
  if (/\bamanha\b/.test(normalized)) return relativeDate(now, 1);
  if (/\bhoje\b/.test(normalized)) return formatBrasiliaDate(now);

  const brasiliaDate = getBrasiliaDate(now);
  const explicitNumericDate = parseExplicitNumericDate(
    messageText,
    brasiliaDate.getFullYear(),
  );
  if (explicitNumericDate) return explicitNumericDate;

  const hasNaturalDateReference =
    /\b(?:segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:-feira)?\b/.test(
      normalized,
    ) ||
    /\b(?:janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/.test(
      normalized,
    ) ||
    /\bdia\s+\d{1,2}\b/.test(normalized);

  if (hasNaturalDateReference) {
    const normalizedModelDate = validModelDate(modelDate);
    if (normalizedModelDate) return normalizedModelDate;
  }

  return formatBrasiliaDate(now);
}
