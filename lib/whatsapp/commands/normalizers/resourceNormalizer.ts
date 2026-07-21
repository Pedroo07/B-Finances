import { findCreditCardNameInText } from "@/lib/creditCards/catalog";
import type { BFinanceCommand } from "../types";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function normalizeCommandResource(
  messageText: string,
  command: BFinanceCommand,
): BFinanceCommand {
  if (command.action !== "query") return command;

  const normalized = normalizeText(messageText);
  if (!/\bfaturas?\b/.test(normalized)) return command;

  const requestsInvoiceItems =
    /\b(gastos?|despesas?|compras?|itens?|lancamentos?|transacoes?)\b/.test(
      normalized,
    );

  if (requestsInvoiceItems) {
    return {
      ...command,
      resource: "card_transaction",
      operation: "list",
      transactionType: "expense",
    };
  }

  const explicitCardName = findCreditCardNameInText(messageText);

  return {
    ...command,
    resource: "invoice",
    operation: /\bfaturas\b/.test(normalized) ? "list" : "detail",
    transactionType: "all",
    scope: {
      includeNormalTransactions: false,
      includeCardTransactions: true,
      cardName: explicitCardName,
      excludeCardTransactions: false,
      paymentMethod: "credit_card",
      excludePaymentMethod: null,
    },
    data: command.data
      ? {
          ...command.data,
          cardName: explicitCardName,
        }
      : command.data,
  };
}
