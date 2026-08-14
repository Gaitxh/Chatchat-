import type {
  CouncilEvent,
  CouncilParticipant,
  CouncilReport,
} from "../src/core/types.js";
import type { EvidenceVerificationSnapshot } from "../src/evidence/evidence-ledger.js";
import { deriveConsultationNextMoves } from "../src/consultation/next-moves.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "gpt", name: "ChatGPT", provider: "openai" },
  { id: "claude", name: "Claude", provider: "anthropic" },
  { id: "gemini", name: "Gemini", provider: "google" },
];

const base = { sessionId: "next-test", createdAt: "2026-08-14T00:00:00.000Z" };
const events: CouncilEvent[] = [
  { ...base, id: "arg-1", round: 1, actorId: "claude", kind: "argument", stance: "Web + Extension", content: "Maintain two full product cores.", confidence: 0.7 },
  { ...base, id: "challenge-1", round: 2, actorId: "gpt", kind: "challenge", targetEventId: "arg-1", content: "What evidence supports two cores?" },
  { ...base, id: "evidence-1", round: 2, actorId: "gemini", kind: "evidence", targetEventId: "arg-1", claim: "Optional site access can be requested at runtime.", content: "Chrome documents optional permissions.", source: "https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions/", sourceDate: "2026-07-14", confidence: 0.85 },
  { ...base, id: "challenge-2", round: 3, actorId: "gpt", kind: "challenge", targetEventId: "evidence-1", content: "That supports permissions, not product adoption." },
  { ...base, id: "revision-1", round: 3, actorId: "claude", kind: "revision", previousEventId: "arg-1", stance: "Browser Extension", content: "I revise the implementation sequence.", confidence: 0.82, causedBy: ["evidence-1"] },
  { ...base, id: "arg-2", round: 1, actorId: "gpt", kind: "argument", stance: "Browser Extension", content: "A second claim has no structured evidence yet.", confidence: 0.7 },
  { ...base, id: "challenge-3", round: 2, actorId: "claude", kind: "challenge", targetEventId: "arg-2", content: "Show evidence for that second claim." },
  { ...base, id: "final-gpt", round: 4, actorId: "gpt", kind: "final_position", stance: "Browser Extension", content: "Extension first.", confidence: 0.86 },
  { ...base, id: "final-claude", round: 4, actorId: "claude", kind: "final_position", stance: "Browser Extension", content: "Extension first.", confidence: 0.84 },
  { ...base, id: "final-gemini", round: 4, actorId: "gemini", kind: "final_position", stance: "Web + Extension", content: "Keep a stronger web path.", confidence: 0.72 },
];

const report: CouncilReport = {
  sessionId: "next-test",
  question: "What should we build first?",
  mode: "balanced",
  consensusStance: "Browser Extension",
  consensusRatio: 2 / 3,
  confidence: 0.85,
  rounds: 4,
  positions: [
    { participant: participants[0]!, stance: "Browser Extension", content: "Extension first.", confidence: 0.86, caveats: [] },
    { participant: participants[1]!, stance: "Browser Extension", content: "Extension first.", confidence: 0.84, caveats: [] },
    { participant: participants[2]!, stance: "Web + Extension", content: "Keep a stronger web path.", confidence: 0.72, caveats: [] },
  ],
  disagreements: [
    { participant: participants[2]!, stance: "Web + Extension", content: "Keep a stronger web path.", confidence: 0.72, caveats: [] },
  ],
  eventCount: events.length,
};

const verifications: Record<string, EvidenceVerificationSnapshot> = {
  "evidence-1": {
    state: "reachable",
    observedAt: "2026-08-14T00:10:00.000Z",
    requestedUrl: "https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions/",
    statusCode: 200,
    pageDate: "2026-07-14",
  },
};

const moves = deriveConsultationNextMoves(report, participants, events, verifications, 6);
const kinds = moves.map((move) => move.kind);

assert(kinds.includes("request_evidence"), "A challenged event with no evidence should become an evidence-filling next move.");
assert(kinds.includes("retest_revision"), "Disputed evidence that caused a revision should become a focused re-test move.");
assert(kinds.includes("hear_minority"), "A surviving final disagreement should become a minority follow-up move.");
assert(!kinds.includes("inspect_source"), "A source with an existing observation should not generate a source-not-observed move.");

const evidenceMove = moves.find((move) => move.kind === "request_evidence")!;
assert(evidenceMove.modeHint === "verify", "Unsupported challenged claims should suggest verification, not a debate-for-drama mode.");
assert(evidenceMove.en.proposal.includes("challenged claim"), "Move should produce a human-readable proposal rather than an opaque event-only command.");
assert(evidenceMove.relatedEventIds.includes("challenge-3"), "Next move should retain provenance back to the explicit challenge.");

const retest = moves.find((move) => move.kind === "retest_revision")!;
assert(retest.modeHint === "stress_test", "A disputed evidence-driven revision should suggest stress testing.");
assert(/reachab/i.test(retest.en.proposal), "Re-test proposal must preserve the source-reachability versus claim-support distinction.");

const minority = moves.find((move) => move.kind === "hear_minority")!;
assert(minority.en.proposal.includes("majority support"), "Minority follow-up must explicitly avoid treating majority as authority.");
assert(minority.zhCN.proposal.includes("多数支持"), "Chinese minority follow-up should preserve the same epistemic boundary.");

const noGapsReport: CouncilReport = {
  ...report,
  disagreements: [],
  positions: report.positions.slice(0, 2),
  consensusRatio: 1,
};
const cleanEvents = events.filter((event) => !["arg-2", "challenge-3", "final-gemini"].includes(event.id));
const cleaner = deriveConsultationNextMoves(noGapsReport, participants.slice(0, 2), cleanEvents, verifications, 6);
assert(!cleaner.some((move) => move.kind === "request_evidence"), "Next Move engine must not invent an unsupported gap when none exists.");

console.log("✓ ChatChat deterministic Next Move rules passed");
