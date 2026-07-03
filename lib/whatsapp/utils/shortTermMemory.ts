const SHORT_TERM_MEMORY_TTL_MS = 5 * 60 * 1000;
const MAX_MEMORY_TURNS = 5;

export type ShortTermMemoryTurn = {
  toolName: string;
  parameters: Record<string, unknown>;
  userMessage: string;
  assistantReply: string;
  createdAt: string;
};

export type ShortTermMemorySnapshot = {
  turns: ShortTermMemoryTurn[];
  expiresAt: string;
};

type ShortTermMemoryEntry = {
  turns: ShortTermMemoryTurn[];
  expiresAtMs: number;
};

const shortTermMemoryBySession = new Map<string, ShortTermMemoryEntry>();

function isExpired(entry: ShortTermMemoryEntry, nowMs: number): boolean {
  return entry.expiresAtMs <= nowMs;
}

function toSnapshot(entry: ShortTermMemoryEntry): ShortTermMemorySnapshot {
  return {
    turns: [...entry.turns],
    expiresAt: new Date(entry.expiresAtMs).toISOString(),
  };
}

function cleanupExpiredMemory(nowMs = Date.now()): void {
  for (const [sessionId, entry] of shortTermMemoryBySession.entries()) {
    if (isExpired(entry, nowMs)) {
      shortTermMemoryBySession.delete(sessionId);
    }
  }
}

export function getShortTermMemory(
  sessionId: string,
): ShortTermMemorySnapshot | null {
  const nowMs = Date.now();
  cleanupExpiredMemory(nowMs);

  const entry = shortTermMemoryBySession.get(sessionId);
  if (!entry) return null;

  if (isExpired(entry, nowMs)) {
    shortTermMemoryBySession.delete(sessionId);
    return null;
  }

  entry.expiresAtMs = nowMs + SHORT_TERM_MEMORY_TTL_MS;
  return toSnapshot(entry);
}

export function rememberShortTermTopic(
  sessionId: string,
  turn: Omit<ShortTermMemoryTurn, "createdAt">,
): ShortTermMemorySnapshot {
  const nowMs = Date.now();
  cleanupExpiredMemory(nowMs);

  const existing = shortTermMemoryBySession.get(sessionId);
  const previousTurns =
    existing && !isExpired(existing, nowMs) ? existing.turns : [];

  const entry: ShortTermMemoryEntry = {
    turns: [
      ...previousTurns,
      {
        ...turn,
        createdAt: new Date(nowMs).toISOString(),
      },
    ].slice(-MAX_MEMORY_TURNS),
    expiresAtMs: nowMs + SHORT_TERM_MEMORY_TTL_MS,
  };

  shortTermMemoryBySession.set(sessionId, entry);
  return toSnapshot(entry);
}

export function clearShortTermMemory(sessionId: string): void {
  shortTermMemoryBySession.delete(sessionId);
}
