import type { EvidenceVerificationSnapshot } from "../evidence/evidence-ledger.js";

const DB_NAME = "chatchat-evidence-history-v1";
const DB_VERSION = 1;
const STORE = "observations";
const MAX_ARCHIVES = 24;

export interface EvidenceHistoryArchive {
  sessionId: string;
  savedAt: string;
  verifications: Record<string, EvidenceVerificationSnapshot>;
}

export class EvidenceHistoryStore {
  async save(sessionId: string, verifications: Readonly<Record<string, EvidenceVerificationSnapshot>>): Promise<void> {
    const archive: EvidenceHistoryArchive = {
      sessionId,
      savedAt: new Date().toISOString(),
      verifications: Object.fromEntries(
        Object.entries(verifications).map(([eventId, snapshot]) => [eventId, { ...snapshot }]),
      ),
    };
    const db = await openDatabase();
    const tx = db.transaction(STORE, "readwrite");
    const done = transactionDone(tx);
    tx.objectStore(STORE).put(archive);
    await done;
    await prune(db);
  }

  async load(sessionId: string): Promise<EvidenceHistoryArchive | null> {
    const db = await openDatabase();
    const tx = db.transaction(STORE, "readonly");
    const value = await requestValue<EvidenceHistoryArchive | undefined>(tx.objectStore(STORE).get(sessionId));
    await transactionDone(tx);
    return value && isArchive(value) ? value : null;
  }

  async delete(sessionId: string): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction(STORE, "readwrite");
    const done = transactionDone(tx);
    tx.objectStore(STORE).delete(sessionId);
    await done;
  }

  async clear(): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction(STORE, "readwrite");
    const done = transactionDone(tx);
    tx.objectStore(STORE).clear();
    await done;
  }
}

async function prune(db: IDBDatabase) {
  const tx = db.transaction(STORE, readonly);
  const all = await requestValue<EvidenceHistoryArchive[]>(tx.objectStore(STORE).getAll());
  await transactionDone(tx);
  const stale = all.filter(isArchive).sort((a, b) => b.savedAt.localeCompare(a.savedAt)).slice(MAX_ARCHIVES);
  if (!stale.length) return;
  const deletion = db.transaction(STORE,"readwrite");
  const done = transactionDone(deletion);
  for (const item of stale) deletion.objectStore(STORE).delete(item.sessionId);
  await done;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable for evidence history."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "sessionId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open evidence history."));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Evidence history transaction aborted."));
    tx.onerror = () => reject(tx.error ?? new Error("Evidence history transaction failed."));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Evidence history request failed."));
  });
}

function isArchive(value: unknown): value is EvidenceHistoryArchive {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<EvidenceHistoryArchive>;
  return typeof candidate.sessionId === "string" && typeof candidate.savedAt === "string" && Boolean(candidate.verifications && typeof candidate.verifications === "object");
}
