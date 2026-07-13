import { db } from "@/lib/firebaseAdmin";
import {
  findCreditCardNameInText,
  getCreditCardName,
} from "@/lib/creditCards/catalog";
import { CATEGORY_ALIASES } from "@/lib/whatsapp/categories";
import { updateCardTransaction } from "@/lib/services/admin/cardTransactionsAdmin";
import { updateTransaction } from "@/lib/services/admin/transactionsAdmin";
import {
  formatBrasiliaDate,
  getBrasiliaDate,
} from "@/lib/whatsapp/utils/brasiliaDate";

export type EditableTransactionField =
  | "description"
  | "amount"
  | "date"
  | "category"
  | "paymentMethod";

export type UpdateTransactionTarget = {
  id: string;
  source: "transaction" | "card_transaction";
  description: string;
  date: string;
  amount: number;
  category?: string | null;
  type: "expense" | "income";
  paymentMethod?: string | null;
  cardName?: string | null;
};

export type PendingUpdateTransactionAction = {
  type: "update_transaction";
  step: "transaction" | "field" | "value" | "card";
  candidates?: UpdateTransactionTarget[];
  target?: UpdateTransactionTarget;
  field?: EditableTransactionField;
  paymentMethod?: "credit_card";
};

export type UpdatePendingResult = {
  message: string;
  pendingAction?: PendingUpdateTransactionAction;
  completed: boolean;
};

const FIELD_QUESTION =
  "Qual campo você quer alterar nessa transação: descrição, valor, data, categoria ou método de pagamento?";

const FIELD_VALUE_QUESTIONS: Record<EditableTransactionField, string> = {
  description: "Qual é a nova descrição?",
  amount: "Qual é o novo valor?",
  date: "Qual é a nova data?",
  category: "Qual é a nova categoria?",
  paymentMethod: "Qual é o novo método de pagamento?",
};

const FIELD_UPDATED_LABELS: Record<EditableTransactionField, string> = {
  description: "Descrição atualizada",
  amount: "Valor atualizado",
  date: "Data atualizada",
  category: "Categoria atualizada",
  paymentMethod: "Método de pagamento atualizado",
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isTarget(value: unknown): value is UpdateTransactionTarget {
  if (!value || typeof value !== "object") return false;
  const target = value as Partial<UpdateTransactionTarget>;
  return (
    typeof target.id === "string" &&
    (target.source === "transaction" || target.source === "card_transaction") &&
    typeof target.description === "string" &&
    typeof target.date === "string" &&
    typeof target.amount === "number" &&
    (target.type === "expense" || target.type === "income")
  );
}

export function isPendingUpdateTransactionAction(
  value: unknown,
): value is PendingUpdateTransactionAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Partial<PendingUpdateTransactionAction>;
  return (
    action.type === "update_transaction" &&
    ["transaction", "field", "value", "card"].includes(action.step ?? "") &&
    (!action.target || isTarget(action.target)) &&
    (!action.candidates ||
      (Array.isArray(action.candidates) && action.candidates.every(isTarget)))
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Math.abs(value));
}

export function buildTransactionSelectionMessage(
  candidates: UpdateTransactionTarget[],
): string {
  return [
    "Qual transação você quer alterar? Responda com o número:",
    "",
    ...candidates.map(
      (item, index) =>
        `${index + 1}. ${item.description} — ${formatCurrency(item.amount)} — ${formatDisplayDate(item.date)}`,
    ),
  ].join("\n");
}

function formatDisplayDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function parseField(messageText: string): EditableTransactionField | null {
  const normalized = normalizeText(messageText);
  if (/\b(descricao|nome)\b/.test(normalized)) return "description";
  if (/\b(valor|preco|quantia)\b/.test(normalized)) return "amount";
  if (/\b(data|dia)\b/.test(normalized)) return "date";
  if (/\b(categoria)\b/.test(normalized)) return "category";
  if (/\b(metodo|pagamento|forma de pagar|forma de pagamento)\b/.test(normalized)) {
    return "paymentMethod";
  }
  return null;
}

function parseAmount(messageText: string): number | null {
  const match = messageText.replace(/\s/g, "").match(/-?\d[\d.,]*/);
  if (!match) return null;

  let raw = match[0];
  if (raw.includes(",")) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  } else if ((raw.match(/\./g) ?? []).length > 1) {
    raw = raw.replace(/\./g, "");
  } else if (/\.\d{3}$/.test(raw)) {
    raw = raw.replace(".", "");
  }

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(messageText: string): string | null {
  const normalized = normalizeText(messageText);
  const today = getBrasiliaDate();

  if (/\bhoje\b/.test(normalized)) return formatBrasiliaDate();
  if (/\bontem\b/.test(normalized)) {
    today.setDate(today.getDate() - 1);
    return formatLocalDate(today);
  }
  if (/\bamanha\b/.test(normalized)) {
    today.setDate(today.getDate() + 1);
    return formatLocalDate(today);
  }

  const isoMatch = messageText.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  const brMatch = messageText.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})\b/);
  const year = isoMatch
    ? Number(isoMatch[1])
    : brMatch
      ? Number(brMatch[3].length === 2 ? `20${brMatch[3]}` : brMatch[3])
      : NaN;
  const month = isoMatch ? Number(isoMatch[2]) : brMatch ? Number(brMatch[2]) : NaN;
  const day = isoMatch ? Number(isoMatch[3]) : brMatch ? Number(brMatch[1]) : NaN;
  const candidate = new Date(year, month - 1, day);

  if (
    !Number.isFinite(year) ||
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }

  return formatLocalDate(candidate);
}

function parseCategory(messageText: string): string | null {
  const normalized = normalizeText(messageText);
  for (const alias of CATEGORY_ALIASES) {
    if (alias.category === normalized || alias.terms.some((term) => normalized.includes(term))) {
      return alias.category;
    }
  }
  return normalized.replace(/^(para|categoria)\s+/, "").trim() || null;
}

function parsePaymentMethod(messageText: string): {
  method: "cash" | "pix" | "debit" | "credit_card";
  cardName?: string;
} | null {
  const normalized = normalizeText(messageText);
  if (/\bpix\b/.test(normalized)) return { method: "pix" };
  if (/\b(dinheiro|especie)\b/.test(normalized)) return { method: "cash" };
  if (/\b(debito|cartao de debito)\b/.test(normalized)) return { method: "debit" };
  if (/\b(credito|cartao|credit card)\b/.test(normalized)) {
    const cardName = findCreditCardNameInText(messageText) ?? undefined;
    return { method: "credit_card", cardName };
  }
  return null;
}

async function changePaymentMethod(
  userId: string,
  target: UpdateTransactionTarget,
  method: "cash" | "pix" | "debit" | "credit_card",
  cardName?: string,
): Promise<void> {
  if (target.source === "transaction" && method !== "credit_card") {
    await updateTransaction(userId, target.id, { paymentMethod: method });
    return;
  }

  if (target.source === "card_transaction" && method === "credit_card") {
    if (cardName) {
      await updateCardTransaction(userId, target.id, {
        card: getCreditCardName(cardName),
      });
    }
    return;
  }

  const batch = db.batch();
  if (target.source === "transaction") {
    const sourceRef = db.collection(`users/${userId}/transactions`).doc(target.id);
    const destinationRef = db.collection(`users/${userId}/cardTransactions`).doc();
    batch.set(destinationRef, {
      description: target.description,
      category: target.category ?? "other",
      date: target.date,
      amount: -Math.abs(target.amount),
      card: getCreditCardName(cardName ?? ""),
    });
    batch.delete(sourceRef);
  } else {
    const sourceRef = db.collection(`users/${userId}/cardTransactions`).doc(target.id);
    const destinationRef = db.collection(`users/${userId}/transactions`).doc();
    batch.set(destinationRef, {
      description: target.description,
      category: target.category ?? "other",
      date: target.date,
      amount: -Math.abs(target.amount),
      type: "expense",
      paymentMethod: method,
    });
    batch.delete(sourceRef);
  }
  await batch.commit();
}

async function applyUpdate(
  userId: string,
  target: UpdateTransactionTarget,
  field: EditableTransactionField,
  messageText: string,
): Promise<UpdatePendingResult> {
  let value: string | number | null = null;

  if (field === "description") value = messageText.trim();
  if (field === "amount") value = parseAmount(messageText);
  if (field === "date") value = parseDate(messageText);
  if (field === "category") value = parseCategory(messageText);

  if (field === "paymentMethod") {
    const payment = parsePaymentMethod(messageText);
    if (!payment) {
      return {
        completed: false,
        message: "Não reconheci esse método. Responda com Pix, dinheiro, débito ou cartão de crédito.",
        pendingAction: { type: "update_transaction", step: "value", target, field },
      };
    }

    if (payment.method === "credit_card" && target.source === "transaction" && !payment.cardName) {
      return {
        completed: false,
        message: "Qual cartão de crédito devo usar? Informe o nome do cartão.",
        pendingAction: {
          type: "update_transaction",
          step: "card",
          target,
          field,
          paymentMethod: "credit_card",
        },
      };
    }

    await changePaymentMethod(userId, target, payment.method, payment.cardName);
    return {
      completed: true,
      message: `✅ Método de pagamento de “${target.description}” atualizado com sucesso.`,
    };
  }

  if (value === null || value === "") {
    const hints: Record<Exclude<EditableTransactionField, "paymentMethod">, string> = {
      description: "Informe uma descrição válida.",
      amount: "Informe um valor maior que zero, por exemplo: 25,90.",
      date: "Informe uma data válida, por exemplo: hoje ou 12/07/2026.",
      category: "Informe uma categoria válida, por exemplo: alimentação ou transporte.",
    };
    return {
      completed: false,
      message: hints[field],
      pendingAction: { type: "update_transaction", step: "value", target, field },
    };
  }

  const patch: Record<string, string | number> = {};
  if (field === "description") patch.description = String(value);
  if (field === "date") patch.date = String(value);
  if (field === "category") patch.category = String(value);
  if (field === "amount") {
    patch.amount = target.type === "income" ? Math.abs(Number(value)) : -Math.abs(Number(value));
  }

  if (target.source === "card_transaction") {
    await updateCardTransaction(userId, target.id, patch);
  } else {
    await updateTransaction(userId, target.id, patch);
  }

  return {
    completed: true,
    message: `✅ ${FIELD_UPDATED_LABELS[field]} em “${target.description}” com sucesso.`,
  };
}

export async function handleUpdateTransactionPendingAction(
  userId: string,
  pendingAction: unknown,
  messageText: string,
): Promise<UpdatePendingResult> {
  if (!isPendingUpdateTransactionAction(pendingAction)) {
    return {
      completed: true,
      message: "Não encontrei uma edição pendente. Tente solicitar a alteração novamente.",
    };
  }

  if (pendingAction.step === "transaction") {
    const candidates = pendingAction.candidates ?? [];
    const index = Number(normalizeText(messageText).replace(/^#/, "")) - 1;
    const target = Number.isInteger(index) ? candidates[index] : undefined;
    if (!target) {
      return {
        completed: false,
        message: `Número inválido.\n\n${buildTransactionSelectionMessage(candidates)}`,
        pendingAction,
      };
    }
    return {
      completed: false,
      message: FIELD_QUESTION,
      pendingAction: { type: "update_transaction", step: "field", target },
    };
  }

  const target = pendingAction.target;
  if (!target) {
    return {
      completed: true,
      message: "Não encontrei a transação que deveria ser alterada. Tente novamente.",
    };
  }

  if (pendingAction.step === "field") {
    const field = parseField(messageText);
    if (!field) {
      return {
        completed: false,
        message: FIELD_QUESTION,
        pendingAction,
      };
    }
    return {
      completed: false,
      message: FIELD_VALUE_QUESTIONS[field],
      pendingAction: { type: "update_transaction", step: "value", target, field },
    };
  }

  if (pendingAction.step === "card") {
    const cardName = findCreditCardNameInText(messageText);
    if (!cardName) {
      return {
        completed: false,
        message: "Não reconheci esse cartão. Informe o nome do cartão cadastrado.",
        pendingAction,
      };
    }
    await changePaymentMethod(userId, target, "credit_card", cardName);
    return {
      completed: true,
      message: `✅ Método de pagamento de “${target.description}” atualizado para o cartão ${cardName}.`,
    };
  }

  if (!pendingAction.field) {
    return {
      completed: true,
      message: "Não encontrei o campo que deveria ser alterado. Tente novamente.",
    };
  }

  return applyUpdate(userId, target, pendingAction.field, messageText);
}

export { FIELD_QUESTION };
