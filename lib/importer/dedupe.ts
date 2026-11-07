import { normalizeForMatch } from "./normalize.ts";
import type { ParsedEntry } from "./types.ts";

export type ExistingCardTransaction = {
  date: string;
  amount: number;
  description: string;
  importKey?: string;
  importExternalId?: string;
};

export type DuplicateReason = "imported-before" | "matches-existing";

function toCents(amount: number): number {
  return Math.round(Math.abs(amount) * 100);
}

export function buildEntryFingerprint(
  entry: Pick<ParsedEntry, "date" | "amount" | "rawDescription">,
): string {
  return `${entry.date}|${toCents(entry.amount)}|${normalizeForMatch(
    entry.rawDescription,
  )}`;
}

export function buildImportKeys(entries: ParsedEntry[]): string[] {
  const occurrences = new Map<string, number>();

  return entries.map((entry) => {
    const fingerprint = buildEntryFingerprint(entry);
    const occurrence = (occurrences.get(fingerprint) ?? 0) + 1;
    occurrences.set(fingerprint, occurrence);
    return `${fingerprint}#${occurrence}`;
  });
}

export function findDuplicates(
  entries: ParsedEntry[],
  existing: ExistingCardTransaction[],
): Map<number, DuplicateReason> {
  const importedKeys = new Set<string>();
  const importedExternalIds = new Set<string>();
  const manualCounts = new Map<string, number>();

  for (const item of existing) {
    if (item.importKey) importedKeys.add(item.importKey);
    if (item.importExternalId) importedExternalIds.add(item.importExternalId);

    if (!item.importKey) {
      const fingerprint = buildEntryFingerprint({
        date: item.date,
        amount: item.amount,
        rawDescription: item.description,
      });
      manualCounts.set(fingerprint, (manualCounts.get(fingerprint) ?? 0) + 1);
    }
  }

  const keys = buildImportKeys(entries);
  const manualUsed = new Map<string, number>();
  const result = new Map<number, DuplicateReason>();

  entries.forEach((entry, index) => {
    if (
      importedKeys.has(keys[index]) ||
      (entry.externalId && importedExternalIds.has(entry.externalId))
    ) {
      result.set(index, "imported-before");
      return;
    }

    const fingerprint = buildEntryFingerprint(entry);
    const available = manualCounts.get(fingerprint) ?? 0;
    const used = manualUsed.get(fingerprint) ?? 0;

    if (used < available) {
      manualUsed.set(fingerprint, used + 1);
      result.set(index, "matches-existing");
    }
  });

  return result;
}
