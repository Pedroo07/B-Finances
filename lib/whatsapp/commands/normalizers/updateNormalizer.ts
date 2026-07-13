import { findCreditCardNameInText } from "@/lib/creditCards/catalog";
import {
  extractMoney,
  MONEY_VALUE_PATTERN,
  parseMoney,
} from "../../utils/moneyParser";
import type { BFinanceCommand } from "../types";

export type NormalizedUpdateField =
  | "description"
  | "amount"
  | "date"
  | "category"
  | "paymentMethod";

export type ExtractedUpdatePayload = {
  field: NormalizedUpdateField | null;
  value: string | number | null;
  reference: "recent" | "latest" | null;
  targetText: string;
};

type UpdateParts = {
  field: NormalizedUpdateField | null;
  targetText: string;
  valueText: string;
};

const UPDATE_PREFIX =
  /^\s*(?:(?:por\s+favor|favor)[,;:\s]*)?(?:(?:quero|gostaria\s+de|preciso|pode|poderia|consegue)\s+)?(?:que\s+(?:voc[eê]\s+)?)?(?:altere|alterar|altera|atualize|atualizar|atualiza|mude|mudar|muda|corrija|corrigir|edite|editar|edita|troque|trocar|troca)\b[\s,:;-]*/iu;

const FIELD_PATTERNS: Array<{
  field: NormalizedUpdateField;
  pattern: RegExp;
}> = [
  {
    field: "paymentMethod",
    pattern:
      /^(?:(?:o|a)\s+)?(?:(?:m[eé]todo|forma)\s+(?:de\s+)?pagamento|meio\s+de\s+pagamento)\b[\s,:;-]*/iu,
  },
  {
    field: "description",
    pattern: /^(?:(?:a|o)\s+)?(?:descri[cç][aã]o|nome)\b[\s,:;-]*/iu,
  },
  {
    field: "amount",
    pattern: /^(?:(?:o|a)\s+)?(?:valor|pre[cç]o|quantia)\b[\s,:;-]*/iu,
  },
  {
    field: "date",
    pattern: /^(?:(?:a|o)\s+)?(?:data|dia)\b[\s,:;-]*/iu,
  },
  {
    field: "category",
    pattern: /^(?:(?:a|o)\s+)?categoria\b[\s,:;-]*/iu,
  },
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanTargetText(value: string): string {
  return value
    .trim()
    .replace(/^[,;:\s-]+|[,;:\s-]+$/g, "")
    .replace(/^(?:d[oa]s?|n[oa]s?|de|em)\s+/iu, "")
    .replace(/^(?:minha?s?|meus?|suas?)\s+/iu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function cleanValueText(value: string): string {
  return value
    .trim()
    .replace(/^[,;:\s-]+|[,;:\s-]+$/g, "")
    .replace(/^[“”"']+|[“”"']+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findLastValueSeparator(value: string): RegExpExecArray | null {
  const matcher = /\b(?:para|por)\b/giu;
  let lastMatch: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(value))) lastMatch = match;
  return lastMatch;
}

function extractUpdateParts(messageText: string): UpdateParts | null {
  const prefix = UPDATE_PREFIX.exec(messageText);
  if (!prefix) return null;

  let body = messageText.slice(prefix[0].length).trim();
  let field: NormalizedUpdateField | null = null;

  for (const candidate of FIELD_PATTERNS) {
    const fieldMatch = candidate.pattern.exec(body);
    if (!fieldMatch) continue;
    field = candidate.field;
    body = body.slice(fieldMatch[0].length).trim();
    break;
  }

  const separator = findLastValueSeparator(body);
  const targetRaw = separator ? body.slice(0, separator.index) : body;
  const valueRaw = separator
    ? body.slice(separator.index + separator[0].length)
    : "";

  return {
    field,
    targetText: cleanTargetText(targetRaw),
    valueText: cleanValueText(valueRaw),
  };
}

function referenceForTarget(targetText: string): "recent" | "latest" | null {
  if (!targetText) return "recent";
  return /\b(?:ultim[oa]s?|mais\s+recente)\b/.test(normalizeText(targetText))
    ? "latest"
    : null;
}

function valueForField(
  field: NormalizedUpdateField | null,
  valueText: string,
): string | number | null {
  if (!valueText) return null;
  if (field === "amount") return extractMoney(valueText)?.value ?? null;
  return valueText;
}

function normalizeExistingValue(
  field: NormalizedUpdateField | null,
  value: string | number | null | undefined,
): string | number | null {
  if (value === null || value === undefined) return null;
  if (field !== "amount") return value;
  return parseMoney(value);
}

export function extractUpdatePayload(
  messageText: string,
): ExtractedUpdatePayload | null {
  const parts = extractUpdateParts(messageText);
  if (!parts) return null;

  return {
    field: parts.field,
    value: valueForField(parts.field, parts.valueText),
    reference: referenceForTarget(parts.targetText),
    targetText: parts.targetText,
  };
}

function sameMoney(left: unknown, right: number): boolean {
  const parsed =
    typeof left === "number" || typeof left === "string"
      ? parseMoney(left)
      : null;
  return parsed !== null && Math.abs(parsed - right) < 0.005;
}

function removeNewValueFromSearch(
  command: BFinanceCommand,
  field: NormalizedUpdateField | null,
  value: string | number | null,
): BFinanceCommand {
  if (value === null || !field) return command;

  const filters = command.filters ? { ...command.filters } : undefined;
  const data = command.data ? { ...command.data } : undefined;
  const scope = command.scope ? { ...command.scope } : undefined;

  if (field === "amount" && typeof value === "number") {
    for (const key of ["amount", "minAmount", "maxAmount"] as const) {
      if (filters && sameMoney(filters[key], value)) delete filters[key];
    }
    if (data && sameMoney(data.amount, value)) delete data.amount;
  }

  if (field === "description") {
    if (filters) delete filters.description;
    if (data) delete data.description;
  }

  if (field === "category") {
    if (filters) delete filters.category;
    if (data) delete data.category;
  }

  if (field === "date" && data) {
    delete data.date;
  }

  if (field === "paymentMethod") {
    if (scope) {
      scope.cardName = null;
      scope.paymentMethod = null;
      scope.excludePaymentMethod = null;
    }
    if (data) {
      delete data.cardName;
      delete data.paymentMethod;
    }
  }

  return {
    ...command,
    ...(field === "date" ? { period: undefined } : {}),
    ...(filters ? { filters } : {}),
    ...(data ? { data } : {}),
    ...(scope ? { scope } : {}),
  };
}

function inferTransactionType(
  targetText: string,
): BFinanceCommand["transactionType"] | null {
  const normalized = normalizeText(targetText);
  if (/\b(despesa|gasto|compra|saida)\b/.test(normalized)) return "expense";
  if (/\b(receita|ganho|entrada)\b/.test(normalized)) return "income";
  return null;
}

function descriptionFromTarget(targetText: string): string | null {
  const cardName = findCreditCardNameInText(targetText);
  let normalized = normalizeText(targetText);
  if (!normalized) return null;

  if (cardName) {
    normalized = normalized.replace(normalizeText(cardName), " ");
  }
  normalized = normalized
    .replace(/\b\d{4}-\d{1,2}-\d{1,2}\b/g, " ")
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, " ")
    .replace(
      new RegExp(`(?:r\\$|rs)?\\s*${MONEY_VALUE_PATTERN}`, "g"),
      " ",
    )
    .replace(/\b(?:cartao(?:\s+de\s+credito)?|credito|fatura)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const ignoredWords = new Set([
    "a",
    "as",
    "da",
    "das",
    "de",
    "despesa",
    "despesas",
    "do",
    "dos",
    "entrada",
    "entradas",
    "gasto",
    "gastos",
    "item",
    "itens",
    "lancamento",
    "lancamentos",
    "mais",
    "meu",
    "meus",
    "minha",
    "minhas",
    "movimentacao",
    "movimentacoes",
    "o",
    "os",
    "em",
    "na",
    "nas",
    "no",
    "nos",
    "receita",
    "receitas",
    "recente",
    "saida",
    "saidas",
    "transacao",
    "transacoes",
    "ultima",
    "ultimas",
    "ultimo",
    "ultimos",
  ]);
  const temporalWords = new Set([
    "amanha",
    "ano",
    "atual",
    "dia",
    "dias",
    "hoje",
    "mes",
    "ontem",
    "passada",
    "passado",
    "semana",
  ]);
  const words = normalized
    .split(" ")
    .filter((word) => !ignoredWords.has(word) && !temporalWords.has(word));
  const description = words.join(" ").trim();
  return description.length > 1 ? description : null;
}

function addTargetDescriptionFilter(
  command: BFinanceCommand,
  targetText: string,
  reference: "recent" | "latest" | null,
): BFinanceCommand {
  if (reference !== null) return command;

  const filters = command.filters;
  const hasUsefulFilter = Boolean(
    filters?.description ||
    filters?.category ||
    (filters?.amount !== undefined && filters.amount !== null) ||
    (filters?.minAmount !== undefined && filters.minAmount !== null) ||
    (filters?.maxAmount !== undefined && filters.maxAmount !== null),
  );
  if (hasUsefulFilter) return command;

  const exactTargetAmount = parseMoney(targetText);
  if (exactTargetAmount !== null) {
    return {
      ...command,
      filters: {
        ...filters,
        amount: Math.abs(exactTargetAmount),
      },
    };
  }

  const description = descriptionFromTarget(targetText);
  if (!description) return command;

  return {
    ...command,
    filters: {
      ...filters,
      description,
    },
  };
}

export function normalizeCommandUpdate(
  messageText: string,
  command: BFinanceCommand,
): BFinanceCommand {
  const parts = extractUpdateParts(messageText);
  const existingUpdate = command.update;

  if (!parts && command.action !== "update") return command;

  const field = parts?.field ?? existingUpdate?.field ?? null;
  const targetText = parts?.targetText ?? existingUpdate?.targetText ?? "";
  const value = parts
    ? valueForField(field, parts.valueText)
    : normalizeExistingValue(field, existingUpdate?.value);
  const reference = parts
    ? referenceForTarget(targetText)
    : (existingUpdate?.reference ?? referenceForTarget(targetText));

  const cleaned = addTargetDescriptionFilter(
    removeNewValueFromSearch(command, field, value),
    targetText,
    reference,
  );
  const inferredType = inferTransactionType(targetText);

  return {
    ...cleaned,
    action: "update",
    resource:
      cleaned.resource === "card_transaction"
        ? "card_transaction"
        : "transaction",
    transactionType: inferredType ?? cleaned.transactionType ?? "all",
    update: {
      field,
      value,
      reference,
      targetText,
    },
  };
}
