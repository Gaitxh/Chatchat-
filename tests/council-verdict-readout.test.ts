import type { CouncilEvent, CouncilParticipant, CouncilReport } from "../src/core/types.js";
import { deriveCouncilVerdictReadout } from "../src/consultation/council-verdict-readout.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "alice", name: "Alice", provider: "test" },
  { id: "bob", name: "Bob", provider: "test" },
  { id: "carol", name: "Carol", provider: "test" },
];
const base = { sessionId: "verdict-readout", createdAt: "2026-08-22T00:00:00.000Z" };
const events: CouncilEvent[] = [
  { ...base, id: "a1", round: 1, actorId: "alice", kind: "argument", stance: "A", content: "A", confidence: .8 },
  { ...base, id: "b1", round: 1, actorId: "bob", kind: "argument", stance: "B", content: "B", confidence: .8 },
  { ...base, id: "c1", round: 1, actorId: "carol", kind: "argument", stance: "C", content: "C", confidence: .8 },
  { ...base, id: "sealed-question", round: 1, actorId: "alice", kind: "question", targetActorId: "bob", content: "Sealed question must not become public debt." },
  { ...base, id: "b-to-a", round: 2, actorId: "bob", kind: "challenge", targetEventId: "a1", content: "Why A?" },
  { ...base, id: "a-to-b", round: 2, actorId: "alice", kind: "challenge", targetEventId: "b1", content: "Why B?" },
  { ...base, id: "e1", round: 2, actorId: "alice", kind: "evidence", targetEventId: "c1", claim: "Evidence for change", content: "Evidence for change", source: "https://example.com/evidence", confidence: .7 },
  { ...base, id: "a-defense", round: 3, actorId: "alice", kind: "defense", targetEventId: "b-to-a", content: "A remains defensible." },
  { ...base, id: "c-revision", round: 3, actorId: "carol", kind: "revision", previousEventId: "c1", stance: "A", content: "I revise to A.", confidence: .86, causedBy: ["e1"] },
  { ...base, id: "fa", round: 4, actorId: "alice", kind: "final_position", stance: "A", content: "A", confidence: .9 },
  { ...base, id: "fb", round: 4, actorId: "bob", kind: "final_position", stance: "B", content: "B", confidence: .95 },
  { ...base, id: "fc", round: 4, actorId: "carol", kind: "final_position", stance: "A", content: "A", confidence: .88 },
];

const report: CouncilReport = {
  sessionId: base.sessionId,
  question: "Which stance should lead?",
  mode: "balanced",
  stopReason: "round_budget",
  consensusStance: "A",
  consensusRatio: 2 / 3,
  confidence: .91,
  rounds: 4,
  positions: [
    { participant: participants[0]!, stance: "A", content: "A", confidence: .9, caveats: [] },
    { participant: participants[1]!, stance: "B", content: "B", confidence: .95, caveats: [] },
    { participant: participants[2]!, stance: "A", content: "A", confidence: .88, caveats: [] },
  ],
  disagreements: [
    { participant: participants[1]!, stance: "B", content: "B", confidence: .95, caveats: [] },
  ],
  unansweredDirectRequestEventIds: ["a-to-b"],
  eventCount: events.length,
};

const readout = deriveCouncilVerdictReadout(report, events);
assert(readout.leadingStance === "A", "readout should reproduce the report's leading stance without inventing a new winner");
assert(Math.abs(readout.alignmentRatio - 2 / 3) < 1e-9, "alignment must be copied descriptively from the report");
assert(readout.minorityCount === 1 && readout.minorityStances[0] === "B", "surviving minority must remain first-layer data");
assert(readout.responseTotal === 3, "only R2+ named requests should create response obligations");
assert(readout.responseAnswered === 2 && readout.responsePending === 1, "canonical response receipts should distinguish answered and pending duties");
assert(readout.unansweredRequestEventIds.length === 1 && readout.unansweredRequestEventIds[0] === "a-to-b", "pending request id must remain exact");
assert(readout.responseReportMatchesCanonical === true, "final report pending ids must reconcile with the canonical ledger");
assert(readout.attentionState === "pending-response", "unanswered named requests should outrank apparent alignment in the first-layer attention state");
assert(readout.lastRevision?.revisionEventId === "c-revision", "latest explicit revision should be surfaced by exact id");
assert(readout.lastRevision?.actor === "Carol", "revision actor should use the report participant display name");
assert(readout.lastRevision?.previousStance === "C" && readout.lastRevision?.newStance === "A", "revision trajectory must stay structural");
assert(readout.lastRevision?.causeEventIds[0] === "e1" && readout.lastRevision?.causeKinds[0] === "evidence", "revision cause must stay event-anchored");
assert(!readout.unansweredRequestEventIds.includes("sealed-question"), "sealed round-one requests must never leak into public response debt");
assert(report.positions[1]!.confidence > report.positions[0]!.confidence, "fixture should prove confidence does not erase a minority position");

const stableReport: CouncilReport = {
  ...report,
  stopReason: "stable_alignment_no_new_signal",
  consensusRatio: 1,
  positions: report.positions.map((position) => ({ ...position, stance: "A" })),
  disagreements: [],
  unansweredDirectRequestEventIds: [],
};
const stableEvents = events.filter((event) => event.id !== "a-to-b");
const stable = deriveCouncilVerdictReadout(stableReport, stableEvents);
assert(stable.responsePending === 0, "stable fixture should have no pending named response debt");
assert(stable.attentionState === "stable-alignment", "stable alignment is only the fallback attention state after pending/minority/no-leading-state checks");

console.log("✓ ChatChat Council verdict readout keeps alignment descriptive, minorities visible, and unanswered named requests first-class");
