import { buildImportKeys, findDuplicates } from "./dedupe.ts";
import type { DuplicateReason, ExistingCardTransaction } from "./dedupe.ts";
import { suggestCategory } from "./categorize.ts";
import {
  collapseSpaces,
  normalizeForMatch,
  parseDateToIso,
} from "./normalize.ts";
import { findMatchingRule } from "./rules.ts";
import type { ImportRule } from "./rules.ts";
import type { ImportedEntryKind, ParsedEntry } from "./types.ts";

export type ReviewValues = {
  description: string;
  date: string;
  amount: number;
  category: string;
  installmentNumber?: number;
  installmentCount?: number;
};

export type ReviewRow = {
  id: string;
  original: ParsedEntry | null;
  values: ReviewValues;
  defaults: ReviewValues;
  included: boolean;
  kind: ImportedEntryKind;
  duplicateReason?: DuplicateReason;
  ruleId?: string;
  importKey?: string;
  manual: boolean;
};

export type ReviewState = {
  rows: ReviewRow[];
  past: ReviewRow[][];
  manualCounter: number;
};

export type ReviewAction =
  | { type: "toggle"; id: string }
  | {
      type: "setIncluded";
      included: boolean;
      filter?: ImportedEntryKind | "duplicate";
    }
  | { type: "edit"; id: string; patch: Partial<ReviewValues> }
  | {
      type: "applyToSimilar";
      id: string;
      patch: Partial<Pick<ReviewValues, "description" | "category">>;
    }
  | { type: "setCategoryForIncluded"; category: string }
  | { type: "restore"; id: string }
  | { type: "addManual"; values: ReviewValues }
  | { type: "remove"; id: string }
  | { type: "undo" };

export type ReviewSummary = {
  includedCount: number;
  ignoredCount: number;
  total: number;
  expectedTotal?: number;
  difference?: number;
};

const HISTORY_LIMIT = 50;

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

export function createReviewState(
  entries: ParsedEntry[],
  options: { rules: ImportRule[]; existing: ExistingCardTransaction[] },
): ReviewState {
  const keys = buildImportKeys(entries);
  const duplicates = findDuplicates(entries, options.existing);

  const rows = entries.map((entry, index): ReviewRow => {
    const rule = findMatchingRule(options.rules, entry.rawDescription);
    const duplicateReason = duplicates.get(index);
    const values: ReviewValues = {
      description: rule?.rewriteDescription ?? entry.description,
      date: entry.date,
      amount: entry.amount,
      category: rule?.category ?? suggestCategory(entry.rawDescription),
      ...(entry.installmentNumber !== undefined && {
        installmentNumber: entry.installmentNumber,
        installmentCount: entry.installmentCount,
      }),
    };

    return {
      id: `row-${index}`,
      original: entry,
      values,
      defaults: { ...values },
      included: entry.kind === "purchase" && !duplicateReason,
      kind: entry.kind,
      ...(duplicateReason && { duplicateReason }),
      ...(rule && { ruleId: rule.id }),
      importKey: keys[index],
      manual: false,
    };
  });

  return { rows, past: [], manualCounter: 0 };
}

function commit(state: ReviewState, rows: ReviewRow[]): ReviewState {
  return {
    ...state,
    rows,
    past: [...state.past, state.rows].slice(-HISTORY_LIMIT),
  };
}

function matchesFilter(
  row: ReviewRow,
  filter: ImportedEntryKind | "duplicate" | undefined,
): boolean {
  if (!filter) return true;
  if (filter === "duplicate") return Boolean(row.duplicateReason);
  return row.kind === filter;
}

export function countSimilarRows(rows: ReviewRow[], id: string): number {
  const source = rows.find((row) => row.id === id);
  if (!source?.original) return 0;

  const key = normalizeForMatch(source.original.rawDescription);
  if (!key) return 0;

  return rows.filter(
    (row) =>
      row.id !== id &&
      row.original &&
      normalizeForMatch(row.original.rawDescription) === key,
  ).length;
}

export function countSimilarRowsOutOfSync(
  rows: ReviewRow[],
  id: string,
): number {
  const source = rows.find((row) => row.id === id);
  if (!source?.original) return 0;

  const key = normalizeForMatch(source.original.rawDescription);
  if (!key) return 0;

  return rows.filter(
    (row) =>
      row.id !== id &&
      row.original &&
      normalizeForMatch(row.original.rawDescription) === key &&
      (row.values.description !== source.values.description ||
        row.values.category !== source.values.category),
  ).length;
}

export function reviewReducer(
  state: ReviewState,
  action: ReviewAction,
): ReviewState {
  switch (action.type) {
    case "toggle":
      return commit(
        state,
        state.rows.map((row) =>
          row.id === action.id ? { ...row, included: !row.included } : row,
        ),
      );

    case "setIncluded":
      return commit(
        state,
        state.rows.map((row) =>
          matchesFilter(row, action.filter)
            ? { ...row, included: action.included }
            : row,
        ),
      );

    case "edit":
      return commit(
        state,
        state.rows.map((row) =>
          row.id === action.id
            ? { ...row, values: { ...row.values, ...action.patch } }
            : row,
        ),
      );

    case "applyToSimilar": {
      const source = state.rows.find((row) => row.id === action.id);
      if (!source?.original) return state;

      const key = normalizeForMatch(source.original.rawDescription);
      if (!key) return state;

      return commit(
        state,
        state.rows.map((row) =>
          row.original && normalizeForMatch(row.original.rawDescription) === key
            ? { ...row, values: { ...row.values, ...action.patch } }
            : row,
        ),
      );
    }

    case "setCategoryForIncluded":
      return commit(
        state,
        state.rows.map((row) =>
          row.included
            ? { ...row, values: { ...row.values, category: action.category } }
            : row,
        ),
      );

    case "restore":
      return commit(
        state,
        state.rows.map((row) =>
          row.id === action.id ? { ...row, values: { ...row.defaults } } : row,
        ),
      );

    case "addManual": {
      const counter = state.manualCounter + 1;
      const row: ReviewRow = {
        id: `manual-${counter}`,
        original: null,
        values: action.values,
        defaults: { ...action.values },
        included: true,
        kind: "purchase",
        manual: true,
      };

      return {
        ...commit(state, [...state.rows, row]),
        manualCounter: counter,
      };
    }

    case "remove":
      return commit(
        state,
        state.rows.filter((row) => !(row.id === action.id && row.manual)),
      );

    case "undo": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return { ...state, rows: previous, past: state.past.slice(0, -1) };
    }

    default:
      return state;
  }
}

export function isRowEdited(row: ReviewRow): boolean {
  const { values, defaults } = row;
  return (
    values.description !== defaults.description ||
    values.date !== defaults.date ||
    values.amount !== defaults.amount ||
    values.category !== defaults.category ||
    values.installmentNumber !== defaults.installmentNumber ||
    values.installmentCount !== defaults.installmentCount
  );
}

export function validateRow(row: ReviewRow): string[] {
  const errors: string[] = [];
  const { values } = row;

  if (collapseSpaces(values.description) === "") {
    errors.push("Informe uma descrição");
  }
  if (parseDateToIso(values.date) !== values.date) {
    errors.push("Data inválida");
  }
  if (!Number.isFinite(values.amount) || values.amount === 0) {
    errors.push("Informe um valor diferente de zero");
  }

  const { installmentNumber, installmentCount } = values;
  if (installmentNumber !== undefined || installmentCount !== undefined) {
    const valid =
      Number.isInteger(installmentNumber) &&
      Number.isInteger(installmentCount) &&
      (installmentCount as number) >= 2 &&
      (installmentNumber as number) >= 1 &&
      (installmentNumber as number) <= (installmentCount as number);
    if (!valid) errors.push("Parcela inválida");
  }

  return errors;
}

export function getBlockingErrors(rows: ReviewRow[]): Map<string, string[]> {
  const result = new Map<string, string[]>();

  for (const row of rows) {
    if (!row.included) continue;
    const errors = validateRow(row);
    if (errors.length > 0) result.set(row.id, errors);
  }

  return result;
}

export function summarizeReview(
  rows: ReviewRow[],
  expectedTotal?: number,
): ReviewSummary {
  const included = rows.filter((row) => row.included);
  const total = roundCents(
    included.reduce((sum, row) => sum + row.values.amount, 0),
  );

  return {
    includedCount: included.length,
    ignoredCount: rows.length - included.length,
    total,
    ...(expectedTotal !== undefined && {
      expectedTotal,
      difference: roundCents(total - expectedTotal),
    }),
  };
}

export function getIncludedRows(rows: ReviewRow[]): ReviewRow[] {
  return rows.filter((row) => row.included);
}
