import { db } from "@/lib/firebaseAdmin";

export type WhatsappPendingAction = {
  type: string;
  [key: string]: unknown;
};

export const LAST_TRANSACTION_REFERENCE_TTL_MS = 15 * 60 * 1000;

export type RecentTransactionReference = {
  id: string;
  source: "transaction" | "card_transaction";
  description: string;
  date: string;
  amount: number;
  category: string | null;
  type: "expense" | "income";
  paymentMethod: string | null;
  cardName: string | null;
  createdAt: string | null;
  rememberedAt: Date;
};

export type RecentTransactionReferenceInput = Omit<
  RecentTransactionReference,
  "rememberedAt" | "category" | "paymentMethod" | "cardName" | "createdAt"
> &
  Partial<
    Pick<
      RecentTransactionReference,
      "category" | "paymentMethod" | "cardName" | "createdAt"
    >
  >;

export type WhatsappSession = {
  history: Array<{
    role: "user" | "assistant";
    text: string;
    timestamp: Date;
  }>;
  pendingAction?: WhatsappPendingAction;
  lastTransactionReference?: RecentTransactionReference | null;
  lastMessageAt?: Date;
  messageCount?: number;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  count: number;
  remaining: number;
  resetAt: Date;
};

export async function getSession(phoneNumber: string): Promise<WhatsappSession | null> {
  const doc = await db.collection("whatsapp_sessions").doc(phoneNumber).get();
  if (!doc.exists) return null;
  return doc.data() as WhatsappSession;
}

export async function saveSession(phoneNumber: string, session: Partial<WhatsappSession>): Promise<void> {
  await db
    .collection("whatsapp_sessions")
    .doc(phoneNumber)
    .set(session, { merge: true });
}

export async function clearSession(phoneNumber: string): Promise<void> {
  await db.collection("whatsapp_sessions").doc(phoneNumber).delete();
}

export async function updateSessionHistory(
  phoneNumber: string,
  role: "user" | "assistant",
  text: string
): Promise<void> {
  const session = (await getSession(phoneNumber)) || { history: [] };
  const history = session.history || [];
  history.push({ role, text, timestamp: new Date() });
  
  if (history.length > 10) {
    history.shift();
  }

  await saveSession(phoneNumber, { history });
}

function isPendingAction(action: unknown): action is WhatsappPendingAction {
  return (
    typeof action === "object" &&
    action !== null &&
    !Array.isArray(action) &&
    typeof (action as { type?: unknown }).type === "string"
  );
}

export async function setPendingAction(
  phoneNumber: string,
  action: unknown,
): Promise<void> {
  if (!isPendingAction(action)) return;
  await saveSession(phoneNumber, { pendingAction: action });
}

export async function getPendingAction(
  phoneNumber: string,
): Promise<WhatsappSession["pendingAction"] | null> {
  const session = await getSession(phoneNumber);
  return session?.pendingAction || null;
}

export async function clearPendingAction(phoneNumber: string): Promise<void> {
  await db
    .collection("whatsapp_sessions")
    .doc(phoneNumber)
    .update({ pendingAction: null });
}

const LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_MESSAGES_PER_WINDOW = 20;

function toDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === "string") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "object" && value !== null) {
    const maybeTimestamp = value as {
      toDate?: () => Date;
      seconds?: number;
    };

    if (typeof maybeTimestamp.toDate === "function") {
      const date = maybeTimestamp.toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    }

    if (typeof maybeTimestamp.seconds === "number") {
      const date = new Date(maybeTimestamp.seconds * 1000);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }

  return null;
}

function isNullableString(value: unknown): value is string | null | undefined {
  return value === null || value === undefined || typeof value === "string";
}

function parseRecentTransactionReference(
  value: unknown,
): RecentTransactionReference | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const reference = value as Record<string, unknown>;
  const rememberedAt = toDate(reference.rememberedAt);
  if (
    typeof reference.id !== "string" ||
    (reference.source !== "transaction" &&
      reference.source !== "card_transaction") ||
    typeof reference.description !== "string" ||
    typeof reference.date !== "string" ||
    typeof reference.amount !== "number" ||
    !Number.isFinite(reference.amount) ||
    (reference.type !== "expense" && reference.type !== "income") ||
    !isNullableString(reference.category) ||
    !isNullableString(reference.paymentMethod) ||
    !isNullableString(reference.cardName) ||
    !isNullableString(reference.createdAt) ||
    !rememberedAt
  ) {
    return null;
  }

  return {
    id: reference.id,
    source: reference.source,
    description: reference.description,
    date: reference.date,
    amount: reference.amount,
    category: reference.category ?? null,
    type: reference.type,
    paymentMethod: reference.paymentMethod ?? null,
    cardName: reference.cardName ?? null,
    createdAt: reference.createdAt ?? null,
    rememberedAt,
  };
}

export async function rememberLastTransactionReference(
  phoneNumber: string,
  reference: RecentTransactionReferenceInput,
): Promise<RecentTransactionReference> {
  const rememberedReference: RecentTransactionReference = {
    ...reference,
    category: reference.category ?? null,
    paymentMethod: reference.paymentMethod ?? null,
    cardName: reference.cardName ?? null,
    createdAt: reference.createdAt ?? null,
    rememberedAt: new Date(),
  };

  await saveSession(phoneNumber, {
    lastTransactionReference: rememberedReference,
  });
  return rememberedReference;
}

export async function getLastTransactionReference(
  phoneNumber: string,
): Promise<RecentTransactionReference | null> {
  const session = await getSession(phoneNumber);
  const reference = parseRecentTransactionReference(
    session?.lastTransactionReference,
  );

  if (!reference) {
    if (session?.lastTransactionReference) {
      await clearLastTransactionReference(phoneNumber);
    }
    return null;
  }

  const age = Date.now() - reference.rememberedAt.getTime();
  if (age < 0 || age >= LAST_TRANSACTION_REFERENCE_TTL_MS) {
    await clearLastTransactionReference(phoneNumber);
    return null;
  }

  return reference;
}

export async function clearLastTransactionReference(
  phoneNumber: string,
): Promise<void> {
  await saveSession(phoneNumber, { lastTransactionReference: null });
}

export async function checkRateLimit(phoneNumber: string): Promise<RateLimitResult> {
  const session = await getSession(phoneNumber);
  const now = new Date();
  const newWindowResetAt = new Date(now.getTime() + LIMIT_WINDOW_MS);

  if (!session) {
    await saveSession(phoneNumber, {
      lastMessageAt: now,
      messageCount: 1,
    });
    return {
      allowed: true,
      limit: MAX_MESSAGES_PER_WINDOW,
      count: 1,
      remaining: MAX_MESSAGES_PER_WINDOW - 1,
      resetAt: newWindowResetAt,
    };
  }

  const windowStartedAt = toDate(session.lastMessageAt);
  const elapsed = windowStartedAt
    ? now.getTime() - windowStartedAt.getTime()
    : LIMIT_WINDOW_MS;

  if (!windowStartedAt || elapsed >= LIMIT_WINDOW_MS || elapsed < 0) {
    await saveSession(phoneNumber, {
      lastMessageAt: now,
      messageCount: 1,
    });

    return {
      allowed: true,
      limit: MAX_MESSAGES_PER_WINDOW,
      count: 1,
      remaining: MAX_MESSAGES_PER_WINDOW - 1,
      resetAt: newWindowResetAt,
    };
  }

  const currentCount = Number.isFinite(session.messageCount)
    ? Number(session.messageCount)
    : 0;
  const resetAt = new Date(windowStartedAt.getTime() + LIMIT_WINDOW_MS);

  if (currentCount >= MAX_MESSAGES_PER_WINDOW) {
    return {
      allowed: false,
      limit: MAX_MESSAGES_PER_WINDOW,
      count: currentCount,
      remaining: 0,
      resetAt,
    };
  }

  const nextCount = currentCount + 1;
  await saveSession(phoneNumber, { messageCount: nextCount });

  return {
    allowed: true,
    limit: MAX_MESSAGES_PER_WINDOW,
    count: nextCount,
    remaining: Math.max(MAX_MESSAGES_PER_WINDOW - nextCount, 0),
    resetAt,
  };
}

export type {
  ConversationState,
  ConversationStep,
} from "./conversationState";
export {
  ConversationAction,
  ConversationField,
  CONVERSATION_FLOWS,
  CONVERSATION_STATE_TTL_MS,
  CANCEL_MESSAGE,
  CANCEL_KEYWORDS,
} from "./conversationState";

export {
  getConversationState,
  createConversationState,
  advanceConversationState,
  clearConversationState,
  updateConversationMetadata,
  isCancelMessage,
} from "./conversationStateManager";
