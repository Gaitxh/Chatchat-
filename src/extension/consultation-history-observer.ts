import type { CouncilEvent, CouncilReport } from "../core/types.js";
import {
  EVIDENCE_VERIFICATIONS_STORAGE_KEY,
  type EvidenceVerificationSnapshot,
} from "../evidence/evidence-ledger.js";
import { ConsultationHistoryStore, createConsultationArchive } from "../history/consultation-history.js";
import { EvidenceHistoryStore } from "../history/evidence-history.js";
import { announceConsultationHistoryUpdated } from "./history-wire.js";

declare const chrome: any;

const COMPLETE_EVENT = "chatchat:consultation-complete";
const MARKER = "__chatchatConsultationHistoryObserverV1";
const historyStore = new ConsultationHistoryStore();
const evidenceHistory = new EvidenceHistoryStore();

interface CompletionDetail {
  report: CouncilReport;
  events: CouncilEvent[];
}

type MarkedWindow = Window & { [MARKER]?: true };

install();

function install(): void {
  const marked = window as MarkedWindow;
  if (marked[MARKER]) return;
  marked[MARKER] = true;

  window.addEventListener(COMPLETE_EVENT, (event: Event) => {
    const detail = (event as CustomEvent<CompletionDetail>).detail;
    if (!detail?.report || !Array.isArray(detail.events)) return;
    void saveCompleted(detail.report, detail.events);
  });
}

async function saveCompleted(report: CouncilReport, events: readonly CouncilEvent[]): Promise<void> {
  try {
    const archiveSave = historyStore.save(createConsultationArchive(report, events));
    const evidenceSave = currentEvidenceSnapshot(events)
      .then((evidenceSnapshot) => evidenceHistory.save(report.sessionId, evidenceSnapshot));
    await Promise.all([archiveSave, evidenceSave]);
    announceConsultationHistoryUpdated(report.sessionId);
  } catch (caught) {
    // History is a local durability feature. A persistence failure must never
    // turn a completed consultation into a failed consultation.
    console.warn("ChatChat could not persist the completed consultation locally.", caught);
  }
}

async function currentEvidenceSnapshot(
  events: readonly CouncilEvent[],
): Promise<Record<string, EvidenceVerificationSnapshot>> {
  if (typeof chrome === "undefined" || !chrome.storage) return {};
  const storeArea = chrome.storage.session ?? chrome.storage.local;
  const stored = await storeArea.get(EVIDENCE_VERIFICATIONS_STORAGE_KEY);
  const all = normalizeVerifications(stored[EVIDENCE_VERIFICATIONS_STORAGE_KEY]);
  const eventIds = new Set(events.filter((event) => event.kind === "evidence").map((event) => event.id));
  return Object.fromEntries(Object.entries(all).filter(([eventId]) => eventIds.has(eventId)));
}

function normalizeVerifications(value: unknown): Record<string, EvidenceVerificationSnapshot> {
  return value && typeof value === "object"
    ? value as Record<string, EvidenceVerificationSnapshot>
    : {};
}
