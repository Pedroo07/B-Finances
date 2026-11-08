export type SupportedPdfBank = "nubank" | "mercado_pago";

const NUBANK_PATTERNS = [
  /\bnu\s+pagamentos\s+s\.?a\.?\b/i,
  /\b18\.236\.120\/0001-58\b/,
  /\bfatura\s+\d{1,2}\s+[a-zç]{3}\s+\d{4}\s+emiss[aã]o\s+e\s+envio\b/i,
  /\btransa[cç][oõ]es\s+de\s+\d{1,2}\s+[a-zç]{3}\s+a\s+\d{1,2}\s+[a-zç]{3}\b/i,
];

const MERCADO_PAGO_PATTERNS = [
  /\bpague\s+sua\s+fatura\s+pelo\s+app\s+mercado\s+pago\b/i,
  /\bcart[aã]o\s+de\s+cr[eé]dito\s+mercado\s+pago\b/i,
  /\bdetalhes\s+de\s+consumo[\s\S]*movimenta[cç][oõ]es\s+na\s+fatura\b/i,
];

export function detectBank(text: string): SupportedPdfBank | null {
  if (NUBANK_PATTERNS.some((pattern) => pattern.test(text))) {
    return "nubank";
  }

  if (MERCADO_PAGO_PATTERNS.some((pattern) => pattern.test(text))) {
    return "mercado_pago";
  }

  return null;
}
