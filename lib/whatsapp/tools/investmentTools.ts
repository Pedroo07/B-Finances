import { IntentType } from "../intents/intentTypes";
import { handleInvestment } from "../handlers/investmentHandler";
import { handleQuery } from "../handlers/queryHandler";
import type { Tool } from "./types";

export const queryInvestmentsTool: Tool<string> = {
  name: "query_investments",
  description: "Consulta o resumo dos investimentos do usuario.",
  requiredParameters: ["userId"],
  execute: ({ userId }) =>
    handleQuery(userId, IntentType.QUERY_INVESTMENTS, {}),
};

export const addInvestmentTool: Tool<string> = {
  name: "add_investment",
  description: "Adiciona um investimento para o usuario.",
  requiredParameters: [
    "userId",
    "parameters.category",
    "parameters.amount",
  ],
  execute: ({ userId, parameters = {} }) =>
    handleInvestment(userId, IntentType.ADD_INVESTMENT, parameters),
};

export const redeemInvestmentTool: Tool<string> = {
  name: "redeem_investment",
  description: "Resgata saldo de um investimento do usuario.",
  requiredParameters: [
    "userId",
    "parameters.category",
    "parameters.amount",
  ],
  execute: ({ userId, parameters = {} }) =>
    handleInvestment(userId, IntentType.REDEEM_INVESTMENT, parameters),
};
