import { IntentType } from "../intents/intentTypes";
import {
  findTransactionByDescription,
  deleteTransaction,
} from "@/lib/services/admin/transactionsAdmin";
import {
  findCardTransactionByDescription,
  deleteCardTransaction,
} from "@/lib/services/admin/cardTransactionsAdmin";
import { formatDeleteConfirmation } from "../formatters/responseFormatter";

type DeleteTransactionSummary = {
  id: string;
  description: string;
};

export type PendingDeleteAction =
  | {
      type: "delete_transaction" | "delete_card_transaction";
      transactionId: string;
      description: string;
    }
  | {
      type: "delete_transaction_multiple" | "delete_card_transaction_multiple";
      transactions: DeleteTransactionSummary[];
    };

function isPendingDeleteAction(value: unknown): value is PendingDeleteAction {
  if (!value || typeof value !== "object" || !("type" in value)) return false;

  const action = value as Record<string, unknown>;
  if (action.type === "delete_transaction" || action.type === "delete_card_transaction") {
    return typeof action.transactionId === "string" && typeof action.description === "string";
  }

  if (action.type === "delete_transaction_multiple" || action.type === "delete_card_transaction_multiple") {
    return Array.isArray(action.transactions) && action.transactions.every(
      (item) => item && typeof item === "object"
        && typeof (item as Record<string, unknown>).id === "string"
        && typeof (item as Record<string, unknown>).description === "string"
    );
  }

  return false;
}

export async function handleDelete(
  userId: string,
  intent: IntentType,
  parameters: Record<string, unknown>
): Promise<{ message: string; needsConfirmation: boolean; pendingAction?: PendingDeleteAction }> {
  try {
    const description = typeof parameters.description === "string"
      ? parameters.description
      : "";

    if (!description) {
      return {
        message: "❌ Por favor, especifique qual transação você quer deletar (ex: 'deletar gasto com pizza').",
        needsConfirmation: false,
      };
    }

    if (intent === IntentType.DELETE_TRANSACTION) {
      const transactions = await findTransactionByDescription(userId, description, 30);
      
      if (transactions.length === 0) {
        return {
          message: "❌ Nenhuma transação encontrada com essa descrição nos últimos 30 dias.",
          needsConfirmation: false,
        };
      }

      if (transactions.length === 1) {
        return {
          message: formatDeleteConfirmation(transactions),
          needsConfirmation: true,
          pendingAction: {
            type: "delete_transaction",
            transactionId: transactions[0].id,
            description: transactions[0].description,
          },
        };
      }

      return {
        message: formatDeleteConfirmation(transactions),
        needsConfirmation: true,
        pendingAction: {
          type: "delete_transaction_multiple",
          transactions: transactions.map((t) => ({ id: t.id, description: t.description })),
        },
      };
    }

    if (intent === IntentType.DELETE_CARD_TRANSACTION) {
      const transactions = await findCardTransactionByDescription(userId, description, 30);
      
      if (transactions.length === 0) {
        return {
          message: "❌ Nenhuma transação de cartão encontrada com essa descrição nos últimos 30 dias.",
          needsConfirmation: false,
        };
      }

      if (transactions.length === 1) {
        return {
          message: formatDeleteConfirmation(transactions),
          needsConfirmation: true,
          pendingAction: {
            type: "delete_card_transaction",
            transactionId: transactions[0].id,
            description: transactions[0].description,
          },
        };
      }

      return {
        message: formatDeleteConfirmation(transactions),
        needsConfirmation: true,
        pendingAction: {
          type: "delete_card_transaction_multiple",
          transactions: transactions.map((t) => ({ id: t.id, description: t.description })),
        },
      };
    }

    return {
      message: "❌ Tipo de exclusão não reconhecido.",
      needsConfirmation: false,
    };
  } catch (error) {
    console.error("Erro ao processar exclusão:", error);
    return {
      message: "❌ Ocorreu um erro ao processar a exclusão. Tente novamente.",
      needsConfirmation: false,
    };
  }
}

export async function confirmDelete(
  userId: string,
  pendingAction: unknown,
  confirmation: string
): Promise<string> {
  try {
    if (!isPendingDeleteAction(pendingAction)) {
      return "❌ Ação pendente não reconhecida.";
    }

    if (pendingAction.type === "delete_transaction" || pendingAction.type === "delete_card_transaction") {
      const isConfirmed = confirmation.toLowerCase().includes("sim");

      if (!isConfirmed) {
        return "❌ Exclusão cancelada.";
      }

      if (pendingAction.type === "delete_transaction") {
        await deleteTransaction(userId, pendingAction.transactionId);
      } else {
        await deleteCardTransaction(userId, pendingAction.transactionId);
      }

      return `✅ Transação "${pendingAction.description}" deletada com sucesso!`;
    }

    if (
      pendingAction.type === "delete_transaction_multiple" ||
      pendingAction.type === "delete_card_transaction_multiple"
    ) {
      const selectedIndex = parseInt(confirmation) - 1;

      if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= pendingAction.transactions.length) {
        return "❌ Número inválido. Exclusão cancelada.";
      }

      const selectedTransaction = pendingAction.transactions[selectedIndex];

      if (pendingAction.type === "delete_transaction_multiple") {
        await deleteTransaction(userId, selectedTransaction.id);
      } else {
        await deleteCardTransaction(userId, selectedTransaction.id);
      }

      return `✅ Transação "${selectedTransaction.description}" deletada com sucesso!`;
    }

    return "❌ Ação pendente não reconhecida.";
  } catch (error) {
    console.error("Erro ao confirmar exclusão:", error);
    return "❌ Ocorreu um erro ao deletar a transação. Tente novamente.";
  }
}
