import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const firestoreStore = new Map();

const mockFirestore = {
  collection(colName) {
    return {
      doc(docId) {
        return {
          id: docId,
          async get() {
            const data = firestoreStore.get(`${colName}/${docId}`);
            return {
              exists: Boolean(data),
              data: () => data,
            };
          },
          async set(data, options) {
            const key = `${colName}/${docId}`;
            if (options?.merge && firestoreStore.has(key)) {
              firestoreStore.set(key, { ...firestoreStore.get(key), ...data });
            } else {
              firestoreStore.set(key, data);
            }
          },
          async update(data) {
            const key = `${colName}/${docId}`;
            const existing = firestoreStore.get(key) || {};
            firestoreStore.set(key, { ...existing, ...data });
          },
        };
      },
    };
  },
  async runTransaction(updateFunction) {
    const transaction = {
      async get(docRef) {
        return await docRef.get();
      },
      set(docRef, data) {
        firestoreStore.set(`whatsapp_processed_messages/${docRef.id}`, data);
      },
      update(docRef, data) {
        const key = `whatsapp_processed_messages/${docRef.id}`;
        const existing = firestoreStore.get(key) || {};
        firestoreStore.set(key, { ...existing, ...data });
      },
    };
    return await updateFunction(transaction);
  },
};

globalThis.__mockFirestore = mockFirestore;

const firebaseStub = `data:text/javascript,${encodeURIComponent(
  "export const db = globalThis.__mockFirestore;",
)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/firebaseAdmin") {
      return { url: firebaseStub, shortCircuit: true };
    }
    if (specifier.startsWith("@/")) {
      const path = resolve(process.cwd(), `${specifier.slice(2)}.ts`);
      return nextResolve(pathToFileURL(path).href, context);
    }
    const relative = specifier.startsWith("./") || specifier.startsWith("../");
    const isProjectModule =
      context.parentURL?.includes("/lib/whatsapp/") ||
      context.parentURL?.includes("\\lib\\whatsapp\\");
    if (relative && isProjectModule && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const {
  isMessageStale,
  acquireMessageLock,
  markMessageCompleted,
  markMessageFailed,
} = await import("./messageDeduplicator.ts");

test("isMessageStale detecta mensagens recentes e antigas corretamente", () => {
  const nowSeconds = Math.floor(Date.now() / 1000);

  assert.equal(isMessageStale(nowSeconds - 5), false);
  assert.equal(isMessageStale(nowSeconds - 300), false);
  assert.equal(isMessageStale(nowSeconds - 660), true);
  assert.equal(isMessageStale(nowSeconds - 28800), true);
  assert.equal(isMessageStale(String(nowSeconds - 10)), false);
  assert.equal(isMessageStale(String(nowSeconds - 3600)), true);
  assert.equal(isMessageStale(null), false);
  assert.equal(isMessageStale(undefined), false);
});

test("acquireMessageLock bloqueia duplicatas e permite primeira execução", async () => {
  firestoreStore.clear();

  const msgId = "wamid.HBgLTEST123456";
  const nowSeconds = Math.floor(Date.now() / 1000);

  const firstLock = await acquireMessageLock(msgId, {
    phoneNumber: "5511999999999",
    messageTimestamp: nowSeconds,
    messageType: "text",
  });
  assert.equal(firstLock.shouldProcess, true);

  const concurrentLock = await acquireMessageLock(msgId, {
    phoneNumber: "5511999999999",
    messageTimestamp: nowSeconds,
    messageType: "text",
  });
  assert.equal(concurrentLock.shouldProcess, false);
  assert.equal(concurrentLock.reason, "already_in_progress");

  await markMessageCompleted(msgId, {
    userId: "user-123",
    action: "create",
    transactionId: "tx-456",
  });

  const retryLock = await acquireMessageLock(msgId, {
    phoneNumber: "5511999999999",
    messageTimestamp: nowSeconds,
    messageType: "text",
  });
  assert.equal(retryLock.shouldProcess, false);
  assert.equal(retryLock.reason, "already_completed");
});

test("acquireMessageLock bloqueia imediatamente mensagem antiga/stale mesmo que não tenha sido processada", async () => {
  firestoreStore.clear();

  const msgId = "wamid.HBgL_OLD_MSG_RETRY";
  const tenHoursAgoSeconds = Math.floor(Date.now() / 1000) - 36000;

  const staleLock = await acquireMessageLock(msgId, {
    phoneNumber: "5511999999999",
    messageTimestamp: tenHoursAgoSeconds,
    messageType: "text",
  });

  assert.equal(staleLock.shouldProcess, false);
  assert.equal(staleLock.reason, "stale_message");
});

test("markMessageFailed atualiza status para failed", async () => {
  firestoreStore.clear();

  const msgId = "wamid.HBgL_FAILED_MSG";
  await acquireMessageLock(msgId, {
    phoneNumber: "5511999999999",
    messageType: "text",
  });

  await markMessageFailed(msgId, new Error("Gemini rate limit exceeded"));

  const stored = firestoreStore.get(`whatsapp_processed_messages/${msgId}`);
  assert.equal(stored.status, "failed");
  assert.match(stored.errorMessage, /Gemini rate limit exceeded/);
});
