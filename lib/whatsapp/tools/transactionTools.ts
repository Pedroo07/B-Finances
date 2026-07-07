import { IntentType } from "../intents/intentTypes";
import { handleAddTransaction } from "../handlers/addTransactionHandler";
import {
  confirmDelete,
  handleDelete,
} from "../handlers/deleteHandler";
import {
  handleFindTransaction,
  type FindTransactionToolResult,
} from "../handlers/findTransactionHandler";
import { handleFinancialAdvice } from "../handlers/financialAdvisorHandler";
import { handleQuery } from "../handlers/queryHandler";
import type { DeleteToolResult, Tool } from "./types";
import { CREDIT_CARD_NAMES, CREDIT_CARD_NAMES_TEXT } from "@/lib/creditCards/catalog";

export const addTransactionTool: Tool<string> = {
  name: "add_transaction",
  description:
    "Adiciona uma despesa ou receita a partir da mensagem do usuario.",
  parameters: [
    {
      name: "messageText",
      description:
        "Mensagem original do usuario contendo a transacao a ser adicionada.",
      required: true,
    },
  ],
  requiredParameters: ["messageText"],
  execute: ({ userId, messageText = "", conversationHistory = "" }) =>
    handleAddTransaction(userId, messageText, conversationHistory),
};

export const queryTransactionsTool: Tool<string> = {
  name: "query_transactions",
  description:
    "Consulta transacoes financeiras de despesas ou receitas usando os filtros informados.",
  parameters: [
    {
      name: "type",
      description:
        "Tipo de transacao a consultar: expense para gastos/despesas ou income para receitas/entradas.",
      required: true,
      enum: ["expense", "income"],
    },
    {
      name: "period",
      description:
        "Periodo da consulta. Use today, week, month, year, last_month ou current_invoice quando o usuario pedir gastos/compras/itens da fatura atual do cartao.",
      required: false,
      enum: ["today", "week", "month", "year", "last_month", "current_invoice"],
    },
    {
      name: "limit",
      description: "Quantidade de ultimas transacoes a listar.",
      required: false,
    },
    {
      name: "category_filter",
      description:
        "Categoria interna para filtrar: foods, fixes, entertainment, salary, extra ou other.",
      required: false,
      enum: ["foods", "fixes", "entertainment", "salary", "extra", "other"],
    },
    {
      name: "card_filter",
      description:
        `Nome do cartao para filtrar gastos no cartao: ${CREDIT_CARD_NAMES_TEXT}.`,
      required: false,
      enum: CREDIT_CARD_NAMES,
    },
  ],
  requiredParameters: ["type"],
  execute: ({ userId, parameters = {}, messageText = "" }) => {
    const intent =
      parameters.type === "income"
        ? IntentType.QUERY_INCOME
        : IntentType.QUERY_EXPENSES;

    return handleQuery(userId, intent, parameters, messageText);
  },
};

export const queryBalanceTool: Tool<string> = {
  name: "query_balance",
  description: "Consulta o saldo detalhado do usuario.",
  parameters: [
    {
      name: "period",
      description:
        "Periodo do saldo. Use today, week, month, year ou last_month. Se omitido, usa month.",
      required: false,
      enum: ["today", "week", "month", "year", "last_month"],
    },
  ],
  requiredParameters: [],
  execute: ({ userId, parameters = {} }) =>
    handleQuery(userId, IntentType.QUERY_BALANCE, parameters),
};

export const financialAdvisorTool: Tool<string> = {
  name: "financial_advisor",
  description:
    "Analisa os dados financeiros do usuario no Firestore como consultor: compara meses, identifica maiores categorias, gastos incomuns, assinaturas recorrentes, alerta de orcamento, projecao financeira, economia potencial, previsao de saldo e capacidade de compra. Use para perguntas abertas como 'estou gastando muito?', 'onde posso economizar?', 'por que meu saldo caiu?' ou 'consigo comprar algo de 5000 reais?'.",
  parameters: [
    {
      name: "question",
      description:
        "Pergunta original do usuario para orientar a analise consultiva.",
      required: false,
    },
    {
      name: "target_amount",
      description:
        "Valor numerico do objetivo de compra quando o usuario perguntar se consegue comprar algo.",
      required: false,
    },
  ],
  requiredParameters: [],
  execute: ({ userId, parameters = {}, messageText = "" }) =>
    handleFinancialAdvice(userId, parameters, messageText),
};

export const queryCardInvoiceTool: Tool<string> = {
  name: "query_card_invoice",
  description: "Consulta faturas de cartao de credito do usuario.",
  parameters: [
    {
      name: "card",
      description:
        `Nome do cartao especifico: ${CREDIT_CARD_NAMES_TEXT}.`,
      required: false,
      enum: CREDIT_CARD_NAMES,
    },
    {
      name: "all_invoices",
      description:
        "Use true quando o usuario pedir todas as faturas ou nao especificar um cartao.",
      required: false,
      enum: [true, false],
    },
    {
      name: "month",
      description: "Mes numerico da fatura, de 1 a 12.",
      required: false,
    },
    {
      name: "year",
      description: "Ano numerico da fatura.",
      required: false,
    },
  ],
  requiredParameters: [],
  execute: ({ userId, parameters = {} }) =>
    handleQuery(userId, IntentType.QUERY_CARD_INVOICE, parameters),
};

export const queryBillsTool: Tool<string> = {
  name: "query_bills",
  description: "Consulta contas pendentes ou proximas do vencimento.",
  parameters: [
    {
      name: "days",
      description:
        "Janela em dias para consultar contas proximas. Se omitido, usa contas pendentes.",
      required: false,
    },
  ],
  requiredParameters: [],
  execute: ({ userId, parameters = {} }) =>
    handleQuery(userId, IntentType.QUERY_BILLS, parameters),
};

export const findTransactionTool: Tool<FindTransactionToolResult> = {
  name: "find_transaction",
  description:
    "Localiza transacoes usando linguagem natural, por descricao, data, valor ou cartao. Se houver mais de um resultado, retorna uma lista e pede para o usuario escolher; nunca seleciona automaticamente.",
  parameters: [
    {
      name: "query",
      description:
        'Frase original do usuario com a pista da transacao, como "a pizza", "o mercado", "o Uber", "ontem", "segunda-feira", "semana passada", "50 reais" ou "cartao Inter".',
      required: false,
    },
  ],
  requiredParameters: [],
  execute: ({ userId, parameters = {}, messageText = "" }) => {
    const query =
      typeof parameters.query === "string" && parameters.query.trim()
        ? parameters.query
        : messageText;

    return handleFindTransaction(userId, query);
  },
};

export const deleteTransactionTool: Tool<DeleteToolResult> = {
  name: "delete_transaction",
  description:
    "Procura uma transacao ou transacao de cartao para exclusao e retorna a confirmacao necessaria.",
  parameters: [
    {
      name: "description",
      description:
        "Descricao, palavra-chave ou nome da transacao que o usuario quer deletar.",
      required: true,
    },
    {
      name: "source",
      description:
        "Use card para transacao de cartao ou transaction para transacao comum. Se o usuario nao especificar cartao, use transaction.",
      required: false,
      enum: ["transaction", "card"],
    },
  ],
  requiredParameters: ["description"],
  execute: ({
    userId,
    parameters = {},
    phoneNumber = "",
  }) => {
    const intent =
      parameters.source === "card"
        ? IntentType.DELETE_CARD_TRANSACTION
        : IntentType.DELETE_TRANSACTION;

    return handleDelete(userId, intent, parameters, phoneNumber);
  },
};

export const confirmDeleteTool: Tool<string> = {
  name: "confirm_delete",
  description: "Confirma ou cancela a exclusao pendente de uma transacao.",
  parameters: [
    {
      name: "confirmation",
      description:
        "Resposta do usuario para confirmar, cancelar ou escolher um item numerado.",
      required: true,
    },
  ],
  requiredParameters: ["confirmation"],
  execute: ({ userId, pendingAction, confirmation = "" }) =>
    confirmDelete(userId, pendingAction, confirmation),
};
