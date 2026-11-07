import { buildParsedEntry, parseAmount, parseDateToIso } from "./normalize.ts";
import type { ParsedEntry, ParsedStatement } from "./types.ts";

const DATE_HEADERS = ["date", "data"];
const DESCRIPTION_HEADERS = [
  "title",
  "description",
  "descricao",
  "lancamento",
  "historico",
  "estabelecimento",
  "memo",
  "name",
];
const AMOUNT_HEADERS = ["amount", "valor", "value"];

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function findColumn(headers: string[], candidates: string[]): number {
  const exact = headers.findIndex((header) => candidates.includes(header));
  if (exact >= 0) return exact;

  return headers.findIndex((header) =>
    candidates.some((candidate) => header.startsWith(candidate)),
  );
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return semicolons > commas ? ";" : ",";
}

function splitRecords(text: string, delimiter: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records.filter((row) => row.some((cell) => cell.trim() !== ""));
}

export function parseCsv(content: string): ParsedStatement {
  const text = content.replace(/^\uFEFF/, "");
  const records = splitRecords(text, detectDelimiter(text));

  if (records.length === 0) {
    throw new Error("O arquivo CSV está vazio");
  }

  const headers = records[0].map(normalizeHeader);
  const dateColumn = findColumn(headers, DATE_HEADERS);
  const descriptionColumn = findColumn(headers, DESCRIPTION_HEADERS);
  const amountColumn = findColumn(headers, AMOUNT_HEADERS);

  if (dateColumn < 0 || descriptionColumn < 0 || amountColumn < 0) {
    throw new Error(
      "Não encontrei as colunas de data, descrição e valor no CSV",
    );
  }

  const entries: ParsedEntry[] = [];
  const warnings: string[] = [];

  records.slice(1).forEach((row, rowIndex) => {
    const lineNumber = rowIndex + 2;
    const date = parseDateToIso(row[dateColumn] ?? "");
    const amount = parseAmount(row[amountColumn] ?? "");
    const description = (row[descriptionColumn] ?? "").trim();

    if (!date || amount === null || !description) {
      warnings.push(
        `Linha ${lineNumber} ignorada: dados incompletos ou inválidos`,
      );
      return;
    }

    entries.push(
      buildParsedEntry({ date, rawDescription: description, amount }),
    );
  });

  return { source: "csv", entries, warnings };
}
