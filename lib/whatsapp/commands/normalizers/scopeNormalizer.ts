import { getCreditCardName } from "@/lib/creditCards/catalog";
import type {
  BFinanceCommand,
  BFinancePaymentMethod,
  BFinanceScope,
  CommandNormalizerContext,
} from "../types";

const CARD_NAMES = [
  "Nubank",
  "Inter",
  "PicPay",
  "BB",
  "C6",
  "Mercado Pago",
  "Bradesco",
];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function hasAny(normalized: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(normalized));
}

function extractCardName(messageText: string): string | null {
  const normalized = normalizeText(messageText);

  if (/\bmercado\s+pago\b/.test(normalized)) return "Mercado Pago";

  const card = CARD_NAMES.find((cardName) => {
    if (cardName === "Mercado Pago") return false;
    return new RegExp(`\\b${normalizeText(cardName)}\\b`).test(normalized);
  });

  return card ? getCreditCardName(card) : null;
}

function hasNegativeCardMention(normalized: string): boolean {
  return hasAny(normalized, [
    /\bsem\s+(?:cartao|credito)\b/,
    /\bexceto\s+(?:cartao|credito)\b/,
    /\btirando\s+(?:cartao|credito)\b/,
    /\bdesconsiderando\s+(?:cartao|credito)\b/,
    /\bfora\s+(?:cartao|credito)\b/,
    /\bignore\s+(?:o\s+)?(?:cartao|credito)\b/,
    /\bignorando\s+(?:o\s+)?(?:cartao|credito)\b/,
    /\bnao\s+(?:do|no|foi no|foram no)\s+(?:cartao|credito)\b/,
    /\bdespesas?\s+que\s+nao\s+foram\s+no\s+cartao\b/,
    /\bcompras?\s+que\s+nao\s+foram\s+no\s+cartao\b/,
  ]);
}

function hasPositiveCardMention(normalized: string, cardName: string | null): boolean {
  return (
    Boolean(cardName) ||
    hasAny(normalized, [
      /\bno\s+cartao\b/,
      /\bdo\s+cartao\b/,
      /\bcartao\s+\w+/,
      /\bcompras?\s+(?:no|do)\s+(?:credito|cartao)\b/,
      /\bcredito\b/,
      /\bfatura\b/,
    ])
  );
}

function extractPaymentMethod(normalized: string): BFinancePaymentMethod | null {
  if (/\b(so|somente|apenas)\s+pix\b/.test(normalized) || /\bno\s+pix\b/.test(normalized)) {
    return "pix";
  }

  if (
    /\b(so|somente|apenas)\s+(?:debito|debit)\b/.test(normalized) ||
    /\bno\s+debito\b/.test(normalized)
  ) {
    return "debit";
  }

  if (
    /\b(so|somente|apenas)\s+(?:dinheiro|cash)\b/.test(normalized) ||
    /\bno\s+dinheiro\b/.test(normalized)
  ) {
    return "cash";
  }

  if (
    /\b(so|somente|apenas)\s+(?:credito|cartao)\b/.test(normalized) ||
    /\bno\s+credito\b/.test(normalized)
  ) {
    return "credit_card";
  }

  return null;
}

function isSummaryRequest(normalized: string, command: BFinanceCommand): boolean {
  return (
    command.resource === "summary" ||
    hasAny(normalized, [
      /\bresumo\s+financeiro\b/,
      /\bcomo\s+foi\s+meu\s+mes\b/,
      /\bbalanco\b/,
      /\bminhas\s+financas\b/,
      /\bmeu\s+financeiro\b/,
    ])
  );
}

function messageLooksLikeContinuation(normalized: string): boolean {
  return (
    /^(agora|so|somente|apenas|tambem|e|ordene|ordenar|filtra|filtre)\b/.test(
      normalized,
    ) ||
    /\b(acima de|maior que|menor que|do maior|do menor)\b/.test(normalized)
  );
}

function defaultScope(command: BFinanceCommand): BFinanceScope {
  if (command.resource === "invoice" || command.resource === "card_transaction") {
    return {
      includeNormalTransactions: false,
      includeCardTransactions: true,
      cardName: command.scope?.cardName ?? command.data?.cardName ?? null,
      excludeCardTransactions: false,
      paymentMethod: "credit_card",
      excludePaymentMethod: null,
    };
  }

  if (command.action === "create" || command.action === "pay") {
    return {
      includeNormalTransactions: true,
      includeCardTransactions: false,
      cardName: command.scope?.cardName ?? command.data?.cardName ?? null,
      excludeCardTransactions: false,
      paymentMethod:
        command.scope?.paymentMethod ??
        (command.data?.paymentMethod as BFinancePaymentMethod | undefined) ??
        null,
      excludePaymentMethod: null,
    };
  }

  return {
    includeNormalTransactions: true,
    includeCardTransactions: command.action === "query",
    cardName: command.scope?.cardName ?? command.data?.cardName ?? null,
    excludeCardTransactions: false,
    paymentMethod: command.scope?.paymentMethod ?? null,
    excludePaymentMethod: command.scope?.excludePaymentMethod ?? null,
  };
}

export function normalizeCommandScope(
  messageText: string,
  command: BFinanceCommand,
  _currentDate: Date,
  context: CommandNormalizerContext = {},
): BFinanceCommand {
  const normalized = normalizeText(messageText);
  const currentCardName =
    extractCardName(messageText) ||
    command.scope?.cardName ||
    command.data?.cardName ||
    null;
  const paymentMethod = extractPaymentMethod(normalized);
  const negativeCardMention = hasNegativeCardMention(normalized);
  const positiveCardMention = hasPositiveCardMention(
    normalized,
    currentCardName,
  );
  const isContinuation = messageLooksLikeContinuation(normalized);
  const summaryRequest = isSummaryRequest(normalized, command);

  let scope: BFinanceScope =
    isContinuation && context.previousCommand?.scope
      ? { ...context.previousCommand.scope }
      : {
          ...defaultScope(command),
          ...command.scope,
        };

  if (
    command.action === "query" &&
    (command.resource === "transaction" ||
      command.resource === "card_transaction") &&
    !isContinuation &&
    !negativeCardMention &&
    !positiveCardMention &&
    !paymentMethod
  ) {
    scope = {
      includeNormalTransactions: true,
      includeCardTransactions: true,
      cardName: null,
      excludeCardTransactions: false,
      paymentMethod: null,
      excludePaymentMethod: null,
    };
  }

  if (summaryRequest) {
    scope = {
      includeNormalTransactions: true,
      includeCardTransactions: true,
      cardName: currentCardName,
      excludeCardTransactions: false,
      paymentMethod: null,
      excludePaymentMethod: null,
    };
  }

  if (paymentMethod && paymentMethod !== "credit_card") {
    scope = {
      includeNormalTransactions: true,
      includeCardTransactions: false,
      cardName: null,
      excludeCardTransactions: true,
      paymentMethod,
      excludePaymentMethod: "credit_card",
    };
  }

  if (paymentMethod === "credit_card") {
    scope = {
      includeNormalTransactions: false,
      includeCardTransactions: true,
      cardName: currentCardName,
      excludeCardTransactions: false,
      paymentMethod: "credit_card",
      excludePaymentMethod: null,
    };
  }

  if (positiveCardMention) {
    scope = {
      includeNormalTransactions: false,
      includeCardTransactions: true,
      cardName: currentCardName,
      excludeCardTransactions: false,
      paymentMethod: "credit_card",
      excludePaymentMethod: null,
    };
  }

  if (negativeCardMention) {
    scope = {
      includeNormalTransactions: true,
      includeCardTransactions: false,
      cardName: null,
      excludeCardTransactions: true,
      paymentMethod:
        paymentMethod && paymentMethod !== "credit_card" ? paymentMethod : null,
      excludePaymentMethod: "credit_card",
    };
  }

  if (command.resource === "invoice") {
    scope = {
      includeNormalTransactions: false,
      includeCardTransactions: true,
      cardName: currentCardName,
      excludeCardTransactions: false,
      paymentMethod: "credit_card",
      excludePaymentMethod: null,
    };
  }

  return {
    ...command,
    resource:
      scope.includeCardTransactions &&
      !scope.includeNormalTransactions &&
      command.resource === "transaction" &&
      positiveCardMention
        ? "card_transaction"
        : command.resource === "card_transaction" &&
            !positiveCardMention &&
            !paymentMethod
          ? "transaction"
          : command.resource,
    scope,
    data: command.data
      ? {
          ...command.data,
          cardName: command.data.cardName ?? currentCardName,
          paymentMethod:
            command.data.paymentMethod ??
            (scope.paymentMethod === "credit_card" ? "credit_card" : null),
        }
      : command.data,
  };
}
