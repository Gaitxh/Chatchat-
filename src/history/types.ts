import type { CouncilEvent, CouncilReport } from "../core/types.js";

export type HistoryBackend = "sqlite" | "browser";

export interface CouncilHistorySummary {
  sessionId: string;
  question: string;
  createdAt: string;
  consensusStance: string | null;
  consensusRatio: number;
  confidence: number;
  rounds: number;
  eventCount: number;
}

export interface ArchivedCouncil extends CouncilHistorySummary {
  report: CouncilReport;
  events: CouncilEvent[];
}

export interface CouncilHistoryStore {
  readonly backend: HistoryBackend;
  save(archive: ArchivedCouncil): Promise<void>;
  list(limit?: number): Promise<CouncilHistorySummary[]>;
  load(sessionId: string): Promise<ArchivedCouncil | null>;
}

export function createArchive(
  report: CouncilReport,
  events: readonly CouncilEvent[],
): ArchivedCouncil {
  return {
    sessionId: report.sessionId,
    question: report.question,
    createdAt: events.at(-1)?.createdAt ?? new Date().toISOString(),
    consensusStance: report.consensusStance,
    consensusRatio: report.consensusRatio,
    confidence: report.confidence,
    rounds: report.rounds,
    eventCount: report.eventCount,
    report,
    events: [...events],
  };
}

export function summarizeArchive(
  archive: ArchivedCouncil,
): CouncilHistorySummary {
  const {
    report: _report,
    events: _events,
    ...summary
  } = archive;
  return summary;
}
