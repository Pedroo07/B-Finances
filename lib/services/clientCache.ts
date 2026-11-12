export type ClientCacheKey =
  | "transactions"
  | "cardTransactions"
  | "billAccounts"
  | "userCreditCards"
  | "investments";

const CACHE_PREFIX = "bfinance_cache_v1";
const LAST_UID_KEY = "bfinance_last_uid_v1";

const memoryCache = new Map<string, unknown>();

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function buildStorageKey(userId: string, key: ClientCacheKey): string {
  return `${CACHE_PREFIX}:${userId}:${key}`;
}

export function getLastActiveUid(): string | null {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(LAST_UID_KEY);
  } catch {
    return null;
  }
}

export function setLastActiveUid(userId: string | null): void {
  if (!isBrowser()) return;
  try {
    if (userId) {
      window.localStorage.setItem(LAST_UID_KEY, userId);
    } else {
      window.localStorage.removeItem(LAST_UID_KEY);
    }
  } catch {
    return;
  }
}

export function getCachedData<T>(
  key: ClientCacheKey,
  userId?: string | null,
): T | null {
  if (!isBrowser()) return null;
  const resolvedUid = userId ?? getLastActiveUid();
  if (!resolvedUid) return null;

  const storageKey = buildStorageKey(resolvedUid, key);
  if (memoryCache.has(storageKey)) {
    return memoryCache.get(storageKey) as T;
  }

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    memoryCache.set(storageKey, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedData<T>(
  key: ClientCacheKey,
  data: T,
  userId?: string | null,
): void {
  if (!isBrowser()) return;
  const resolvedUid = userId ?? getLastActiveUid();
  if (!resolvedUid) return;

  setLastActiveUid(resolvedUid);
  const storageKey = buildStorageKey(resolvedUid, key);
  memoryCache.set(storageKey, data);

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(data));
  } catch {
    return;
  }
}

export function invalidateCachedData(
  keys: ClientCacheKey | ClientCacheKey[],
  userId?: string | null,
): void {
  if (!isBrowser()) return;
  const resolvedUid = userId ?? getLastActiveUid();
  if (!resolvedUid) return;

  const keyList = Array.isArray(keys) ? keys : [keys];
  for (const key of keyList) {
    const storageKey = buildStorageKey(resolvedUid, key);
    memoryCache.delete(storageKey);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      continue;
    }
  }
}
