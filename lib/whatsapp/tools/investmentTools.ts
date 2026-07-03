import { IntentType } from "../intents/intentTypes";
import { handleInvestment } from "../handlers/investmentHandler";
import { handleQuery } from "../handlers/queryHandler";
import type { Tool } from "./types";

export const queryInvestmentsTool: Tool<string> = {
  name: "query_investments",
  description: "Consulta o resumo dos investimentos do usuario.",
  parameters: [],
  requiredParameters: [],
  execute: ({ userId }) =>
    handleQuery(userId, IntentType.QUERY_INVESTMENTS, {}),
};

export const addInvestmentTool: Tool<string> = {
  name: "add_investment",
  description: "Adiciona um investimento para o usuario.",
  parameters: [
    {
      name: "category",
      description: "Categoria ou nome do investimento, como CDB, Tesouro ou acoes.",
      required: true,
    },
    {
      name: "amount",
      description: "Valor numerico investido.",
      required: true,
    },
    {
      name: "liquidez",
      description:
        "Liquidez do investimento. Use imediata ou longo prazo. Se omitido, o handler usa imediata.",
      required: false,
      enum: ["imediata", "longo prazo"],
    },
  ],
  requiredParameters: ["category", "amount"],
  execute: ({ userId, parameters = {} }) =>
    handleInvestment(userId, IntentType.ADD_INVESTMENT, parameters),
};

export const redeemInvestmentTool: Tool<string> = {
  name: "redeem_investment",
  description: "Resgata saldo de um investimento do usuario.",
  parameters: [
    {
      name: "category",
      description: "Categoria ou nome do investimento a resgatar.",
      required: true,
    },
    {
      name: "amount",
      description: "Valor numerico a ser resgatado.",
      required: true,
    },
  ],
  requiredParameters: ["category", "amount"],
  execute: ({ userId, parameters = {} }) =>
    handleInvestment(userId, IntentType.REDEEM_INVESTMENT, parameters),
};
