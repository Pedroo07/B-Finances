import { GoogleGenerativeAI } from "@google/generative-ai";
import { buildParsedEntry, parseAmount, parseDateToIso } from "../normalize.ts";
import type {
  ImportedEntryKind,
  ParsedEntry,
  ParsedStatement,
} from "../types.ts";

export const GEMINI_FALLBACK_WARNING =
  "Layout do PDF não reconhecido localmente. O texto extraído foi enviado a um serviço externo (Gemini) para identificar os lançamentos. Confira todos os dados na revisão.";

const VALID_KINDS = new Set<ImportedEntryKind>([
  "purchase",
  "payment",
  "fee",
  "refund",
]);

type RawGeminiEntry = {
  date?: unknown;
  description?: unknown;
  amount?: unknown;
  kind?: unknown;
  cardLast4?: unknown;
};

type RawGeminiPayload = {
  bankHint?: unknown;
  closingDay?: unknown;
  dueDay?: unknown;
  expectedTotal?: unknown;
  periodLabel?: unknown;
  entries?: unknown;
};

export function buildGeminiPdfPrompt(text: string): string {
  return [
    "Extraia os lançamentos desta fatura de cartão de crédito brasileira a partir do texto abaixo.",
    "Retorne APENAS um objeto JSON válido (sem markdown) no formato:",
    '{ "bankHint": string | null, "closingDay": number | null, "dueDay": number | null, "expectedTotal": number | null, "periodLabel": string | null, "entries": [{ "date": "YYYY-MM-DD", "description": string, "amount": number, "kind": "purchase" | "payment" | "fee" | "refund", "cardLast4": string | null }] }',
    "Regras:",
    "1. Converta todas as datas para YYYY-MM-DD inferindo o ano pelo vencimento/emissão da fatura (compras de dezembro em fatura de janeiro pertencem ao ano anterior).",
    "2. Mantenha a indicação de parcela no final da descrição quando existir (ex.: 'Loja X - Parcela 2/6').",
    "3. Use valores positivos para compras (purchase), encargos (fee) e pagamentos (payment), e negativos para estornos/créditos (refund).",
    "4. Ignore linhas de subtotal, cabeçalhos e saldos contábeis de rolagem.",
    "5. expectedTotal deve ser o total de compras/consumos do mês quando informado na fatura.",
    "",
    "Texto da fatura:",
    text.slice(0, 60000),
  ].join("\n");
}

function extractJsonObject(raw: string): string {
  const cleaned = raw
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return cleaned.slice(start, end + 1);
  }
  return cleaned;
}

function parseDayNumber(value: unknown): number | undefined {
  const num = typeof value === "number" ? value : Number(value);
  if (Number.isInteger(num) && num >= 1 && num <= 31) {
    return num;
  }
  return undefined;
}

function parseNumberOrAmount(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  }
  if (typeof value === "string") {
    return parseAmount(value);
  }
  return null;
}

export function parseGeminiPdfResponse(responseText: string): ParsedStatement {
  let payload: RawGeminiPayload;
  try {
    payload = JSON.parse(extractJsonObject(responseText)) as RawGeminiPayload;
  } catch {
    throw new Error(
      "Não foi possível interpretar os lançamentos deste PDF. Tente exportar o arquivo em CSV ou OFX.",
    );
  }

  const rawEntries = Array.isArray(payload?.entries)
    ? (payload.entries as RawGeminiEntry[])
    : [];

  const entries: ParsedEntry[] = [];
  const warnings: string[] = [GEMINI_FALLBACK_WARNING];

  rawEntries.forEach((item, index) => {
    const date =
      typeof item?.date === "string" ? parseDateToIso(item.date) : null;
    const rawDescription =
      typeof item?.description === "string" ? item.description.trim() : "";
    const amount = parseNumberOrAmount(item?.amount);

    if (!date || !rawDescription || amount === null || amount === 0) {
      warnings.push(
        `Item ${index + 1} ignorado na leitura automática: dados incompletos`,
      );
      return;
    }

    const cardLast4 =
      typeof item?.cardLast4 === "string" && /^\d{4}$/.test(item.cardLast4)
        ? item.cardLast4
        : undefined;

    const entry = buildParsedEntry({
      date,
      rawDescription,
      amount,
      cardLast4,
    });

    if (
      typeof item?.kind === "string" &&
      VALID_KINDS.has(item.kind as ImportedEntryKind) &&
      entry.kind === "purchase"
    ) {
      entry.kind = item.kind as ImportedEntryKind;
    }

    entries.push(entry);
  });

  const bankHint =
    typeof payload?.bankHint === "string" && payload.bankHint.trim() !== ""
      ? payload.bankHint.trim()
      : undefined;
  const closingDay = parseDayNumber(payload?.closingDay);
  const dueDay = parseDayNumber(payload?.dueDay);
  const parsedExpectedTotal = parseNumberOrAmount(payload?.expectedTotal);
  const expectedTotal =
    parsedExpectedTotal !== null && parsedExpectedTotal >= 0
      ? parsedExpectedTotal
      : undefined;
  const periodLabel =
    typeof payload?.periodLabel === "string" &&
    payload.periodLabel.trim() !== ""
      ? payload.periodLabel.trim()
      : undefined;

  return {
    source: "pdf",
    accountKind: "credit-card",
    ...(bankHint && { bankHint }),
    ...(expectedTotal !== undefined && { expectedTotal }),
    ...(closingDay !== undefined && { closingDay }),
    ...(dueDay !== undefined && { dueDay }),
    ...(periodLabel && { periodLabel }),
    entries,
    warnings,
  };
}

export async function generateGeminiPdfJsonOnServer(
  prompt: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Layout de PDF não reconhecido e chave do Gemini não configurada. Exporte a fatura em CSV ou OFX.",
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function requestGeminiPdfFromBrowser(text: string): Promise<string> {
  const response = await fetch("/api/importer/pdf-fallback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    rawJson?: string;
    error?: string;
  };

  if (!response.ok || !data.rawJson) {
    throw new Error(
      data.error ||
        "Não foi possível processar este layout de PDF. Exporte a fatura em CSV ou OFX.",
    );
  }

  return data.rawJson;
}

export async function parsePdfWithGemini(
  text: string,
  generateJson?: (prompt: string) => Promise<string>,
): Promise<ParsedStatement> {
  const prompt = buildGeminiPdfPrompt(text);
  const rawResponse = generateJson
    ? await generateJson(prompt)
    : typeof window === "undefined"
      ? await generateGeminiPdfJsonOnServer(prompt)
      : await requestGeminiPdfFromBrowser(text);

  return parseGeminiPdfResponse(rawResponse);
}
