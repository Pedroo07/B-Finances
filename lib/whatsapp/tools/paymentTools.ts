import { IntentType } from "../intents/intentTypes";
import { handlePayment } from "../handlers/paymentHandler";
import type { Tool } from "./types";

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
        "Nome do cartao pago: Nubank, Inter, PicPay, BB, C6, Mercado Pago ou Bradesco.",
      required: true,
      enum: ["Nubank", "Inter", "PicPay", "BB", "C6", "Mercado Pago", "Bradesco"],
    },
    {
      name: "amount",
      description: "Valor numerico pago na fatura.",
      required: true,
    },
  ],
  requiredParameters: ["card", "amount"],
  execute: ({ userId, parameters = {} }) =>
    handlePayment(userId, IntentType.PAY_CARD_INVOICE, parameters),
};
