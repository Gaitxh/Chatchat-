import type {
  ArchivedCouncil,
  CouncilHistoryStore,
  CouncilHistorySummary,
} from "./types.js";
import { summarizeArchive } from "./types.js";

const STORAGE_KEY = "chatchat.council-history.v1";
const MAX_ARCHIVES = 50;

export class BrowserCouncilHistoryStore implements CouncilHistoryStore {
  readonly backend = "browser" as const;

  async save(archive: ArchivedCouncil): Promise<void> {
    const archives = this.#read().filter(
      (candidate) => candidate.sessionId !== archive.sessionId,
    );
    archives.unshift(archive);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(archives.slice(0, MAX_ARCHIVES)),
    );
  }

  async list(limit = 12): Promise<CouncilHistorySummary[]> {
    return this.#read()
      .slice(0, Math.max(0, limit))
      .map(summarizeArchive);
  }

  async load(sessionId: string): Promise<ArchivedCouncil | null> {
    return this.#read().find((archive) => archive.sessionId === sessionId) ?? null;
  }

  #read(): ArchivedCouncil[] {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isArchivedCouncil);
    } catch {
      return [];
    }
  }
}

function isArchivedCouncil(value: unknown): value is ArchivedCouncil {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ArchivedCouncil>;
  return (
    typeof candidate.sessionId === "string" &&
    typeof candidate.question === "string" &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.eventCount === "number" &&
    Array.isArray(candidate.events) &&
    typeof candidate.report === "object" &&
    candidate.report !== null
  );
}
