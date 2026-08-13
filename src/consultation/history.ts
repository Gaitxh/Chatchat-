import {
  clearBrowserChronicle,
  createBrowserChronicleArchive,
  deleteBrowserChronicle,
  listBrowserChronicle,
  loadBrowserChronicle,
  saveBrowserChronicle,
  summarizeBrowserChronicle,
  type BrowserChronicleArchive,
  type BrowserChronicleSummary,
} from "../extension/chronicle-store.js";
import type { CouncilEvent, CouncilReport } from "../core/types.js";

export const CONSULTATION_HISTORY_LIMIT = 24;

export type ConsultationArchive = BrowserChronicleArchive;
export type ConsultationHistorySummary = BrowserChronicleSummary;

export interface ConsultationHistoryStore {
  save(report: CouncilReport, events: readonly CouncilEvent[]): Promise<ConsultationArchive>;
  list(limit?: number): Promise<ConsultationHistorySummary[]>;
  load(sessionId: string): Promise<ConsultationArchive | null>;
  remove(sessionId: string): Promise<void>;
  clear(): Promise<void>;
}

export function createConsultationArchive(
  report: CouncilReport,
  events: readonly CouncilEvent[],
): ConsultationArchive {
  return createBrowserChronicleArchive(report, events);
}

export function summarizeConsultationArchive(
  archive: ConsultationArchive,
): ConsultationHistorySummary {
  return summarizeBrowserChronicle(archive);
}

export function consultationArchiveChangedMindCount(
  archive: ConsultationArchive,
): number {
  return archive.events.filter((event) => event.kind === "revision").length;
}

export function createConsultationHistoryStore(): ConsultationHistoryStore {
  return {
    async save(report, events) {
      const archive = createConsultationArchive(report, events);
      await saveBrowserChronicle(archive);
      await pruneConsultationHistory(CONSULTATION_HISTORY_LIMIT);
      return archive;
    },
    list(limit = 12) {
      return listBrowserChronicle(Math.max(1, Math.min(CONSULTATION_HISTORY_LIMIT, limit)));
    },
    load(sessionId) {
      return loadBrowserChronicle(sessionId);
    },
    remove(sessionId) {
      return deleteBrowserChronicle(sessionId);
    },
    clear() {
      return clearBrowserChronicle();
    },
  };
}

export async function pruneConsultationHistory(
  keep = CONSULTATION_HISTORY_LIMIT,
): Promise<number> {
  const safeKeep = Math.max(1, Math.min(50, Math.floor(keep)));
  const summaries = await listBrowserChronicle(50);
  const overflow = summaries.slice(safeKeep);
  for (const summary of overflow) {
    await deleteBrowserChronicle(summary.sessionId);
  }
  return overflow.length;
}
