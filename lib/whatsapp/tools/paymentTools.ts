import { IntentType } from "../intents/intentTypes";
import { handlePayment } from "../handlers/paymentHandler";
import type { Tool } from "./types";

export const payBillTool: Tool<string> = {
  name: "pay_bill",
  description: "Registra o pagamento de uma conta pendente.",
  requiredParameters: ["userId", "parameters.description"],
  execute: ({ userId, parameters = {} }) =>
    handlePayment(userId, IntentType.PAY_BILL, parameters),
};

export const payInvoiceTool: Tool<string> = {
  name: "pay_invoice",
  description: "Registra o pagamento de uma fatura de cartao de credito.",
  requiredParameters: ["userId", "parameters.card", "parameters.amount"],
  execute: ({ userId, parameters = {} }) =>
    handlePayment(userId, IntentType.PAY_CARD_INVOICE, parameters),
};
