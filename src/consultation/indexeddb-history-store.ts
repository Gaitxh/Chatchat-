import type {
  BrowserChronicleArchive,
  BrowserChronicleSummary,
} from "../extension/chronicle-store.js";

const DB_NAME = "chatchat_consultation_history_v1";
const DB_VERSION = 1;
const ARCHIVES = "archives";
const SUMMARIES = "summaries";

export interface IndexedDbConsultationHistoryStore {
  put(archive: BrowserChronicleArchive, summary: BrowserChronicleSummary): Promise<void>;
  list(limit: number): Promise<BrowserChronicleSummary[]>;
  get(sessionId: string): Promise<BrowserChronicleArchive | null>;
  remove(sessionId: string): Promise<void>;
  clear(): Promise<void>;
}

export function createIndexedDbConsultationHistoryStore(): IndexedDbConsultationHistoryStore {
  return {
    async put(archive, summary) {
      const db = await openDatabase();
      try {
        const tx = db.transaction([ARCHIVES, SUMMARIES], "readwrite");
        // Register completion/error handlers BEFORE queueing requests. IndexedDB
        // transactions may auto-complete as soon as the current request batch
        // drains; binding oncomplete after awaiting requests can miss the event
        // and leave the caller pending forever.
        const done = transactionDone(tx);
        tx.objectStore(ARCHIVES).put(clone(archive));
        tx.objectStore(SUMMARIES).put(clone(summary));
        await done;
      } finally {
        db.close();
      }
    },

    async list(limit) {
      const db = await openDatabase();
      try {
        const tx = db.transaction(SUMMARIES, "readonly");
        const done = transactionDone(tx);
        const request = tx.objectStore(SUMMARIES).getAll();
        const values = await requestResult<BrowserChronicleSummary[]>(request);
        await done;
        return values
          .filter(isSummary)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, Math.max(1, limit))
          .map(clone);
      } finally {
        db.close();
      }
    },

    async get(sessionId) {
      const db = await openDatabase();
      try {
        const tx = db.transaction(ARCHIVES, "readonly");
        const done = transactionDone(tx);
        const request = tx.objectStore(ARCHIVES).get(sessionId);
        const value = await requestResult<BrowserChronicleArchive | undefined>(request);
        await done;
        return value && isArchive(value) ? clone(value) : null;
      } finally {
        db.close();
      }
    },

    async remove(sessionId) {
      const db = await openDatabase();
      try {
        const tx = db.transaction([ARCHIVES, SUMMARIES], "readwrite");
        const done = transactionDone(tx);
        tx.objectStore(ARCHIVES).delete(sessionId);
        tx.objectStore(SUMMARIES).delete(sessionId);
        await done;
      } finally {
        db.close();
      }
    },

    async clear() {
      const db = await openDatabase();
      try {
        const tx = db.transaction([ARCHIVES, SUMMARIES], "readwrite");
        const done = transactionDone(tx);
        tx.objectStore(ARCHIVES).clear();
        tx.objectStore(SUMMARIES).clear();
        await done;
      } finally {
        db.close();
      }
    },
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ARCHIVES)) {
        db.createObjectStore(ARCHIVES, { keyPath: "sessionId" });
      }
      if (!db.objectStoreNames.contains(SUMMARIES)) {
        db.createObjectStore(SUMMARIES, { keyPath: "sessionId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open local Consultation History database."));
    request.onblocked = () => reject(new Error("Consultation History database upgrade is blocked by another ChatChat tab."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Consultation History transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Consultation History transaction was aborted."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Consultation History request failed."));
  });
}

function isSummary(value: unknown): value is BrowserChronicleSummary {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<BrowserChronicleSummary>;
  return (
    typeof record.sessionId === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.questionPreview === "string" &&
    typeof record.eventCount === "number" &&
    typeof record.rounds === "number"
  );
}

function isArchive(value: unknown): value is BrowserChronicleArchive {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<BrowserChronicleArchive>;
  return (
    typeof record.sessionId === "string" &&
    typeof record.question === "string" &&
    Array.isArray(record.events) &&
    Array.isArray(record.participants) &&
    Boolean(record.report)
  );
}

function clone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value)) as T;
}
