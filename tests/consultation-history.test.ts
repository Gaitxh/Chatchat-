import { createConsultationArchive, summarizeConsultationArchive } from "../src/history/consultation-history.js";
import type { CouncilEvent, CouncilReport } from "../src/core/types.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const report: CouncilReport = {
  sessionId: "session-history",
  question: "Should ChatChat use a full-room UI?",
  consensusStance: "Full Room",
  consensusRatio: 2 / 3,
  confidence: 0.84,
  rounds: 3,
  positions: [],
  disagreements: [{ participant: { id: "c", name: "C", provider: "c" }, stance: "Side Panel", content: "Keep it compact.", confidence: 0.7, caveats: [] }],
  eventCount: 4,
};

const events: CouncilEvent[] = [
  { id: "e1", sessionId: report.sessionId, round: 1, actorId: "a", kind: "argument", stance: "Full Room", content: "More space.", confidence: 0.8, createdAt: "2026-08-14T00:00:00.000Z" },
  { id: "e2", sessionId: report.sessionId, round: 2, actorId: "b", kind: "evidence", claim: "More room improves visualization", content: "Source supplied", source: "https://example.com", confidence: 0.7, createdAt: "2026-08-14T00:00:01.000Z" },
  { id: "e3", sessionId: report.sessionId, round: 2, actorId: "c", kind: "revision", previousEventId: "e1", stance: "Full Room", content: "I revise.", confidence: 0.75, causedBy: ["e2"], createdAt: "2026-08-14T00:00:02.000Z" },
  { id: "e4", sessionId: report.sessionId, round: 3, actorId: "a", kind: "final_position", stance: "Full Room", content: "Final.", confidence: 0.9, createdAt: "2026-08-14T00:00:03.000Z" },
];

const archive = createConsultationArchive(report, events);
const summary = summarizeConsultationArchive(archive);

assert(archive.sessionId === report.sessionId, "archive keeps the session id");
assert(archive.events.length === 4, "archive keeps the full event stream");
assert(summary.eventCount === 4, "summary counts events");
assert(summary.revisionCount === 1, "summary counts revisions");
assert(summary.evidenceCount === 1, "summary counts evidence");
assert(summary.minoritySurvives === true, "summary preserves minority visibility");
assert(summary.consensusStance === "Full Room", "summary keeps the consensus label");
assert(!("events" in summary), "history list summaries must not duplicate full event bodies");
assert(!("report" in summary), "history list summaries must not duplicate the full report");

console.log("✓ ChatChat Consultation History summary tests passed");
