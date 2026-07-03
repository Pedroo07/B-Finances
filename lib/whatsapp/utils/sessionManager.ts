import { db } from "@/lib/firebaseAdmin";

export type WhatsappSession = {
  history: Array<{
    role: "user" | "assistant";
    text: string;
    timestamp: Date;
  }>;
  pendingAction?: {
    type: string;
    [key: string]: any;
  };
  lastMessageAt?: Date;
  messageCount?: number;
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

export async function setPendingAction(phoneNumber: string, action: any): Promise<void> {
  await saveSession(phoneNumber, { pendingAction: action });
}

export async function getPendingAction(phoneNumber: string): Promise<any | null> {
  const session = await getSession(phoneNumber);
  return session?.pendingAction || null;
}

export async function clearPendingAction(phoneNumber: string): Promise<void> {
  await db
    .collection("whatsapp_sessions")
    .doc(phoneNumber)
    .update({ pendingAction: null });
}

const LIMIT_WINDOW_MS = 60 * 1000;
const MAX_MESSAGES_PER_WINDOW = 100;

export async function checkRateLimit(phoneNumber: string): Promise<boolean> {
  const session = await getSession(phoneNumber);
  const now = new Date();

  if (!session) {
    await saveSession(phoneNumber, {
      lastMessageAt: now,
      messageCount: 1,
    });
    return true;
  }

  const lastMessageAt = session.lastMessageAt ? new Date(session.lastMessageAt) : now;
  const elapsed = now.getTime() - lastMessageAt.getTime();

  if (elapsed < LIMIT_WINDOW_MS) {
    const count = (session.messageCount || 0) + 1;
    await saveSession(phoneNumber, { messageCount: count });
    
    if (count > MAX_MESSAGES_PER_WINDOW) {
      return false; 
    }
  } else {
    await saveSession(phoneNumber, {
      lastMessageAt: now,
      messageCount: 1,
    });
  }

  return true;
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