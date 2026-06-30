import { IntentType } from "../intents/intentTypes";
import {
  createInvestment,
  redeemInvestmentBalance,
  InvestmentDto,
  getInvestmentByCategory
} from "@/lib/services/admin/investmentsAdmin";

export async function handleInvestment(
  userId: string,
  intent: IntentType,
  parameters: Record<string, any>
): Promise<string> {
  try {
    switch (intent) {
      case IntentType.ADD_INVESTMENT:
        return await handleAddInvestment(userId, parameters);
      case IntentType.REDEEM_INVESTMENT:
        return await handleRedeemInvestment(userId, parameters);
      default:
        return "❌ Não consegui processar sua solicitação de investimento.";
    }
  } catch (error) {
    console.error("Erro ao processar investimento:", error);
    return "❌ Ocorreu um erro ao processar o investimento. Tente novamente.";
  }
}

async function handleAddInvestment(
  userId: string,
  parameters: Record<string, any>
): Promise<string> {
  const category = parameters.category;
  const amount = parameters.amount;
  const liquidez = parameters.liquidez || "imediata";

  if (!category || !amount || amount <= 0) {
    return "❌ Para adicionar um investimento, preciso da categoria, valor e liquidez (imediata/longo prazo).";
  }

  const newInvestment: InvestmentDto = {
    category: category,
    balance: amount,
    liquidez: liquidez,
    created_at: new Date().toISOString().split("T")[0],
    rendimentos: [],
    total_yield: 0,
  };

  await createInvestment(userId, newInvestment);

  return `✅ Investimento de ${amount} em ${category} adicionado com sucesso!`;
}

async function handleRedeemInvestment(
  userId: string,
  parameters: Record<string, any>
): Promise<string> {
  const category = parameters.category;
  const amount = parameters.amount;

  if (!category || !amount || amount <= 0) {
    return "❌ Para resgatar um investimento, preciso da categoria e do valor a ser resgatado.";
  }
  const investment = await getInvestmentByCategory(userId, category);
  if (!investment) {
    return `❌ Investimento na categoria \'${category}\' não encontrado.`;
  }

  await redeemInvestmentBalance(userId, investment.id, amount);

  return `✅ Resgate de ${amount} da categoria ${category} realizado com sucesso!`;
}
