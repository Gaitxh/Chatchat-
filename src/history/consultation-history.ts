import type {
  CouncilConsultationMode,
  CouncilEvent,
  CouncilReport,
} from "../core/types.js";

const DB_NAME = "chatchat-consultation-history-v1";
const DB_VERSION = 1;
const ARCHIVES = "archives";
const SUMMARIES = "summaries";
export const MAX_CONSULTATION_HISTORY = 24;

export interface ConsultationArchive {
  sessionId: string;
  proposal: string;
  createdAt: string;
  report: CouncilReport;
  events: CouncilEvent[];
}

export interface ConsultationHistorySummary {
  sessionId: string;
  proposalPreview: string;
  createdAt: string;
  participantCount: number;
  rounds: number;
  eventCount: number;
  mode?: CouncilConsultationMode;
  challengeCount?: number;
  revisionCount: number;
  evidenceCount: number;
  concessionCount?: number;
  consensusStance: string | null;
  consensusRatio: number;
  minoritySurvives: boolean;
}

export function createConsultationArchive(
  report: CouncilReport,
  events: readonly CouncilEvent[],
): ConsultationArchive {
  return {
    sessionId: report.sessionId,
    proposal: report.question,
    createdAt: events.at(-1)?.createdAt ?? new Date().toISOString(),
    report,
    events: [...events],
  };
}

export function summarizeConsultationArchive(
  archive: ConsultationArchive,
): ConsultationHistorySummary {
  return {
    sessionId: archive.sessionId,
    proposalPreview: compact(archive.proposal, 140),
    createdAt: archive.createdAt,
    participantCount: archive.report.positions.length,
    rounds: archive.report.rounds,
    eventCount: archive.events.length,
    mode: archive.report.mode ?? "balanced",
    challengeCount: archive.events.filter((event) => event.kind === "challenge").length,
    revisionCount: archive.events.filter((event) => event.kind === "revision").length,
    evidenceCount: archive.events.filter((event) => event.kind === "evidence").length,
    concessionCount: archive.events.filter((event) => event.kind === "concede").length,
    consensusStance: archive.report.consensusStance,
    consensusRatio: archive.report.consensusRatio,
    minoritySurvives: archive.report.disagreements.length > 0,
  };
}

export class ConsultationHistoryStore {
  async save(archive: ConsultationArchive): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction([ARCHIVES, SUMMARIES], "readwrite");
    const done = transactionDone(tx);
    tx.objectStore(ARCHIVES).put(archive);
    tx.objectStore(SUMMARIES).put(summarizeConsultationArchive(archive));
    await done;
    await pruneHistory(db);
  }

  async list(limit = 12): Promise<ConsultationHistorySummary[]> {
    const db = await openDatabase();
    const tx = db.transaction(SUMMARIES, "readonly");
    const request = tx.objectStore(SUMMARIES).getAll();
    const result = await requestValue<ConsultationHistorySummary[]>(request);
    await transactionDone(tx);
    return result
      .filter(isHistorySummary)
      .map(normalizeHistorySummary)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(0, limit));
  }

  async load(sessionId: string): Promise<ConsultationArchive | null> {
    const db = await openDatabase();
    const tx = db.transaction(ARCHIVES, "readonly");
    const request = tx.objectStore(ARCHIVES).get(sessionId);
    const value = await requestValue<ConsultationArchive | undefined>(request);
    await transactionDone(tx);
    return value && isConsultationArchive(value) ? value : null;
  }

  async delete(sessionId: string): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction([ARCHIVES, SUMMARIES], "readwrite");
    const done = transactionDone(tx);
    tx.objectStore(ARCHIVES).delete(sessionId);
    tx.objectStore(SUMMARIES).delete(sessionId);
    await done;
  }

  async clear(): Promise<void> {
    const db = await openDatabase();
    const tx = db.transaction([ARCHIVES, SUMMARIES], "readwrite");
    const done = transactionDone(tx);
    tx.objectStore(ARCHIVES).clear();
    tx.objectStore(SUMMARIES).clear();
    await done;
  }
}

async function pruneHistory(db: IDBDatabase): Promise<void> {
  const tx = db.transaction(SUMMARIES, "readonly");
  const summaries = await requestValue<ConsultationHistorySummary[]>(
    tx.objectStore(SUMMARIES).getAll(),
  );
  await transactionDone(tx);
  const stale = summaries
    .filter(isHistorySummary)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(MAX_CONSULTATION_HISTORY);
  if (!stale.length) return;
  const deleteTx = db.transaction([ARCHIVES, SUMMARIES], "readwrite");
  const done = transactionDone(deleteTx);
  for (const summary of stale) {
    deleteTx.objectStore(ARCHIVES).delete(summary.sessionId);
    deleteTx.objectStore(SUMMARIES).delete(summary.sessionId);
  }
  await done;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable in this browser context."));
      return;
    }
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
    request.onerror = () => reject(request.error ?? new Error("Could not open consultation history."));
    request.onblocked = () => reject(new Error("Consultation history database is blocked by another tab."));
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error("Consultation history transaction was aborted."));
    tx.onerror = () => reject(tx.error ?? new Error("Consultation history transaction failed."));
  });
}

function requestValue<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Consultation history request failed."));
  });
}

function isConsultationArchive(value: unknown): value is ConsultationArchive {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ConsultationArchive>;
  return Boolean(
    typeof candidate.sessionId === "string" &&
      typeof candidate.proposal === "string" &&
      typeof candidate.createdAt === "string" &&
      candidate.report &&
      typeof candidate.report === "object" &&
      Array.isArray(candidate.events),
  );
}

function isHistorySummary(value: unknown): value is ConsultationHistorySummary {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ConsultationHistorySummary>;
  return (
    typeof candidate.sessionId === "string" &&
    typeof candidate.proposalPreview === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.eventCount === "number"
  );
}

function normalizeHistorySummary(summary: ConsultationHistorySummary): ConsultationHistorySummary {
  return {
    ...summary,
    mode: isMode(summary.mode) ? summary.mode : "balanced",
    challengeCount: typeof summary.challengeCount === "number" ? summary.challengeCount : 0,
    concessionCount: typeof summary.concessionCount === "number" ? summary.concessionCount : 0,
  };
}

function isMode(value: unknown): value is CouncilConsultationMode {
  return value === "balanced" || value === "explore" || value === "decide" || value === "verify" || value === "stress_test";
}

function compact(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}
