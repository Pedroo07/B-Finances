import { db } from "@/lib/firebaseAdmin";

export const DEFAULT_MAX_MESSAGE_AGE_SECONDS = 10 * 60;
const IN_PROGRESS_LOCK_TTL_MS = 3 * 60 * 1000;

export type MessageLockResult = {
  shouldProcess: boolean;
  reason?: "already_completed" | "already_in_progress" | "stale_message";
};

export function isMessageStale(
  messageTimestamp?: string | number | null,
  maxAgeSeconds: number = DEFAULT_MAX_MESSAGE_AGE_SECONDS,
): boolean {
  if (!messageTimestamp) return false;
  const numTimestamp =
    typeof messageTimestamp === "string"
      ? Number(messageTimestamp)
      : messageTimestamp;
  if (!Number.isFinite(numTimestamp) || numTimestamp <= 0) return false;

  const messageTimeMs = numTimestamp * 1000;
  const nowMs = Date.now();
  const ageSeconds = (nowMs - messageTimeMs) / 1000;

  return ageSeconds > maxAgeSeconds;
}

export async function acquireMessageLock(
  messageId: string | undefined | null,
  metadata: {
    phoneNumber: string;
    messageTimestamp?: string | number | null;
    messageType?: string;
  },
): Promise<MessageLockResult> {
  if (!messageId || typeof messageId !== "string" || !messageId.trim()) {
    return { shouldProcess: true };
  }

  const cleanMessageId = messageId.trim();

  if (isMessageStale(metadata.messageTimestamp)) {
    return { shouldProcess: false, reason: "stale_message" };
  }

  const docRef = db
    .collection("whatsapp_processed_messages")
    .doc(cleanMessageId);

  return await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(docRef);

    if (doc.exists) {
      const data = doc.data();
      const status = data?.status;

      if (status === "completed") {
        return { shouldProcess: false, reason: "already_completed" };
      }

      if (status === "processing") {
        const rawReceivedAt = data?.receivedAt;
        const receivedAt =
          typeof rawReceivedAt?.toDate === "function"
            ? rawReceivedAt.toDate()
            : rawReceivedAt instanceof Date
              ? rawReceivedAt
              : null;
        const elapsedMs = receivedAt ? Date.now() - receivedAt.getTime() : 0;

        if (elapsedMs < IN_PROGRESS_LOCK_TTL_MS) {
          return { shouldProcess: false, reason: "already_in_progress" };
        }

        transaction.update(docRef, {
          status: "processing",
          receivedAt: new Date(),
          retryCount: (data?.retryCount || 0) + 1,
        });
        return { shouldProcess: true };
      }
    }

    transaction.set(docRef, {
      messageId: cleanMessageId,
      phoneNumber: metadata.phoneNumber,
      messageTimestamp: metadata.messageTimestamp
        ? Number(metadata.messageTimestamp)
        : null,
      messageType: metadata.messageType || "unknown",
      status: "processing",
      receivedAt: new Date(),
      retryCount: 0,
    });

    return { shouldProcess: true };
  });
}

export async function markMessageCompleted(
  messageId: string | undefined | null,
  details?: {
    userId?: string;
    action?: string;
    transactionId?: string;
  },
): Promise<void> {
  if (!messageId || typeof messageId !== "string") return;
  const cleanMessageId = messageId.trim();

  try {
    await db
      .collection("whatsapp_processed_messages")
      .doc(cleanMessageId)
      .set(
        {
          status: "completed",
          completedAt: new Date(),
          ...(details?.userId && { userId: details.userId }),
          ...(details?.action && { action: details.action }),
          ...(details?.transactionId && {
            transactionId: details.transactionId,
          }),
        },
        { merge: true },
      );
  } catch (err) {
    console.error(
      `Erro ao marcar mensagem ${cleanMessageId} como completed:`,
      err,
    );
  }
}

export async function markMessageFailed(
  messageId: string | undefined | null,
  error?: unknown,
): Promise<void> {
  if (!messageId || typeof messageId !== "string") return;
  const cleanMessageId = messageId.trim();

  try {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    await db
      .collection("whatsapp_processed_messages")
      .doc(cleanMessageId)
      .set(
        {
          status: "failed",
          failedAt: new Date(),
          errorMessage: errorMessage.slice(0, 500),
        },
        { merge: true },
      );
  } catch (err) {
    console.error(
      `Erro ao marcar mensagem ${cleanMessageId} como failed:`,
      err,
    );
  }
}
