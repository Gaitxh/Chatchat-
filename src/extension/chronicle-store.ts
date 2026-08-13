import type {
  CouncilEvent,
  CouncilParticipant,
  CouncilReport,
} from "../core/types.js";

const DB_NAME = "chatchat-browser-chronicle";
const DB_VERSION = 1;
const ARCHIVE_STORE = "councils";
const SUMMARY_STORE = "summaries";
const CREATED_AT_INDEX = "createdAt";

export interface BrowserChronicleArchive {
  schemaVersion: 1;
  sessionId: string;
  createdAt: string;
  question: string;
  report: CouncilReport;
  events: CouncilEvent[];
  participants: CouncilParticipant[];
}

export interface BrowserChronicleSummary {
  schemaVersion: 1;
  sessionId: string;
  createdAt: string;
  questionPreview: string;
  rounds: number;
  eventCount: number;
  participantCount: number;
  consensusStance: string | null;
  consensusRatio: number;
  changedMindCount: number;
  minorityOpinionPresent: boolean;
}

export function createBrowserChronicleArchive(
  report: CouncilReport,
  events: readonly CouncilEvent[],
): BrowserChronicleArchive {
  const participants = uniqueParticipants(
    report.positions.map((position) => position.participant),
  );
  return {
    schemaVersion: 1,
    sessionId: report.sessionId,
    createdAt: events.at(0)?.createdAt ?? new Date().toISOString(),
    question: report.question,
    report: cloneJson(report),
    events: cloneJson([...events]),
    participants: cloneJson(participants),
  };
}

export function summarizeBrowserChronicle(
  archive: BrowserChronicleArchive,
): BrowserChronicleSummary {
  return {
    schemaVersion: 1,
    sessionId: archive.sessionId,
    createdAt: archive.createdAt,
    questionPreview: preview(archive.question, 110),
    rounds: archive.report.rounds,
    eventCount: archive.events.length,
    participantCount: archive.participants.length,
    consensusStance: archive.report.consensusStance,
    consensusRatio: clamp01(archive.report.consensusRatio),
    changedMindCount: archive.events.filter((event) => event.kind === "revision").length,
    minorityOpinionPresent: archive.report.disagreements.length > 0,
  };
}

export function isBrowserChronicleArchive(
  value: unknown,
): value is BrowserChronicleArchive {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<BrowserChronicleArchive>;
  if (
    item.schemaVersion !== 1 ||
    typeof item.sessionId !== "string" ||
    !item.sessionId ||
    typeof item.createdAt !== "string" ||
    typeof item.question !== "string" ||
    !Array.isArray(item.events) ||
    !Array.isArray(item.participants) ||
    !item.report ||
    typeof item.report !== "object"
  ) return false;
  const report = item.report as CouncilReport;
  if (
    report.sessionId !== item.sessionId ||
    typeof report.question !== "string" ||
    !Array.isArray(report.positions) ||
    !Array.isArray(report.disagreements) ||
    !Number.isFinite(report.rounds) ||
    !Number.isFinite(report.eventCount)
  ) return false;
  return item.events.every((event) => isMinimalCouncilEvent(event));
}

export async function saveBrowserChronicle(
  archive: BrowserChronicleArchive,
): Promise<void> {
  if (!isBrowserChronicleArchive(archive)) {
    throw new Error("Refusing to save an invalid Browser Chronicle archive.");
  }
  const db = await openChronicleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([ARCHIVE_STORE, SUMMARY_STORE], "readwrite");
    tx.objectStore(ARCHIVE_STORE).put(cloneJson(archive));
    tx.objectStore(SUMMARY_STORE).put(summarizeBrowserChronicle(archive));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Chronicle save transaction failed."));
    tx.onabort = () => reject(tx.error ?? new Error("Chronicle save transaction aborted."));
  });
  db.close();
}

export async function listBrowserChronicle(
  limit = 12,
): Promise<BrowserChronicleSummary[]> {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
  const db = await openChronicleDb();
  try {
    return await new Promise<BrowserChronicleSummary[]>((resolve, reject) => {
      const tx = db.transaction(SUMMARY_STORE, "readonly");
      const index = tx.objectStore(SUMMARY_STORE).index(CREATED_AT_INDEX);
      const request = index.openCursor(null, "prev");
      const result: BrowserChronicleSummary[] = [];
      request.onerror = () => reject(request.error ?? new Error("Chronicle list failed."));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || result.length >= safeLimit) {
          resolve(result);
          return;
        }
        if (isBrowserChronicleSummary(cursor.value)) result.push(cursor.value);
        cursor.continue();
      };
    });
  } finally {
    db.close();
  }
}

export async function loadBrowserChronicle(
  sessionId: string,
): Promise<BrowserChronicleArchive | null> {
  const db = await openChronicleDb();
  try {
    const value = await requestToPromise<unknown>(
      db.transaction(ARCHIVE_STORE, "readonly")
        .objectStore(ARCHIVE_STORE)
        .get(sessionId),
    );
    return isBrowserChronicleArchive(value) ? value : null;
  } finally {
    db.close();
  }
}

export async function deleteBrowserChronicle(sessionId: string): Promise<void> {
  const db = await openChronicleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([ARCHIVE_STORE, SUMMARY_STORE], "readwrite");
    tx.objectStore(ARCHIVE_STORE).delete(sessionId);
    tx.objectStore(SUMMARY_STORE).delete(sessionId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Chronicle delete failed."));
    tx.onabort = () => reject(tx.error ?? new Error("Chronicle delete aborted."));
  });
  db.close();
}

export async function clearBrowserChronicle(): Promise<void> {
  const db = await openChronicleDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([ARCHIVE_STORE, SUMMARY_STORE], "readwrite");
    tx.objectStore(ARCHIVE_STORE).clear();
    tx.objectStore(SUMMARY_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Chronicle clear failed."));
    tx.onabort = () => reject(tx.error ?? new Error("Chronicle clear aborted."));
  });
  db.close();
}

function openChronicleDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is unavailable in this Browser context."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("Could not open Browser Chronicle IndexedDB."));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ARCHIVE_STORE)) {
        db.createObjectStore(ARCHIVE_STORE, { keyPath: "sessionId" });
      }
      if (!db.objectStoreNames.contains(SUMMARY_STORE)) {
        const summaries = db.createObjectStore(SUMMARY_STORE, { keyPath: "sessionId" });
        summaries.createIndex(CREATED_AT_INDEX, "createdAt", { unique: false });
      } else {
        const tx = request.transaction;
        const summaries = tx?.objectStore(SUMMARY_STORE);
        if (summaries && !summaries.indexNames.contains(CREATED_AT_INDEX)) {
          summaries.createIndex(CREATED_AT_INDEX, "createdAt", { unique: false });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function isBrowserChronicleSummary(
  value: unknown,
): value is BrowserChronicleSummary {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<BrowserChronicleSummary>;
  return (
    item.schemaVersion === 1 &&
    typeof item.sessionId === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.questionPreview === "string" &&
    typeof item.rounds === "number" &&
    typeof item.eventCount === "number" &&
    typeof item.participantCount === "number" &&
    typeof item.consensusRatio === "number" &&
    typeof item.changedMindCount === "number" &&
    typeof item.minorityOpinionPresent === "boolean"
  );
}

function isMinimalCouncilEvent(value: unknown): value is CouncilEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<CouncilEvent>;
  return (
    typeof event.id === "string" &&
    typeof event.sessionId === "string" &&
    typeof event.actorId === "string" &&
    typeof event.kind === "string" &&
    typeof event.round === "number" &&
    typeof event.createdAt === "string"
  );
}

function uniqueParticipants(values: readonly CouncilParticipant[]): CouncilParticipant[] {
  const seen = new Set<string>();
  const result: CouncilParticipant[] = [];
  for (const participant of values) {
    if (seen.has(participant.id)) continue;
    seen.add(participant.id);
    result.push({ ...participant });
  }
  return result;
}

function preview(value: string, max: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 1)}…`;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function cloneJson<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
