import { IntentType } from "../intents/intentTypes";
import {
  findBillByDescription,
  payBillAccount,
} from "@/lib/services/admin/billAccountsAdmin";
import { payCardInvoice } from "@/lib/services/admin/userCreditCardsAdmin";

type PaymentParameters = Record<string, unknown>;

function getStringParameter(parameters: PaymentParameters, key: string): string | undefined {
  const value = parameters[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function getNumberParameter(parameters: PaymentParameters, key: string): number | undefined {
  const value = parameters[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

export async function handlePayment(
  userId: string,
  intent: IntentType,
  parameters: PaymentParameters
): Promise<string> {
  try {
    if (intent === IntentType.PAY_BILL) {
      return await handleBillPayment(userId, parameters);
    }

    if (intent === IntentType.PAY_CARD_INVOICE) {
      return await handleCardInvoicePayment(userId, parameters);
    }

    return "❌ Tipo de pagamento não reconhecido.";
  } catch (error) {
    console.error("Erro ao processar pagamento:", error);
    return "❌ Ocorreu um erro ao processar o pagamento. Tente novamente.";
  }
}

async function handleBillPayment(
  userId: string,
  parameters: PaymentParameters
): Promise<string> {
  const description = getStringParameter(parameters, "description");

  if (!description) {
    return "❌ Por favor, especifique qual conta você quer pagar (ex: 'pagar conta de luz').";
  }

  const bills = await findBillByDescription(userId, description);

  if (bills.length === 0) {
    return "❌ Nenhuma conta pendente encontrada com essa descrição.";
  }

  if (bills.length > 1) {
    let response = `🔍 Encontrei ${bills.length} contas:\n\n`;
    bills.forEach((bill, index) => {
      response += `${index + 1}. ${bill.description} - R$ ${bill.amount.toFixed(2)}\n`;
    });
    response += `\n_Qual você deseja pagar? Responda com o número._`;
    return response;
  }

  const bill = bills[0];
  const today = new Date().toISOString().split("T")[0];

  await payBillAccount(userId, bill.id, today);

  return `✅ Conta "${bill.description}" paga com sucesso!\n💰 Valor: R$ ${bill.amount.toFixed(2)}`;
}

async function handleCardInvoicePayment(
  userId: string,
  parameters: PaymentParameters
): Promise<string> {
  const cardName = getStringParameter(parameters, "card");
  const amount = getNumberParameter(parameters, "amount");

  if (!cardName) {
    return "❌ Por favor, especifique qual cartão você pagou (ex: 'paguei fatura do Nubank').";
  }

  if (!amount || amount <= 0) {
    return "❌ Por favor, especifique o valor pago (ex: 'paguei 500 reais da fatura do Nubank').";
  }

  const today = new Date().toISOString().split("T")[0];

  await payCardInvoice(userId, cardName, amount, today, {
    month: getNumberParameter(parameters, "month"),
    year: getNumberParameter(parameters, "year"),
  });

  return `✅ Pagamento da fatura do ${cardName} registrado!\n💰 Valor: R$ ${amount.toFixed(2)}`;
}
