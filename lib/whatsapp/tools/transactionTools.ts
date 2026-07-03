import { IntentType } from "../intents/intentTypes";
import { handleAddTransaction } from "../handlers/addTransactionHandler";
import {
  confirmDelete,
  handleDelete,
} from "../handlers/deleteHandler";
import { handleQuery } from "../handlers/queryHandler";
import type { DeleteToolResult, Tool } from "./types";

export const addTransactionTool: Tool<string> = {
  name: "add_transaction",
  description:
    "Adiciona uma despesa ou receita a partir da mensagem do usuario.",
  requiredParameters: ["userId", "messageText", "conversationHistory"],
  execute: ({ userId, messageText = "", conversationHistory = "" }) =>
    handleAddTransaction(userId, messageText, conversationHistory),
};

export const queryTransactionsTool: Tool<string> = {
  name: "query_transactions",
  description:
    "Consulta transacoes financeiras de despesas ou receitas usando os filtros informados.",
  requiredParameters: ["userId", "intent"],
  execute: ({ userId, intent = IntentType.QUERY_EXPENSES, parameters = {} }) =>
    handleQuery(userId, intent, parameters),
};

export const queryBalanceTool: Tool<string> = {
  name: "query_balance",
  description: "Consulta o saldo detalhado do usuario.",
  requiredParameters: ["userId"],
  execute: ({ userId, parameters = {} }) =>
    handleQuery(userId, IntentType.QUERY_BALANCE, parameters),
};

export const queryCardInvoiceTool: Tool<string> = {
  name: "query_card_invoice",
  description: "Consulta faturas de cartao de credito do usuario.",
  requiredParameters: ["userId"],
  execute: ({ userId, parameters = {} }) =>
    handleQuery(userId, IntentType.QUERY_CARD_INVOICE, parameters),
};

export const queryBillsTool: Tool<string> = {
  name: "query_bills",
  description: "Consulta contas pendentes ou proximas do vencimento.",
  requiredParameters: ["userId"],
  execute: ({ userId, parameters = {} }) =>
    handleQuery(userId, IntentType.QUERY_BILLS, parameters),
};

export const deleteTransactionTool: Tool<DeleteToolResult> = {
  name: "delete_transaction",
  description:
    "Procura uma transacao ou transacao de cartao para exclusao e retorna a confirmacao necessaria.",
  requiredParameters: ["userId", "intent", "parameters.description"],
  execute: ({
    userId,
    intent = IntentType.DELETE_TRANSACTION,
    parameters = {},
    phoneNumber = "",
  }) => handleDelete(userId, intent, parameters, phoneNumber),
};

export const confirmDeleteTool: Tool<string> = {
  name: "confirm_delete",
  description: "Confirma ou cancela a exclusao pendente de uma transacao.",
  requiredParameters: ["userId", "pendingAction", "confirmation"],
  execute: ({ userId, pendingAction, confirmation = "" }) =>
    confirmDelete(userId, pendingAction, confirmation),
};
