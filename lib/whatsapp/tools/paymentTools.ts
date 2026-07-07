import { IntentType } from "../intents/intentTypes";
import { handlePayment } from "../handlers/paymentHandler";
import type { Tool } from "./types";
import { CREDIT_CARD_NAMES, CREDIT_CARD_NAMES_TEXT } from "@/lib/creditCards/catalog";

export const payBillTool: Tool<string> = {
  name: "pay_bill",
  description: "Registra o pagamento de uma conta pendente.",
  parameters: [
    {
      name: "description",
      description: "Descricao ou palavra-chave da conta que foi paga.",
      required: true,
    },
  ],
  requiredParameters: ["description"],
  execute: ({ userId, parameters = {} }) =>
    handlePayment(userId, IntentType.PAY_BILL, parameters),
};

export const payInvoiceTool: Tool<string> = {
  name: "pay_invoice",
  description: "Registra o pagamento de uma fatura de cartao de credito.",
  parameters: [
    {
      name: "card",
      description:
        `Nome do cartao pago: ${CREDIT_CARD_NAMES_TEXT}.`,
      required: true,
      enum: CREDIT_CARD_NAMES,
    },
    {
      name: "amount",
      description: "Valor numerico pago na fatura.",
      required: true,
    },
    {
      name: "month",
      description: "Mes numerico da competencia da fatura, de 1 a 12.",
      required: false,
    },
    {
      name: "year",
      description: "Ano numerico da competencia da fatura.",
      required: false,
    },
  ],
  requiredParameters: ["card", "amount"],
  execute: ({ userId, parameters = {} }) =>
    handlePayment(userId, IntentType.PAY_CARD_INVOICE, parameters),
};
