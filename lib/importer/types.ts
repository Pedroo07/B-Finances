export type ImportedEntryKind = "purchase" | "payment" | "fee" | "refund";

export type ImportSource = "csv" | "ofx" | "pdf";

export type ParsedEntry = {
  date: string;
  description: string;
  rawDescription: string;
  amount: number;
  kind: ImportedEntryKind;
  installmentNumber?: number;
  installmentCount?: number;
  externalId?: string;
  cardLast4?: string;
};

export type ParsedStatement = {
  source: ImportSource;
  accountKind?: "credit-card" | "bank";
  bankHint?: string;
  expectedTotal?: number;
  closingDay?: number;
  dueDay?: number;
  periodLabel?: string;
  entries: ParsedEntry[];
  warnings: string[];
};
