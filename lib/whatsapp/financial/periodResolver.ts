import type { PeriodType, ResolvedPeriod } from "./types";

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const MONTH_ALIASES: Record<string, number> = {
  janeiro: 0,
  fevereiro: 1,
  marco: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

type ResolvePeriodInput = {
  messageText: string;
  currentDate: Date;
  fallbackPeriod?: ResolvedPeriod | null;
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function localDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  const next = localDate(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(
    date.getDate(),
  )}`;
}

function startOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1);
}

function endOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex + 1, 0);
}

function startOfWeek(date: Date): Date {
  const dayFromMonday = (date.getDay() + 6) % 7;
  return addDays(date, -dayFromMonday);
}

function buildPeriod(
  type: PeriodType,
  start: Date,
  end: Date,
  label: string,
  isExplicit: boolean,
  sourceText?: string,
): ResolvedPeriod {
  return {
    type,
    startDate: formatDate(start),
    endDate: formatDate(end),
    label,
    isExplicit,
    sourceText,
  };
}

function currentMonthPeriod(currentDate: Date, isExplicit: boolean): ResolvedPeriod {
  const today = localDate(currentDate);
  return buildPeriod(
    "current_month",
    startOfMonth(today.getFullYear(), today.getMonth()),
    today,
    "Mes atual",
    isExplicit,
  );
}

function currentYearPeriod(currentDate: Date, isExplicit: boolean): ResolvedPeriod {
  const today = localDate(currentDate);
  return buildPeriod(
    "current_year",
    new Date(today.getFullYear(), 0, 1),
    today,
    "Este ano",
    isExplicit,
  );
}

function monthPeriod(
  year: number,
  monthIndex: number,
  currentDate: Date,
  isExplicit: boolean,
): ResolvedPeriod {
  const today = localDate(currentDate);
  const isCurrentMonth =
    year === today.getFullYear() && monthIndex === today.getMonth();
  const end = isCurrentMonth ? today : endOfMonth(year, monthIndex);

  return buildPeriod(
    "specific_month",
    startOfMonth(year, monthIndex),
    end,
    `${MONTHS[monthIndex]}/${year}`,
    isExplicit,
  );
}

function yearPeriod(
  year: number,
  currentDate: Date,
  isExplicit: boolean,
): ResolvedPeriod {
  const today = localDate(currentDate);
  const isCurrentYear = year === today.getFullYear();
  const end = isCurrentYear ? today : new Date(year, 11, 31);

  return buildPeriod(
    isCurrentYear ? "current_year" : "specific_year",
    new Date(year, 0, 1),
    end,
    isCurrentYear ? "Este ano" : `Ano de ${year}`,
    isExplicit,
  );
}

export function previousComparablePeriod(period: ResolvedPeriod): ResolvedPeriod {
  const start = parseLocalDate(period.startDate);
  const end = parseLocalDate(period.endDate);

  if (
    period.type === "current_month" ||
    period.type === "last_month" ||
    period.type === "specific_month"
  ) {
    const previousMonthStart = startOfMonth(
      start.getFullYear(),
      start.getMonth() - 1,
    );
    const previousMonthEnd = endOfMonth(
      previousMonthStart.getFullYear(),
      previousMonthStart.getMonth(),
    );
    return buildPeriod(
      "specific_month",
      previousMonthStart,
      previousMonthEnd,
      `${MONTHS[previousMonthStart.getMonth()]}/${previousMonthStart.getFullYear()}`,
      true,
    );
  }

  if (
    period.type === "current_year" ||
    period.type === "last_year" ||
    period.type === "specific_year"
  ) {
    const previousYear = start.getFullYear() - 1;
    return buildPeriod(
      "specific_year",
      new Date(previousYear, 0, 1),
      new Date(previousYear, 11, 31),
      `Ano de ${previousYear}`,
      true,
    );
  }

  const days = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86400000) + 1,
  );
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(days - 1));

  return buildPeriod(
    "last_n_days",
    previousStart,
    previousEnd,
    "Periodo anterior",
    true,
  );
}

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function resolveFinancialPeriod({
  messageText,
  currentDate,
  fallbackPeriod,
}: ResolvePeriodInput): ResolvedPeriod {
  const normalized = normalizeText(messageText);
  const today = localDate(currentDate);
  const sourceText = messageText;

  if (
    fallbackPeriod &&
    /^(passad[oa]|anterior)$/.test(normalized)
  ) {
    return {
      ...previousComparablePeriod(fallbackPeriod),
      isExplicit: true,
      sourceText,
    };
  }

  const monthMatch = normalized.match(
    /\b(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)(?:\s+de\s+(\d{4}))?\b/,
  );
  if (monthMatch) {
    const monthIndex = MONTH_ALIASES[monthMatch[1]];
    const year = monthMatch[2] ? Number(monthMatch[2]) : today.getFullYear();
    return {
      ...monthPeriod(year, monthIndex, today, true),
      sourceText,
    };
  }

  const lastDaysMatch = normalized.match(
    /\bultim[oa]s?\s+(\d{1,3})\s+dias?\b/,
  );
  if (lastDaysMatch) {
    const days = Math.max(1, Number(lastDaysMatch[1]));
    return buildPeriod(
      "last_n_days",
      addDays(today, -(days - 1)),
      today,
      `Ultimos ${days} dias`,
      true,
      sourceText,
    );
  }

  if (/\b(hoje|today)\b/.test(normalized)) {
    return buildPeriod("today", today, today, "Hoje", true, sourceText);
  }

  if (/\b(ontem|yesterday)\b/.test(normalized)) {
    const yesterday = addDays(today, -1);
    return buildPeriod(
      "yesterday",
      yesterday,
      yesterday,
      "Ontem",
      true,
      sourceText,
    );
  }

  if (/\b(semana passada|ultima semana|last week)\b/.test(normalized)) {
    const start = addDays(startOfWeek(today), -7);
    return buildPeriod(
      "last_week",
      start,
      addDays(start, 6),
      "Semana passada",
      true,
      sourceText,
    );
  }

  if (/\b(essa semana|esta semana|semana atual|week|semana)\b/.test(normalized)) {
    const start = startOfWeek(today);
    return buildPeriod(
      "current_week",
      start,
      today,
      "Esta semana",
      true,
      sourceText,
    );
  }

  if (/\b(mes passado|ultimo mes|last_month|last month)\b/.test(normalized)) {
    const start = startOfMonth(today.getFullYear(), today.getMonth() - 1);
    return buildPeriod(
      "last_month",
      start,
      endOfMonth(start.getFullYear(), start.getMonth()),
      "Mes passado",
      true,
      sourceText,
    );
  }

  if (/\b(mes atual|este mes|esse mes|month|mes)\b/.test(normalized)) {
    return {
      ...currentMonthPeriod(today, true),
      sourceText,
    };
  }

  if (/\b(ano passado|ultimo ano|last year)\b/.test(normalized)) {
    const year = today.getFullYear() - 1;
    return buildPeriod(
      "last_year",
      new Date(year, 0, 1),
      new Date(year, 11, 31),
      `Ano de ${year}`,
      true,
      sourceText,
    );
  }

  const explicitYearMatch = normalized.match(/\b(?:ano\s+de|em|de)\s+(\d{4})\b/);
  if (explicitYearMatch) {
    return {
      ...yearPeriod(Number(explicitYearMatch[1]), today, true),
      sourceText,
    };
  }

  if (/\b(este ano|esse ano|ano atual|ano todo|year|ano)\b/.test(normalized)) {
    return {
      ...currentYearPeriod(today, true),
      sourceText,
    };
  }

  if (fallbackPeriod) {
    return {
      ...fallbackPeriod,
      isExplicit: false,
    };
  }

  return currentMonthPeriod(today, false);
}

export function formatPeriodForLog(period: ResolvedPeriod): string {
  return `${period.label} (${period.startDate} a ${period.endDate})`;
}
