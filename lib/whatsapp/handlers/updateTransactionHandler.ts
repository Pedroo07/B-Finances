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
import type {
  BFinanceCommand,
  BFinanceCommandUpdate,
  BFinanceUpdateField,
} from "@/lib/whatsapp/commands/types";
import { extractMoney } from "@/lib/whatsapp/utils/moneyParser";
import {
  getNextUpdateStep,
  getNextUpdateStepAfterFieldSelection,
  selectCandidateByNumber,
} from "./updateTransactionFlow";

export type EditableTransactionField = BFinanceUpdateField;

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
  createdAt?: string | null;
};

export const UPDATE_PENDING_ACTION_VERSION = 2;
export const UPDATE_PENDING_ACTION_TTL_MS = 15 * 60 * 1000;

export type PendingUpdateTransactionAction = {
  type: "update_transaction";
  version: typeof UPDATE_PENDING_ACTION_VERSION;
  step: "criteria" | "transaction" | "field" | "value" | "card";
  candidates?: UpdateTransactionTarget[];
  target?: UpdateTransactionTarget;
  update?: BFinanceCommandUpdate;
  command?: BFinanceCommand;
  paymentMethod?: "credit_card";
  expiresAt: string;
};

export type PendingQueryTransactionSelectionAction = {
  type: "select_transaction_from_query";
  version: typeof UPDATE_PENDING_ACTION_VERSION;
  candidates: UpdateTransactionTarget[];
  expiresAt: string;
};

export type UpdatePendingResult = {
  message: string;
  pendingAction?: PendingUpdateTransactionAction;
  completed: boolean;
  updatedTarget?: UpdateTransactionTarget;
  needsCriteria?: boolean;
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

function newExpiry(): string {
  return new Date(Date.now() + UPDATE_PENDING_ACTION_TTL_MS).toISOString();
}

function isExpired(expiresAt: string): boolean {
  const expiresAtMs = Date.parse(expiresAt);
  return !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now();
}

function isUpdateField(value: unknown): value is EditableTransactionField {
  return (
    value === "description" ||
    value === "amount" ||
    value === "date" ||
    value === "category" ||
    value === "paymentMethod"
  );
}

function normalizeRequestedUpdate(
  update?: BFinanceCommandUpdate,
): BFinanceCommandUpdate {
  return {
    field: isUpdateField(update?.field) ? update.field : null,
    value:
      typeof update?.value === "string" || typeof update?.value === "number"
        ? update.value
        : null,
    reference: update?.reference ?? null,
    targetText: update?.targetText ?? null,
  };
}

export function createPendingUpdateAction(
  action: Omit<
    PendingUpdateTransactionAction,
    "type" | "version" | "expiresAt"
  >,
): PendingUpdateTransactionAction {
  return {
    type: "update_transaction",
    version: UPDATE_PENDING_ACTION_VERSION,
    expiresAt: newExpiry(),
    ...action,
    update: normalizeRequestedUpdate(action.update),
  };
}

export function createQuerySelectionAction(
  candidates: UpdateTransactionTarget[],
): PendingQueryTransactionSelectionAction {
  return {
    type: "select_transaction_from_query",
    version: UPDATE_PENDING_ACTION_VERSION,
    candidates,
    expiresAt: newExpiry(),
  };
}

export function isPendingQueryTransactionSelectionAction(
  value: unknown,
): value is PendingQueryTransactionSelectionAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Partial<PendingQueryTransactionSelectionAction>;
  return (
    action.type === "select_transaction_from_query" &&
    action.version === UPDATE_PENDING_ACTION_VERSION &&
    typeof action.expiresAt === "string" &&
    Array.isArray(action.candidates) &&
    action.candidates.length > 0 &&
    action.candidates.every(isTarget)
  );
}

export function isPendingUpdateTransactionAction(
  value: unknown,
): value is PendingUpdateTransactionAction {
  if (!value || typeof value !== "object") return false;
  const action = value as Partial<PendingUpdateTransactionAction>;
  return (
    action.type === "update_transaction" &&
    action.version === UPDATE_PENDING_ACTION_VERSION &&
    typeof action.expiresAt === "string" &&
    ["criteria", "transaction", "field", "value", "card"].includes(
      action.step ?? "",
    ) &&
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
  const value = extractMoney(messageText)?.value ?? null;
  return value !== null && Number.isFinite(value) && value > 0 ? value : null;
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
): Promise<UpdateTransactionTarget> {
  if (target.source === "transaction" && method !== "credit_card") {
    await updateTransaction(userId, target.id, { paymentMethod: method });
    return { ...target, paymentMethod: method, cardName: null };
  }

  if (target.source === "card_transaction" && method === "credit_card") {
    if (cardName) {
      await updateCardTransaction(userId, target.id, {
        card: getCreditCardName(cardName),
      });
    }
    return {
      ...target,
      paymentMethod: "credit_card",
      cardName: cardName ? getCreditCardName(cardName) : target.cardName,
    };
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
    await batch.commit();
    return {
      ...target,
      id: destinationRef.id,
      source: "card_transaction",
      type: "expense",
      amount: -Math.abs(target.amount),
      paymentMethod: "credit_card",
      cardName: getCreditCardName(cardName ?? ""),
      createdAt: new Date().toISOString(),
    };
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
    await batch.commit();
    return {
      ...target,
      id: destinationRef.id,
      source: "transaction",
      type: "expense",
      amount: -Math.abs(target.amount),
      paymentMethod: method,
      cardName: null,
      createdAt: new Date().toISOString(),
    };
  }
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
        pendingAction: createPendingUpdateAction({
          step: "value",
          target,
          update: { field, value: null },
        }),
      };
    }

    if (payment.method === "credit_card" && target.type === "income") {
      return {
        completed: false,
        message:
          "Receitas não podem ser movidas para cartão de crédito. Escolha Pix, dinheiro ou débito.",
        pendingAction: createPendingUpdateAction({
          step: "value",
          target,
          update: { field, value: null },
        }),
      };
    }

    if (payment.method === "credit_card" && target.source === "transaction" && !payment.cardName) {
      return {
        completed: false,
        message: "Qual cartão de crédito devo usar? Informe o nome do cartão.",
        pendingAction: createPendingUpdateAction({
          step: "card",
          target,
          update: { field, value: payment.method },
          paymentMethod: "credit_card",
        }),
      };
    }

    const updatedTarget = await changePaymentMethod(
      userId,
      target,
      payment.method,
      payment.cardName,
    );
    return {
      completed: true,
      message: `✅ Método de pagamento de “${target.description}” atualizado com sucesso.`,
      updatedTarget,
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
      pendingAction: createPendingUpdateAction({
        step: "value",
        target,
        update: { field, value: null },
      }),
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


  const updatedTarget: UpdateTransactionTarget = {
    ...target,
    ...(field === "description" ? { description: String(value) } : {}),
    ...(field === "date" ? { date: String(value) } : {}),
    ...(field === "category" ? { category: String(value) } : {}),
    ...(field === "amount" ? { amount: Number(patch.amount) } : {}),
  };

  return {
    completed: true,
    message: `✅ Alteração concluída em “${target.description}”: ${FIELD_UPDATED_LABELS[field].toLocaleLowerCase("pt-BR")}.`,
    updatedTarget,
  };
}

function valueAsMessage(value: string | number): string {
  return typeof value === "number" ? String(value) : value;
}

function extractInlineValue(
  messageText: string,
  field: EditableTransactionField,
): string | null {
  const match = messageText.match(/\bpara\s+(.+)$/i);
  if (match?.[1]?.trim()) return match[1].trim();

  const fieldPatterns: Record<EditableTransactionField, RegExp> = {
    description: /^(?:(?:a|o)\s+)?(?:descri[cç][aã]o|nome)\s+(.+)$/iu,
    amount: /^(?:(?:o|a)\s+)?(?:valor|pre[cç]o|quantia)\s+(.+)$/iu,
    date: /^(?:(?:a|o)\s+)?(?:data|dia)\s+(.+)$/iu,
    category: /^(?:(?:a|o)\s+)?categoria\s+(.+)$/iu,
    paymentMethod:
      /^(?:(?:o|a)\s+)?(?:(?:m[eé]todo|forma)\s+(?:de\s+)?pagamento|pagamento)\s+(.+)$/iu,
  };
  return fieldPatterns[field].exec(messageText.trim())?.[1]?.trim() || null;
}

export async function beginUpdateForTarget(
  userId: string,
  target: UpdateTransactionTarget,
  requestedUpdate?: BFinanceCommandUpdate,
  command?: BFinanceCommand,
): Promise<UpdatePendingResult> {
  const update = normalizeRequestedUpdate(requestedUpdate);
  const nextStep = getNextUpdateStep(update);

  if (nextStep.kind === "apply" && isUpdateField(nextStep.field)) {
    return applyUpdate(
      userId,
      target,
      nextStep.field,
      valueAsMessage(nextStep.value),
    );
  }

  if (nextStep.kind === "ask_value" && isUpdateField(nextStep.field)) {
    return {
      completed: false,
      message: FIELD_VALUE_QUESTIONS[nextStep.field],
      pendingAction: createPendingUpdateAction({
        step: "value",
        target,
        update,
        command,
      }),
    };
  }

  return {
    completed: false,
    message: FIELD_QUESTION,
    pendingAction: createPendingUpdateAction({
      step: "field",
      target,
      update,
      command,
    }),
  };
}

export function resolveQueryTransactionSelection(
  pendingAction: unknown,
  messageText: string,
): { target?: UpdateTransactionTarget; expired: boolean; valid: boolean } {
  if (!isPendingQueryTransactionSelectionAction(pendingAction)) {
    return { expired: false, valid: false };
  }
  if (isExpired(pendingAction.expiresAt)) {
    return { expired: true, valid: false };
  }

  const target = selectCandidateByNumber(
    pendingAction.candidates,
    messageText,
  ) ?? undefined;
  return { target, expired: false, valid: Boolean(target) };
}

export async function handleUpdateTransactionPendingAction(
  userId: string,
  pendingAction: unknown,
  messageText: string,
): Promise<UpdatePendingResult> {
  if (!isPendingUpdateTransactionAction(pendingAction)) {
    return {
      completed: true,
      message:
        "Esta edição foi iniciada em uma versão anterior e não pode ser retomada. Solicite a alteração novamente.",
    };
  }

  if (isExpired(pendingAction.expiresAt)) {
    return {
      completed: true,
      message: "A edição expirou. Solicite a alteração novamente.",
    };
  }

  if (pendingAction.step === "criteria") {
    return {
      completed: false,
      needsCriteria: true,
      message: "",
      pendingAction,
    };
  }

  if (pendingAction.step === "transaction") {
    const candidates = pendingAction.candidates ?? [];
    const target =
      selectCandidateByNumber(candidates, messageText) ?? undefined;
    if (!target) {
      return {
        completed: false,
        message: `Número inválido.\n\n${buildTransactionSelectionMessage(candidates)}`,
        pendingAction,
      };
    }
    return beginUpdateForTarget(
      userId,
      target,
      pendingAction.update,
      pendingAction.command,
    );
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

    const nextStep = getNextUpdateStepAfterFieldSelection(
      pendingAction.update,
      field,
      extractInlineValue(messageText, field),
    );
    if (nextStep.kind === "apply") {
      return applyUpdate(
        userId,
        target,
        field,
        valueAsMessage(nextStep.value),
      );
    }

    return {
      completed: false,
      message: FIELD_VALUE_QUESTIONS[field],
      pendingAction: createPendingUpdateAction({
        step: "value",
        target,
        update: { ...pendingAction.update, field, value: null },
        command: pendingAction.command,
      }),
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
    const updatedTarget = await changePaymentMethod(
      userId,
      target,
      "credit_card",
      cardName,
    );
    return {
      completed: true,
      message: `✅ Método de pagamento de “${target.description}” atualizado para o cartão ${cardName}.`,
      updatedTarget,
    };
  }

  const field = pendingAction.update?.field;
  if (!isUpdateField(field)) {
    return {
      completed: true,
      message: "Não encontrei o campo que deveria ser alterado. Tente novamente.",
    };
  }

  return applyUpdate(userId, target, field, messageText);
}

export { FIELD_QUESTION };
