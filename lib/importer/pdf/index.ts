import type { ParsedStatement } from "../types.ts";
import { detectBank } from "./detectBank.ts";
import { extractPdfText } from "./extractText.ts";
import { parsePdfWithGemini } from "./gemini.ts";
import { parseMercadoPagoPdf } from "./mercadopago.ts";
import { parseNubankPdf } from "./nubank.ts";

export type ParsePdfOptions = {
  geminiFallback?: (text: string) => Promise<ParsedStatement>;
};

export async function parsePdfText(
  text: string,
  options?: ParsePdfOptions,
): Promise<ParsedStatement> {
  const bank = detectBank(text);

  if (bank === "nubank") {
    return parseNubankPdf(text);
  }

  if (bank === "mercado_pago") {
    return parseMercadoPagoPdf(text);
  }

  const fallback = options?.geminiFallback ?? parsePdfWithGemini;
  return fallback(text);
}

export async function parsePdf(
  buffer: ArrayBuffer,
  options?: ParsePdfOptions,
): Promise<ParsedStatement> {
  const text = await extractPdfText(buffer);
  return parsePdfText(text, options);
}
