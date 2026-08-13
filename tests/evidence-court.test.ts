import type { CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import {
  buildEvidenceCourtLedger,
  safeEvidenceSource,
  summarizeEvidenceCourt,
} from "../src/evidence/ledger.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "gpt", name: "ChatGPT", provider: "openai-chatgpt" },
  { id: "qwen", name: "Qwen", provider: "alibaba-qwen" },
  { id: "gemini", name: "Gemini", provider: "google-gemini" },
];

const events: CouncilEvent[] = [
  {
    id: "claim-supported",
    sessionId: "evidence-1",
    round: 1,
    actorId: "gpt",
    kind: "argument",
    stance: "A",
    content: "Framework A usually uses less memory in this workload.",
    confidence: 0.7,
    createdAt: "2026-08-13T01:00:00.000Z",
  },
  {
    id: "claim-unsupported",
    sessionId: "evidence-1",
    round: 1,
    actorId: "qwen",
    kind: "argument",
    stance: "B",
    content: "Framework B has a larger hiring market.",
    confidence: 0.65,
    createdAt: "2026-08-13T01:00:01.000Z",
  },
  {
    id: "challenge-market",
    sessionId: "evidence-1",
    round: 2,
    actorId: "gemini",
    kind: "challenge",
    targetEventId: "claim-unsupported",
    content: "Please provide current market evidence rather than intuition.",
    createdAt: "2026-08-13T01:00:02.000Z",
  },
  {
    id: "evidence-memory",
    sessionId: "evidence-1",
    round: 2,
    actorId: "qwen",
    kind: "evidence",
    targetEventId: "claim-supported",
    claim: "A benchmark measured lower baseline memory for A in the tested configuration.",
    content: "The report compares idle/runtime memory under a stated test setup.",
    source: "https://bench.example.org/reports/memory-2026",
    sourceDate: "2026-07-01",
    confidence: 0.82,
    createdAt: "2026-08-13T01:00:03.000Z",
  },
  {
    id: "evidence-undated",
    sessionId: "evidence-1",
    round: 2,
    actorId: "gemini",
    kind: "evidence",
    targetEventId: "claim-supported",
    claim: "A second source reports a similar direction.",
    content: "The source has no date metadata in the Council event.",
    source: "https://docs.example.com/runtime-footprint",
    confidence: 0.62,
    createdAt: "2026-08-13T01:00:04.000Z",
  },
  {
    id: "revision-gpt",
    sessionId: "evidence-1",
    round: 2,
    actorId: "gpt",
    kind: "revision",
    previousEventId: "claim-supported",
    stance: "Depends",
    content: "I narrow the claim because the evidence only covers a specific workload.",
    confidence: 0.8,
    causedBy: ["evidence-memory", "challenge-market"],
    createdAt: "2026-08-13T01:00:05.000Z",
  },
  {
    id: "support-evidence",
    sessionId: "evidence-1",
    round: 2,
    actorId: "gemini",
    kind: "support",
    targetEventId: "evidence-memory",
    content: "This source is relevant to the memory subclaim.",
    createdAt: "2026-08-13T01:00:06.000Z",
  },
  {
    id: "broken-evidence",
    sessionId: "evidence-1",
    round: 2,
    actorId: "qwen",
    kind: "evidence",
    targetEventId: "missing-claim-id",
    claim: "This intentionally references a missing event.",
    content: "Broken link test.",
    source: "javascript:alert(1)",
    confidence: 0.5,
    createdAt: "2026-08-13T01:00:07.000Z",
  },
];

const ledger = buildEvidenceCourtLedger(participants, events);
const summary = summarizeEvidenceCourt(ledger);

const supported = ledger.claims.find((claim) => claim.eventId === "claim-supported");
assert(supported, "The first-round argument should become a claim ledger node.");
assert(supported.evidenceEventIds.length === 2, "Two explicitly targeted evidence events should attach to the claim.");
assert(supported.statuses.includes("sourced"), "A claim with an openable sourced evidence event should be SOURCED.");
assert(supported.statuses.includes("source-date-missing"), "An attached sourced item without sourceDate should remain visibly incomplete.");
assert(!supported.statuses.includes("unsupported"), "Explicit attached evidence removes only the UNSUPPORTED completeness label.");

const unsupported = ledger.claims.find((claim) => claim.eventId === "claim-unsupported");
assert(unsupported, "The second first-round argument should become a claim ledger node.");
assert(unsupported.statuses.includes("unsupported"), "UNSUPPORTED means no explicit evidence event is attached; it does not mean false.");
assert(unsupported.statuses.includes("challenged"), "An explicit challenge target should mark the claim CHALLENGED.");

const evidenceClaim = ledger.claims.find((claim) => claim.eventId === "evidence-memory");
assert(evidenceClaim?.statuses.includes("sourced"), "An Evidence event should surface its own safe source metadata.");
assert(evidenceClaim?.statuses.includes("changed-a-mind"), "Evidence explicitly named in revision.causedBy should surface downstream influence.");
assert(evidenceClaim?.statuses.includes("supported"), "Support targeting an Evidence event should remain traceable.");

const memoryEvidence = ledger.evidence.find((item) => item.eventId === "evidence-memory");
assert(memoryEvidence?.source?.openable, "HTTP(S) source should be openable.");
assert(memoryEvidence?.source?.host === "bench.example.org", "Evidence Court should expose public source host without fetching it.");
assert(memoryEvidence?.changedMindActorIds.includes("gpt"), "Revision provenance should identify the actor changed by this evidence.");

const malicious = ledger.evidence.find((item) => item.eventId === "broken-evidence");
assert(malicious?.source?.openable === false, "javascript: model-provided source must never be openable.");
assert(malicious?.source?.href === null, "Unsafe source should not produce a click target.");
assert(
  ledger.unresolvedReferences.some(
    (item) => item.eventId === "broken-evidence" && item.referencedEventId === "missing-claim-id",
  ),
  "A genuinely missing target event id must remain unresolved rather than being invented.",
);
assert(
  !ledger.unresolvedReferences.some(
    (item) => item.eventId === "revision-gpt" && item.referencedEventId === "challenge-market",
  ),
  "A valid revision cause that is a non-claim event must not be mislabeled as a broken reference.",
);

assert(summary.claimCount === 5, "Arguments and evidence events form the v1 claim-ledger node set.");
assert(summary.evidenceCount === 3, "All explicit evidence events should be counted.");
assert(summary.sourcedEvidenceCount === 2, "Only safe http/https evidence sources count as sourced/openable.");
assert(summary.unsupportedClaimCount >= 1, "The ledger should retain unsupported completeness gaps.");
assert(summary.challengedClaimCount === 1, "Only explicitly challenged claim nodes count as challenged.");
assert(summary.changedMindEvidenceCount === 1, "Only evidence with explicit revision/concede provenance counts as changed-mind evidence.");
assert(summary.unresolvedReferenceCount === 1, "Only the intentionally missing target should remain unresolved.");

for (const [raw, openable] of [
  ["https://example.com/report", true],
  ["http://example.com/report", true],
  ["javascript:alert(1)", false],
  ["file:///etc/passwd", false],
  ["data:text/html,hello", false],
  ["not a url", false],
] as const) {
  assert(safeEvidenceSource(raw).openable === openable, `Unexpected source safety result for ${raw}`);
}

console.log("✓ ChatChat Evidence Court ledger tests passed");
