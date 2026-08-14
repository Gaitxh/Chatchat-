import {
  cloneProviderExecutionAudit,
  type ProviderExecutionAuditEvent,
} from "../provider-sdk/execution-audit.js";
import {
  cloneProviderTransportAudit,
  type ProviderExecutionMode,
  type ProviderTransportAuditRecord,
} from "../provider-sdk/transport-audit.js";

const DB_NAME = "chatchat-provider-execution-history-v1";
const DB_VERSION = 1;
const STORE = "receipts";
const MAX_ARCHIVES = 24;

export interface ExecutionAuditHistoryArchive {
  sessionId: string;
  savedAt: string;
  mode: ProviderExecutionMode | "unknown";
  transports: ProviderTransportAuditRecord[];
  execution: ProviderExecutionAuditEvent[];
}

export function createExecutionAuditHistoryArchive(
  sessionId: string,
  transports: readonly ProviderTransportAuditRecord[],
  execution: readonly ProviderExecutionAuditEvent[],
): ExecutionAuditHistoryArchive {
  const mode = transports.find((record) => record.sessionId === sessionId)?.mode ?? "unknown";
  return {
    sessionId,
    savedAt: new Date().toISOString(),
    mode,
    transports: transports
      .filter((record) => record.sessionId === sessionId)
      .map(cloneProviderTransportAudit),
    execution: execution
      .filter((event) => event.sessionId === sessionId)
      .map(cloneProviderExecutionAudit),
  };
}

export class ExecutionAuditHistoryStore {
  async save(archive: ExecutionAuditHistoryArchive): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction(STORE, "readwrite");
    const done = transactionDone(tx);
    tx.objectStore(STORE).put(cloneArchive(archive));
    await done;
    await prune(db);
  }

  async load(sessionId: string): Promise<ExecutionAuditHistoryArchive | null> {
    const db = await openDatabase();
    const tx = db.transaction(STORE, "readonly");
    const value = await requestValue<ExecutionAuditHistoryArchive | undefined>(tx.objectStore(STORE).get(sessionId));
    await transactionDone(tx);
    return value && isArchive(value) ? cloneArchive(value) : null;
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

function cloneArchive(archive: ExecutionAuditHistoryArchive): ExecutionAuditHistoryArchive {
  return {
    ...archive,
    transports: archive.transports.map(cloneProviderTransportAudit),
    execution: archive.execution.map(cloneProviderExecutionAudit),
  };
}

async function prune(db: IDBDatabase): Promise<void> {
  const tx = db.transaction(STORE, "readonly");
  const all = await requestValue<ExecutionAuditHistoryArchive[]>(tx.objectStore(STORE).getAll());
  await transactionDone(tx);
  const stale = all
    .filter(isArchive)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .slice(MAX_ARCHIVES);
  if (!stale.length) return;
  const deletion = db.transaction(STORE, "readwrite");
  const done = transactionDone(deletion);
  for (const item of stale) deletion.objectStore(STORE).delete(item.sessionId);
  await done;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable for Provider execution history."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE, { keyPath: "sessionId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open Provider execution history."));
    request.onblocked = () => reject(new Error("Provider execution history database is blocked by another tab."));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Provider execution history transaction aborted."));
    tx.onerror = () => reject(tx.error ?? new Error("Provider execution history transaction failed."));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Provider execution history request failed."));
  });
}

function isArchive(value: unknown): value is ExecutionAuditHistoryArchive {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ExecutionAuditHistoryArchive>;
  return Boolean(
    typeof candidate.sessionId === "string" &&
    typeof candidate.savedAt === "string" &&
    typeof candidate.mode === "string" &&
    Array.isArray(candidate.transports) &&
    Array.isArray(candidate.execution),
  );
}
