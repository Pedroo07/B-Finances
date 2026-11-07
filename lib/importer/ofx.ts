import { buildParsedEntry, parseDateToIso } from "./normalize.ts";
import type { ParsedEntry, ParsedStatement } from "./types.ts";

const TRANSACTION_PATTERN = /<STMTTRN>([\s\S]*?)(?=<\/STMTTRN>|<STMTTRN>|$)/gi;

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}

function readTag(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i").exec(block);
  if (!match) return null;

  const value = decodeEntities(match[1]).trim();
  return value === "" ? null : value;
}

export function parseOfx(content: string): ParsedStatement {
  const text = content.replace(/^\uFEFF/, "");

  if (!/<OFX>/i.test(text) || !/<STMTTRN>/i.test(text)) {
    throw new Error("O arquivo não parece ser um OFX válido com transações");
  }

  const entries: ParsedEntry[] = [];
  const warnings: string[] = [];
  const seenExternalIds = new Set<string>();
  let blockIndex = 0;

  for (const match of text.matchAll(TRANSACTION_PATTERN)) {
    blockIndex++;
    const block = match[1];
    const date = parseDateToIso(readTag(block, "DTPOSTED") ?? "");
    const rawAmount = readTag(block, "TRNAMT");
    const parsedAmount = rawAmount === null ? NaN : Number(rawAmount);
    const description = readTag(block, "MEMO") ?? readTag(block, "NAME");

    if (!date || !Number.isFinite(parsedAmount) || !description) {
      warnings.push(
        `Transação ${blockIndex} ignorada: dados incompletos ou inválidos`,
      );
      continue;
    }

    const externalId = readTag(block, "FITID") ?? undefined;
    if (externalId) {
      if (seenExternalIds.has(externalId)) {
        warnings.push(
          `Transação ${blockIndex} ignorada: identificador repetido no arquivo`,
        );
        continue;
      }
      seenExternalIds.add(externalId);
    }

    const amount = Math.round(-parsedAmount * 100) / 100;

    entries.push(
      buildParsedEntry({
        date,
        rawDescription: description,
        amount: amount === 0 ? 0 : amount,
        externalId,
      }),
    );
  }

  return {
    source: "ofx",
    accountKind: /<CREDITCARDMSGSRSV1>/i.test(text) ? "credit-card" : "bank",
    bankHint: readTag(text, "ORG") ?? undefined,
    entries,
    warnings,
  };
}
