import type {
  BFinanceCommand,
  BFinancePeriod,
  BFinancePeriodType,
  CommandNormalizerContext,
} from "../types";

const MONTHS = [
  { month: 1, names: ["janeiro", "jan"] },
  { month: 2, names: ["fevereiro", "fev"] },
  { month: 3, names: ["marco", "mar"] },
  { month: 4, names: ["abril", "abr"] },
  { month: 5, names: ["maio", "mai"] },
  { month: 6, names: ["junho", "jun"] },
  { month: 7, names: ["julho", "jul"] },
  { month: 8, names: ["agosto", "ago"] },
  { month: 9, names: ["setembro", "set"] },
  { month: 10, names: ["outubro", "out"] },
  { month: 11, names: ["novembro", "nov"] },
  { month: 12, names: ["dezembro", "dez"] },
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}

function endOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0);
}

function startOfWeek(date: Date): Date {
  return addDays(date, -date.getDay());
}

function fullMonthPeriod(
  raw: string | null,
  type: BFinancePeriodType,
  year: number,
  month: number,
): BFinancePeriod {
  return {
    raw,
    type,
    startDate: formatDate(startOfMonth(year, month)),
    endDate: formatDate(endOfMonth(year, month)),
    month,
    year,
    days: null,
    isExplicit: true,
  };
}

function yearPeriod(
  raw: string | null,
  type: BFinancePeriodType,
  year: number,
  currentDate: Date,
): BFinancePeriod {
  const isCurrentYear = year === currentDate.getFullYear();
  return {
    raw,
    type,
    startDate: `${year}-01-01`,
    endDate: isCurrentYear ? formatDate(currentDate) : `${year}-12-31`,
    month: null,
    year,
    days: null,
    isExplicit: true,
  };
}

function allPeriod(raw: string | null = null, isExplicit = false): BFinancePeriod {
  return {
    raw,
    type: "all",
    startDate: null,
    endDate: null,
    month: null,
    year: null,
    days: null,
    isExplicit,
  };
}

function currentInvoicePeriod(
  raw: string | null = "fatura atual",
  isExplicit = true,
): BFinancePeriod {
  return {
    raw,
    type: "current_invoice",
    startDate: null,
    endDate: null,
    month: null,
    year: null,
    days: null,
    isExplicit,
  };
}

function hasExplicitPeriod(normalized: string): boolean {
  return (
    /\b(hoje|ontem|anteontem)\b/.test(normalized) ||
    /\b(essa|esta|atual|passad[oa]|proxim[oa]|ultim[oa]s?)\s+(semana|mes|ano|dias?)\b/.test(
      normalized,
    ) ||
    /\b(mes|ano)\s+(passad[oa]|atual)\b/.test(normalized) ||
    /\b(ano todo|este ano|esse ano)\b/.test(normalized) ||
    /\b(fatura atual|fatura aberta|compras da fatura|gastos da fatura)\b/.test(normalized) ||
    /\b(todo o historico|historico completo|todo o periodo|periodo todo|desde o inicio|desde o comeco)\b/.test(normalized) ||
    /\bem\s+\d{4}\b/.test(normalized) ||
    /\bmes\s+(?:de\s+)?(?:0?[1-9]|1[0-2])(?:\s*[/-]\s*(?:19|20)\d{2})?\b/.test(
      normalized,
    ) ||
    /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(normalized) ||
    MONTHS.some(({ names }) =>
      names.some((name) => new RegExp(`\\b${name}\\b`).test(normalized)),
    )
  );
}

function hasAllHistoryRequest(normalized: string): boolean {
  return /\b(todo o historico|historico completo|todo o periodo|periodo todo|desde o inicio|desde o comeco)\b/.test(
    normalized,
  );
}

function messageLooksLikeContinuation(normalized: string): boolean {
  return (
    /^(agora|so|somente|apenas|tambem|e|ordene|ordenar|filtra|filtre)\b/.test(
      normalized,
    ) ||
    /\b(acima de|maior que|menor que|do maior|do menor)\b/.test(normalized)
  );
}

function extractLimitRequest(normalized: string): number | undefined {
  const match =
    normalized.match(
      /\bultim[oa]s?\s+(\d{1,3})\s+(?:transacoes|gastos|despesas|receitas|ganhos|lucros|compras)\b/,
    ) ||
    normalized.match(
      /\b(?:transacoes|gastos|despesas|receitas|ganhos|lucros|compras)\s+ultim[oa]s?\s+(\d{1,3})\b/,
    );

  if (!match) return undefined;

  const limit = Number(match[1]);
  return Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : undefined;
}

function extractRollingDays(normalized: string): number | undefined {
  const match = normalized.match(/\bultim[oa]s?\s+(\d{1,3})\s+dias?\b/);
  if (!match) return undefined;

  const days = Number(match[1]);
  return Number.isFinite(days) && days > 0 ? Math.min(days, 3650) : undefined;
}

function extractSpecificYear(normalized: string): number | undefined {
  const match = normalized.match(/\b(?:em\s+)?(20\d{2}|19\d{2})\b/);
  if (!match) return undefined;

  const year = Number(match[1]);
  return Number.isFinite(year) ? year : undefined;
}

function extractMonth(normalized: string): number | undefined {
  return MONTHS.find(({ names }) =>
    names.some((name) => new RegExp(`\\b${name}\\b`).test(normalized)),
  )?.month;
}

function extractNumericMonth(
  normalized: string,
): { month: number; year?: number } | undefined {
  const match = normalized.match(
    /\bmes\s+(?:de\s+)?(0?[1-9]|1[0-2])(?:\s*[/-]\s*((?:19|20)\d{2}))?\b/,
  );
  if (!match) return undefined;

  const month = Number(match[1]);
  const year = match[2] ? Number(match[2]) : undefined;
  return { month, year };
}

function parseExplicitDate(
  dayText: string,
  monthText: string,
  yearText: string | undefined,
  currentDate: Date,
): Date | null {
  const day = Number(dayText);
  const month = Number(monthText);
  const year = yearText
    ? Number(yearText.length === 2 ? `20${yearText}` : yearText)
    : currentDate.getFullYear();
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function explicitDateRangePeriod(
  normalized: string,
  currentDate: Date,
): BFinancePeriod | null {
  const match =
    normalized.match(
      /\b(?:de|da data|do dia)?\s*(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\s+(?:ate|a|ao)\s+(?:a\s+data\s+)?(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/,
    ) ||
    normalized.match(
      /\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\s+(?:ate|a|ao)\s+(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/,
    );

  if (!match) return null;

  const start = parseExplicitDate(match[1], match[2], match[3], currentDate);
  const end = parseExplicitDate(
    match[4],
    match[5],
    match[6] ?? match[3],
    currentDate,
  );

  if (!start || !end) return null;

  const startText = formatDate(start);
  const endText = formatDate(end);
  const orderedStart = startText <= endText ? startText : endText;
  const orderedEnd = startText <= endText ? endText : startText;

  return {
    raw: match[0],
    type: "date_range",
    startDate: orderedStart,
    endDate: orderedEnd,
    month: null,
    year: null,
    days: null,
    isExplicit: true,
  };
}

function explicitDatePeriod(
  normalized: string,
  currentDate: Date,
): BFinancePeriod | null {
  const match = normalized.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (!match) return null;

  const date = parseExplicitDate(match[1], match[2], match[3], currentDate);
  if (!date) return null;

  const dateText = formatDate(date);
  return {
    raw: match[0],
    type: "today",
    startDate: dateText,
    endDate: dateText,
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    days: null,
    isExplicit: true,
  };
}

function inferPeriodFromMessage(
  messageText: string,
  currentDate: Date,
): BFinancePeriod | null {
  const normalized = normalizeText(messageText);
  if (hasAllHistoryRequest(normalized)) {
    return allPeriod("todo o historico", true);
  }

  if (/\b(fatura atual|fatura aberta|compras da fatura|gastos da fatura)\b/.test(normalized)) {
    return currentInvoicePeriod();
  }

  const dateRangePeriod = explicitDateRangePeriod(normalized, currentDate);
  if (dateRangePeriod) return dateRangePeriod;

  const datePeriod = explicitDatePeriod(normalized, currentDate);
  if (datePeriod) return datePeriod;

  const rollingDays = extractRollingDays(normalized);
  if (rollingDays) {
    return {
      raw: `ultimos ${rollingDays} dias`,
      type: "last_n_days",
      startDate: formatDate(addDays(currentDate, -(rollingDays - 1))),
      endDate: formatDate(currentDate),
      month: null,
      year: null,
      days: rollingDays,
      isExplicit: true,
    };
  }

  if (/\bmes\s+passad[oa]\b/.test(normalized)) {
    const previousMonthDate = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() - 1,
      1,
    );
    return fullMonthPeriod(
      "mes passado",
      "last_month",
      previousMonthDate.getFullYear(),
      previousMonthDate.getMonth() + 1,
    );
  }

  if (/\bano\s+passad[oa]\b/.test(normalized)) {
    return yearPeriod(
      "ano passado",
      "last_year",
      currentDate.getFullYear() - 1,
      currentDate,
    );
  }

  if (/\b(ano todo|este ano|esse ano|ano atual)\b/.test(normalized)) {
    return yearPeriod(
      "este ano",
      "current_year",
      currentDate.getFullYear(),
      currentDate,
    );
  }

  const numericMonth = extractNumericMonth(normalized);
  if (numericMonth) {
    const year = numericMonth.year || currentDate.getFullYear();
    const isCurrentMonth =
      numericMonth.month === currentDate.getMonth() + 1 &&
      year === currentDate.getFullYear();
    return fullMonthPeriod(
      `mes ${String(numericMonth.month).padStart(2, "0")}`,
      isCurrentMonth ? "current_month" : "specific_month",
      year,
      numericMonth.month,
    );
  }

  const specificYear = extractSpecificYear(normalized);
  if (specificYear && /\b(ano|em)\b/.test(normalized)) {
    return yearPeriod(
      String(specificYear),
      specificYear === currentDate.getFullYear()
        ? "current_year"
        : "specific_year",
      specificYear,
      currentDate,
    );
  }

  if (/\b(esse mes|este mes|mes atual|agora neste mes|agora esse mes)\b/.test(normalized)) {
    return fullMonthPeriod(
      "mes atual",
      "current_month",
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
    );
  }

  const month = extractMonth(normalized);
  if (month) {
    const year = specificYear || currentDate.getFullYear();
    const isCurrentMonth =
      month === currentDate.getMonth() + 1 && year === currentDate.getFullYear();
    return fullMonthPeriod(
      MONTHS[month - 1].names[0],
      isCurrentMonth ? "current_month" : "specific_month",
      year,
      month,
    );
  }

  if (/\b(semana\s+passad[oa]|ultima\s+semana)\b/.test(normalized)) {
    const thisWeekStart = startOfWeek(currentDate);
    const lastWeekStart = addDays(thisWeekStart, -7);
    return {
      raw: "semana passada",
      type: "last_week",
      startDate: formatDate(lastWeekStart),
      endDate: formatDate(addDays(lastWeekStart, 6)),
      month: null,
      year: null,
      days: null,
      isExplicit: true,
    };
  }

  if (/\b(proxima\s+semana|semana\s+que\s+vem)\b/.test(normalized)) {
    const thisWeekStart = startOfWeek(currentDate);
    const nextWeekStart = addDays(thisWeekStart, 7);
    return {
      raw: "proxima semana",
      type: "next_week",
      startDate: formatDate(nextWeekStart),
      endDate: formatDate(addDays(nextWeekStart, 6)),
      month: null,
      year: null,
      days: null,
      isExplicit: true,
    };
  }

  if (/\b(essa semana|esta semana|semana atual|dessa semana|da semana)\b/.test(normalized)) {
    const thisWeekStart = startOfWeek(currentDate);
    return {
      raw: "esta semana",
      type: "current_week",
      startDate: formatDate(thisWeekStart),
      endDate: formatDate(addDays(thisWeekStart, 6)),
      month: null,
      year: null,
      days: null,
      isExplicit: true,
    };
  }

  if (/\bontem\b/.test(normalized)) {
    const date = addDays(currentDate, -1);
    return {
      raw: "ontem",
      type: "yesterday",
      startDate: formatDate(date),
      endDate: formatDate(date),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      days: null,
      isExplicit: true,
    };
  }

  if (/\bhoje\b/.test(normalized)) {
    const date = currentDate;
    return {
      raw: "hoje",
      type: "today",
      startDate: formatDate(date),
      endDate: formatDate(date),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      days: null,
      isExplicit: true,
    };
  }

  return null;
}

function normalizeExistingPeriod(
  period: BFinancePeriod | undefined,
  currentDate: Date,
): BFinancePeriod {
  if (!period) return allPeriod();

  switch (period.type) {
    case "last_month": {
      const previousMonthDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - 1,
        1,
      );
      return fullMonthPeriod(
        period.raw ?? "mes passado",
        "last_month",
        previousMonthDate.getFullYear(),
        previousMonthDate.getMonth() + 1,
      );
    }
    case "current_month":
      return fullMonthPeriod(
        period.raw ?? "mes atual",
        "current_month",
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
      );
    case "specific_month":
      return fullMonthPeriod(
        period.raw ?? null,
        "specific_month",
        period.year || currentDate.getFullYear(),
        period.month || currentDate.getMonth() + 1,
      );
    case "current_year":
      return yearPeriod(
        period.raw ?? "este ano",
        "current_year",
        currentDate.getFullYear(),
        currentDate,
      );
    case "last_year":
      return yearPeriod(
        period.raw ?? "ano passado",
        "last_year",
        currentDate.getFullYear() - 1,
        currentDate,
      );
    case "specific_year":
      return yearPeriod(
        period.raw ?? null,
        "specific_year",
        period.year || currentDate.getFullYear(),
        currentDate,
      );
    case "last_n_days": {
      const days = Math.max(1, Math.min(Number(period.days) || 30, 3650));
      return {
        raw: period.raw ?? `ultimos ${days} dias`,
        type: "last_n_days",
        startDate: formatDate(addDays(currentDate, -(days - 1))),
        endDate: formatDate(currentDate),
        month: null,
        year: null,
        days,
        isExplicit: period.isExplicit,
      };
    }
    case "today":
      return {
        raw: period.raw ?? "hoje",
        type: "today",
        startDate: formatDate(currentDate),
        endDate: formatDate(currentDate),
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        days: null,
        isExplicit: period.isExplicit,
      };
    case "yesterday": {
      const yesterday = addDays(currentDate, -1);
      return {
        raw: period.raw ?? "ontem",
        type: "yesterday",
        startDate: formatDate(yesterday),
        endDate: formatDate(yesterday),
        month: yesterday.getMonth() + 1,
        year: yesterday.getFullYear(),
        days: null,
        isExplicit: period.isExplicit,
      };
    }
    case "current_week": {
      const thisWeekStart = startOfWeek(currentDate);
      return {
        raw: period.raw ?? "esta semana",
        type: "current_week",
        startDate: formatDate(thisWeekStart),
        endDate: formatDate(addDays(thisWeekStart, 6)),
        month: null,
        year: null,
        days: null,
        isExplicit: period.isExplicit,
      };
    }
    case "last_week": {
      const thisWeekStart = startOfWeek(currentDate);
      const lastWeekStart = addDays(thisWeekStart, -7);
      return {
        raw: period.raw ?? "semana passada",
        type: "last_week",
        startDate: formatDate(lastWeekStart),
        endDate: formatDate(addDays(lastWeekStart, 6)),
        month: null,
        year: null,
        days: null,
        isExplicit: period.isExplicit,
      };
    }
    case "next_week": {
      const thisWeekStart = startOfWeek(currentDate);
      const nextWeekStart = addDays(thisWeekStart, 7);
      return {
        raw: period.raw ?? "proxima semana",
        type: "next_week",
        startDate: formatDate(nextWeekStart),
        endDate: formatDate(addDays(nextWeekStart, 6)),
        month: null,
        year: null,
        days: null,
        isExplicit: period.isExplicit,
      };
    }
    case "date_range":
      return {
        ...period,
        startDate: period.startDate ?? null,
        endDate: period.endDate ?? null,
        month: null,
        year: null,
        days: null,
        isExplicit: Boolean(period.isExplicit),
      };
    case "current_invoice":
      return currentInvoicePeriod(period.raw ?? "fatura atual", period.isExplicit);
    case "all":
      return {
        ...period,
        startDate: period.startDate ?? null,
        endDate: period.endDate ?? null,
        month: period.month ?? null,
        year: period.year ?? null,
        days: period.days ?? null,
        isExplicit: Boolean(period.isExplicit),
      };
    default:
      return allPeriod();
  }
}

export function normalizeCommandPeriod(
  messageText: string,
  command: BFinanceCommand,
  currentDate: Date,
  context: CommandNormalizerContext = {},
): BFinanceCommand {
  const normalized = normalizeText(messageText);
  const inferred = inferPeriodFromMessage(messageText, currentDate);
  const limitRequest = extractLimitRequest(normalized);
  const periodIsExplicit = hasExplicitPeriod(normalized);
  const isContinuation = messageLooksLikeContinuation(normalized);
  const previousPeriod = context.previousCommand?.period;

  let period: BFinancePeriod;

  if (limitRequest && !periodIsExplicit) {
    period = allPeriod(null, false);
  } else if (inferred) {
    period = inferred;
  } else if (isContinuation && previousPeriod) {
    period = normalizeExistingPeriod(previousPeriod, currentDate);
  } else if (command.period?.isExplicit) {
    period = normalizeExistingPeriod(command.period, currentDate);
  } else if (command.resource === "summary") {
    period = fullMonthPeriod(
      "mes atual",
      "current_month",
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
    );
  } else {
    period = allPeriod(command.period?.raw ?? null, false);
  }

  const filters = {
    ...command.filters,
  };

  if (limitRequest && !periodIsExplicit) {
    filters.limit = limitRequest;
    filters.orderBy = "date_desc";
  }

  return {
    ...command,
    period,
    filters,
  };
}
