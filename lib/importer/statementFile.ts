import { parseCsv } from "./csv.ts";
import { parseOfx } from "./ofx.ts";
import { parsePdf } from "./pdf/index.ts";
import type { ParsePdfOptions } from "./pdf/index.ts";
import type { ParsedStatement } from "./types.ts";
import { findCreditCardBankKeyInText } from "../creditCards/catalog.ts";
import type { BankKey } from "../creditCards/catalog.ts";

export const ACCEPTED_STATEMENT_EXTENSIONS = [".pdf", ".csv", ".ofx"] as const;

const BANK_HINT_ALIASES: { pattern: RegExp; bankKey: BankKey }[] = [
  { pattern: /\bnu\s+pagamentos\b|\bnubank\b/i, bankKey: "nubank" },
  { pattern: /\binter\b/i, bankKey: "inter" },
  { pattern: /\bmercado\s*pago\b/i, bankKey: "mercado_pago" },
  { pattern: /\bpicpay\b/i, bankKey: "picpay" },
  { pattern: /\bc6\b/i, bankKey: "c6bank" },
  { pattern: /\bbanco do brasil\b/i, bankKey: "bb" },
];

function getExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index < 0 ? "" : fileName.slice(index).toLowerCase();
}

function decodeText(buffer: ArrayBuffer, charset: string): string {
  return new TextDecoder(charset).decode(buffer);
}

function decodeCsv(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return decodeText(buffer, "windows-1252");
  }
}

function decodeOfx(buffer: ArrayBuffer): string {
  const header = decodeText(buffer.slice(0, 512), "windows-1252");
  const charset = /CHARSET:\s*(\S+)/i.exec(header)?.[1]?.toUpperCase();
  const encoding = /ENCODING:\s*(\S+)/i.exec(header)?.[1]?.toUpperCase();

  if (encoding === "UTF-8" || charset === "UTF-8") {
    return decodeText(buffer, "utf-8");
  }

  return decodeText(buffer, "windows-1252");
}

export async function parseStatementFile(
  fileName: string,
  buffer: ArrayBuffer,
  pdfOptions?: ParsePdfOptions,
): Promise<ParsedStatement> {
  const extension = getExtension(fileName);

  if (extension === ".csv") return parseCsv(decodeCsv(buffer));
  if (extension === ".ofx") return parseOfx(decodeOfx(buffer));
  if (extension === ".pdf") return parsePdf(buffer, pdfOptions);

  throw new Error("Formato não suportado. Envie um arquivo PDF, CSV ou OFX.");
}

export function detectStatementBank(
  statement: ParsedStatement,
): BankKey | null {
  if (!statement.bankHint) return null;

  const alias = BANK_HINT_ALIASES.find(({ pattern }) =>
    pattern.test(statement.bankHint as string),
  );
  return alias?.bankKey ?? findCreditCardBankKeyInText(statement.bankHint);
}

export function getBankMismatchWarning(
  statement: ParsedStatement,
  selectedBankKey: BankKey,
  selectedBankName: string,
): string | null {
  const detected = detectStatementBank(statement);
  if (!detected || detected === selectedBankKey) return null;

  return `Este arquivo parece ser de outro banco, mas o cartão selecionado é ${selectedBankName}. Confira antes de continuar.`;
}
