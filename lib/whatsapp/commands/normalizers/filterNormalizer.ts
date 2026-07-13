import type {
  BFinanceCommand,
  BFinanceFilters,
  BFinanceOrderBy,
  BFinanceTransactionType,
  CommandNormalizerContext,
} from "../types";
import { getCreditCardBankKey } from "@/lib/creditCards/catalog";
import { CATEGORY_ALIASES } from "@/lib/whatsapp/categories";
import { MONEY_VALUE_PATTERN, parseMoney } from "../../utils/moneyParser";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function messageLooksLikeContinuation(normalized: string): boolean {
  return (
    /^(agora|so|somente|apenas|tambem|e|ordene|ordenar|filtra|filtre)\b/.test(
      normalized,
    ) || /\b(acima de|maior que|menor que|do maior|do menor)\b/.test(normalized)
  );
}

function extractLimit(normalized: string): number | null {
  const match =
    normalized.match(/\bultim[oa]s?\s+(\d{1,3})\b/) ||
    normalized.match(
      /\blist[ae]?\s+(?:meus|minhas|as|os|todos|todas)?\s*(\d{1,3})\b/,
    ) ||
    normalized.match(
      /\b(\d{1,3})\s+(?:transacoes|gastos|despesas|receitas|ganhos|lucros|compras)\b/,
    );

  if (!match) return null;

  const limit = Number(match[1]);
  return Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : null;
}

function extractMoneyAfter(pattern: RegExp, normalized: string): number | null {
  const match = normalized.match(pattern);
  if (!match) return null;
  return parseMoney(match[1]);
}

function extractAmountFilters(normalized: string): Partial<BFinanceFilters> {
  const filters: Partial<BFinanceFilters> = {};

  const minAmount =
    extractMoneyAfter(
      new RegExp(
        `\\b(?:acima de|maior que|mais que|a partir de)\\s*(?:r\\$|rs)?\\s*(${MONEY_VALUE_PATTERN})(?![\\d.,])`,
      ),
      normalized,
    ) ??
    extractMoneyAfter(
      new RegExp(
        `\\b(?:os|as)?\\s*(?:acima|maiores)\\s+de\\s*(?:r\\$|rs)?\\s*(${MONEY_VALUE_PATTERN})(?![\\d.,])`,
      ),
      normalized,
    );

  const maxAmount =
    extractMoneyAfter(
      new RegExp(
        `\\b(?:abaixo de|menor que|menos que|ate)\\s*(?:r\\$|rs)?\\s*(${MONEY_VALUE_PATTERN})(?![\\d.,])`,
      ),
      normalized,
    ) ??
    extractMoneyAfter(
      new RegExp(
        `\\b(?:os|as)?\\s*(?:abaixo|menores)\\s+de\\s*(?:r\\$|rs)?\\s*(${MONEY_VALUE_PATTERN})(?![\\d.,])`,
      ),
      normalized,
    );

  const exactAmount = extractMoneyAfter(
    new RegExp(
      `\\b(?:de|no valor de)\\s*(?:r\\$|rs)?\\s*(${MONEY_VALUE_PATTERN})(?![\\d.,])`,
    ),
    normalized,
  );

  if (minAmount !== null) filters.minAmount = minAmount;
  if (maxAmount !== null) filters.maxAmount = maxAmount;
  if (
    exactAmount !== null &&
    minAmount === null &&
    maxAmount === null &&
    /\b(valor|exatamente|igual)\b/.test(normalized)
  ) {
    filters.amount = exactAmount;
  }

  return filters;
}

function extractOrder(normalized: string): BFinanceOrderBy | null {
  if (
    /\b(maior\s+para\s+o\s+menor|maiores\s+primeiro|valor\s+desc)\b/.test(
      normalized,
    )
  ) {
    return "amount_desc";
  }

  if (
    /\b(menor\s+para\s+o\s+maior|menores\s+primeiro|valor\s+asc)\b/.test(
      normalized,
    )
  ) {
    return "amount_asc";
  }

  if (/\b(mais\s+antig[oa]s?|data\s+asc)\b/.test(normalized)) {
    return "date_asc";
  }

  if (/\b(mais\s+recentes?|ultim[oa]s?|data\s+desc)\b/.test(normalized)) {
    return "date_desc";
  }

  return null;
}

function extractCategory(normalized: string): string | null {
  return (
    CATEGORY_ALIASES.find(({ terms }) =>
      terms.some((term) => new RegExp(`\\b${term}\\b`).test(normalized)),
    )?.category ?? null
  );
}

function extractDescription(normalized: string): string | null {
  const cleanText = normalized.replace(/[?.!,;:]+$/g, "");
  const match =
    cleanText.match(/\b(?:com|no|na|do|da)\s+([a-z0-9][a-z0-9\s]{1,40})$/) ||
    cleanText.match(/\bdescricao\s+([a-z0-9][a-z0-9\s]{1,40})$/);

  if (!match) return null;

  const rawDescription = match[1].trim();

  if (/\b(cartao|credito|fatura)\b/.test(rawDescription)) {
    return null;
  }

  const description = rawDescription
    .replace(
      /\b(o|a|os|as|mes|passado|passada|este|esse|atual|hoje|ontem|ultimos?|dias?|ano|semana|cartao|credito|fatura|pix|debito|dinheiro)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();

  if (
    getCreditCardBankKey(description) ||
    /\b(cartao|credito|fatura)\b/.test(description)
  ) {
    return null;
  }

  return description.length > 1 ? description : null;
}

function inferTransactionType(
  normalized: string,
): BFinanceTransactionType | null {
  if (
    /\b(gasto|gastos|gastei|despesa|despesas|compra|compras|paguei|saidas?)\b/.test(
      normalized,
    )
  ) {
    return "expense";
  }

  if (
    /\b(receita|receitas|entrada|entradas|lucro|lucros|ganho|ganhos|recebi|ganhei|entrou)\b/.test(
      normalized,
    )
  ) {
    return "income";
  }

  if (
    /\b(transacao|transacoes|lancamentos?|movimentacoes?)\b/.test(normalized)
  ) {
    return "all";
  }

  return null;
}

function shouldCarryPreviousCommand(normalized: string): boolean {
  return messageLooksLikeContinuation(normalized);
}

export function normalizeCommandFilters(
  messageText: string,
  command: BFinanceCommand,
  _currentDate: Date,
  context: CommandNormalizerContext = {},
): BFinanceCommand {
  const normalized = normalizeText(messageText);
  const carryPrevious = shouldCarryPreviousCommand(normalized);
  const previous = context.previousCommand;
  const carriedFilters =
    carryPrevious && previous?.filters ? { ...previous.filters } : {};

  const limit = extractLimit(normalized);
  const category = extractCategory(normalized);
  const description = extractDescription(normalized);
  const orderBy = extractOrder(normalized);
  const amountFilters = extractAmountFilters(normalized);
  const inferredTransactionType = inferTransactionType(normalized);

  const filters: BFinanceFilters = {
    ...carriedFilters,
    ...command.filters,
    ...amountFilters,
  };

  if (limit !== null) {
    filters.limit = limit;
    filters.orderBy = filters.orderBy ?? "date_desc";
  }

  if (category) filters.category = category;
  if (description && !filters.description) filters.description = description;
  if (orderBy) filters.orderBy = orderBy;
  if (!filters.orderBy) filters.orderBy = "date_desc";

  const nextCommand: BFinanceCommand =
    carryPrevious && previous && previous.action === "query"
      ? {
          ...previous,
          ...command,
          action:
            command.action === "clarify" ? previous.action : command.action,
          resource:
            command.action === "clarify" ? previous.resource : command.resource,
          operation:
            command.action === "clarify"
              ? previous.operation
              : (command.operation ?? previous.operation),
          transactionType:
            inferredTransactionType ??
            command.transactionType ??
            previous.transactionType,
          period: command.period ?? previous.period,
          scope: command.scope ?? previous.scope,
          filters,
          confidence: Math.max(command.confidence, previous.confidence),
        }
      : {
          ...command,
          transactionType:
            inferredTransactionType ?? command.transactionType ?? "all",
          filters,
        };

  if (!nextCommand.operation) {
    nextCommand.operation =
      nextCommand.action === "query" &&
      (/\bquanto\b/.test(normalized) || /\btotal\b/.test(normalized))
        ? "total"
        : "list";
  }

  return nextCommand;
}
