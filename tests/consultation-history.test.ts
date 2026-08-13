import assert from "node:assert/strict";
import { createConsultationArchive, summarizeConsultationArchive } from "../src/history/consultation-history.js";
import type { CouncilEvent, CouncilReport } from "../src/core/types.js";

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

assert.equal(archive.sessionId, report.sessionId);
assert.equal(archive.events.length, 4);
assert.equal(summary.eventCount, 4);
assert.equal(summary.revisionCount, 1);
assert.equal(summary.evidenceCount, 1);
assert.equal(summary.minoritySurvives, true);
assert.equal(summary.consensusStance, "Full Room");
assert.equal("events" in summary, false, "history list summaries must not duplicate full event bodies");
assert.equal("report" in summary, false, "history list summaries must not duplicate the full report");

console.log("✓ ChatChat Consultation History summary tests passed");
