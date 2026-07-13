export const MONEY_VALUE_PATTERN = String.raw`(?:\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;

export type MoneyMatch = {
  raw: string;
  value: number;
  index: number;
  end: number;
};

function normalizeSeparators(value: string): string {
  const commaIndex = value.lastIndexOf(",");
  const dotIndex = value.lastIndexOf(".");

  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalSeparator = commaIndex > dotIndex ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    return value
      .replace(new RegExp(`\\${thousandsSeparator}`, "g"), "")
      .replace(decimalSeparator, ".");
  }

  const separator = commaIndex >= 0 ? "," : dotIndex >= 0 ? "." : null;
  if (!separator) return value;

  const parts = value.split(separator);
  const decimalDigits = parts.at(-1)?.length ?? 0;

  if (parts.length === 2) {
    return decimalDigits === 3 ? parts.join("") : `${parts[0]}.${parts[1]}`;
  }

  if (decimalDigits === 1 || decimalDigits === 2) {
    const decimalPart = parts.pop();
    return `${parts.join("")}.${decimalPart}`;
  }

  return parts.join("");
}

/**
 * Converte um valor monetário isolado para número, aceitando as convenções
 * brasileira e internacional. Retorna null para texto parcial ou ambíguo.
 */
export function parseMoney(value: string | number): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const compact = value
    .trim()
    .replace(/^(?:r\$|rs)\s*/i, "")
    .replace(/\s+/g, "");

  if (!new RegExp(`^[+-]?${MONEY_VALUE_PATTERN}$`).test(compact)) {
    return null;
  }

  const sign = compact.startsWith("-") ? -1 : 1;
  const unsigned = compact.replace(/^[+-]/, "");
  const parsed = Number(normalizeSeparators(unsigned)) * sign;
  return Number.isFinite(parsed) ? parsed : null;
}

/** Localiza o primeiro valor monetário completo sem confundir parte de datas. */
export function extractMoney(text: string): MoneyMatch | null {
  const matcher = new RegExp(
    `(?<![\\d.,/])(?:r\\$|rs)?\\s*([+-]?${MONEY_VALUE_PATTERN})(?![\\d.,/])`,
    "i",
  );
  const match = matcher.exec(text);
  if (!match || match.index === undefined) return null;

  const value = parseMoney(match[1]);
  if (value === null) return null;

  const valueOffset = match[0].lastIndexOf(match[1]);
  const index = match.index + valueOffset;
  return {
    raw: match[1],
    value,
    index,
    end: index + match[1].length,
  };
}
