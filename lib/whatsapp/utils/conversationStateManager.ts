import { db } from "@/lib/firebaseAdmin";
import {
  ConversationState,
  ConversationAction,
  ConversationField,
  CONVERSATION_FLOWS,
  CONVERSATION_STATE_TTL_MS,
  CANCEL_KEYWORDS,
} from "./conversationState";

export async function getConversationState(
  phoneNumber: string
): Promise<ConversationState | null> {
  const doc = await db
    .collection("whatsapp_sessions")
    .doc(phoneNumber)
    .get();

  if (!doc.exists) return null;

  const data = doc.data();
  const state: ConversationState | undefined = data?.conversationState;

  if (!state) return null;

  if (Date.now() > state.expiresAt) {
    await clearConversationState(phoneNumber);
    console.log(`[ConversationState] Estado expirado para ${phoneNumber}. Limpo.`);
    return null;
  }

  return state;
}

export async function createConversationState(
  phoneNumber: string,
  action: ConversationAction,
  initialData: Record<string, any> = {},
  metadata: Record<string, any> = {}
): Promise<{ state: ConversationState; question: string }> {
  const flow = CONVERSATION_FLOWS[action];

  if (!flow || flow.length === 0) {
    throw new Error(`[ConversationState] Fluxo não definido para ação: ${action}`);
  }

  const nextStep = flow.find((step) => !(step.field in initialData));

  const now = Date.now();

  const state: ConversationState = {
    action,
    collectedData: { ...initialData },
    nextQuestion: nextStep?.question ?? null,
    awaitingField: nextStep?.field ?? null,
    expiresAt: now + CONVERSATION_STATE_TTL_MS,
    createdAt: now,
    metadata,
  };

  await db
    .collection("whatsapp_sessions")
    .doc(phoneNumber)
    .set({ conversationState: state }, { merge: true });

  const question =
    nextStep?.question ??
    "✅ Dados coletados. Processando sua solicitação...";

  console.log(
    `[ConversationState] Estado criado para ${phoneNumber}:`,
    action,
    "| Aguardando campo:",
    state.awaitingField
  );

  return { state, question };
}

export async function advanceConversationState(
  phoneNumber: string,
  currentState: ConversationState,
  userAnswer: string
): Promise<{
  state: ConversationState;
  isComplete: boolean;
  nextQuestion: string | null;
}> {
  const flow = CONVERSATION_FLOWS[currentState.action];

  const updatedData = { ...currentState.collectedData };
  if (currentState.awaitingField) {
    updatedData[currentState.awaitingField] = userAnswer;
  }
  
  const nextStep = flow.find((step) => !(step.field in updatedData));
  const isComplete = !nextStep;

  const updatedState: ConversationState = {
    ...currentState,
    collectedData: updatedData,
    nextQuestion: nextStep?.question ?? null,
    awaitingField: nextStep?.field ?? null,
    expiresAt: Date.now() + CONVERSATION_STATE_TTL_MS,
  };

  await db
    .collection("whatsapp_sessions")
    .doc(phoneNumber)
    .set({ conversationState: updatedState }, { merge: true });

  console.log(
    `[ConversationState] Avançado para ${phoneNumber}:`,
    `campo "${currentState.awaitingField}" → "${userAnswer}"`,
    `| completo: ${isComplete}`,
    isComplete ? "" : `| próximo: ${nextStep?.field}`
  );

  return {
    state: updatedState,
    isComplete,
    nextQuestion: nextStep?.question ?? null,
  };
}

export async function clearConversationState(
  phoneNumber: string
): Promise<void> {
  await db
    .collection("whatsapp_sessions")
    .doc(phoneNumber)
    .set({ conversationState: null }, { merge: true });

  console.log(`[ConversationState] Estado limpo para ${phoneNumber}.`);
}


export async function updateConversationMetadata(
  phoneNumber: string,
  metadata: Record<string, any>
): Promise<void> {
  const current = await getConversationState(phoneNumber);
  if (!current) return;

  const updated: ConversationState = {
    ...current,
    metadata: { ...(current.metadata || {}), ...metadata },
  };

  await db
    .collection("whatsapp_sessions")
    .doc(phoneNumber)
    .set({ conversationState: updated }, { merge: true });
}

export function isCancelMessage(message: string): boolean {
  return CANCEL_KEYWORDS.includes(message.trim().toLowerCase());
}
