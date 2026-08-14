import type { CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import type { EvidenceVerificationSnapshot } from "../src/evidence/evidence-ledger.js";
import { deriveEvidenceGapRadar } from "../src/evidence/gap-radar.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "gpt", name: "ChatGPT", provider: "openai" },
  { id: "claude", name: "Claude", provider: "anthropic" },
  { id: "gemini", name: "Gemini", provider: "google" },
];

const base = { sessionId: "gap-test", createdAt: "2026-08-14T00:00:00.000Z" };
const events: CouncilEvent[] = [
  { ...base, id: "arg-1", round: 1, actorId: "claude", kind: "argument", stance: "Web + Extension", content: "Maintain two product cores.", confidence: 0.7 },
  { ...base, id: "challenge-1", round: 2, actorId: "gpt", kind: "challenge", targetEventId: "arg-1", content: "What evidence supports maintaining two cores?" },
  { ...base, id: "evidence-1", round: 2, actorId: "gemini", kind: "evidence", targetEventId: "arg-1", claim: "Optional host permissions can be requested at runtime.", content: "Chrome documents runtime optional permissions.", source: "https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions/", sourceDate: "2026-07-14", confidence: 0.85 },
  { ...base, id: "challenge-2", round: 3, actorId: "gpt", kind: "challenge", targetEventId: "evidence-1", content: "That supports the permission mechanism, not adoption." },
  { ...base, id: "revision-1", round: 3, actorId: "claude", kind: "revision", previousEventId: "arg-1", stance: "Browser Extension", content: "I revise the implementation sequence.", confidence: 0.82, causedBy: ["evidence-1"] },
  { ...base, id: "evidence-2", round: 2, actorId: "gpt", kind: "evidence", claim: "A private benchmark supports the claim.", content: "No public source supplied.", confidence: 0.4 },
  { ...base, id: "arg-2", round: 1, actorId: "gpt", kind: "argument", stance: "Extension", content: "This claim mentions https://example.com in prose but has no explicit evidence event.", confidence: 0.6 },
  { ...base, id: "challenge-3", round: 2, actorId: "claude", kind: "challenge", targetEventId: "arg-2", content: "The prose URL is not structured evidence." },
];

const verifications: Record<string, EvidenceVerificationSnapshot> = {
  "evidence-1": {
    state: "reachable",
    observedAt: "2026-08-14T00:05:00.000Z",
    requestedUrl: "https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions/",
    finalUrl: "https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions/",
    statusCode: 200,
    contentType: "text/html",
    pageDate: "2026-07-14",
  },
};

const radar = deriveEvidenceGapRadar(participants, events, verifications);
const kinds = radar.items.map((item) => item.kind);

assert(kinds.includes("disputed_source"), "Explicit challenge to evidence should appear as disputed evidence.");
assert(kinds.includes("evidence_changed_view"), "Explicit causedBy provenance should appear as evidence-driven revision.");
assert(kinds.includes("evidence_without_source"), "Evidence without safe source should remain visible as a gap.");
assert(kinds.includes("source_date_missing"), "Undated evidence should remain visible as a gap.");
assert(kinds.includes("challenged_without_evidence"), "A challenged event with no explicit evidence target should remain unsupported.");
assert(!kinds.includes("source_not_observed"), "A cached machine observation should remove the source-not-observed gap for that evidence.");

const challengedArg2 = radar.items.find((item) => item.kind === "challenged_without_evidence" && item.targetEventId === "arg-2");
assert(challengedArg2, "A URL mentioned in prose must not be inferred as structured evidence.");
assert(challengedArg2.provenanceEventIds.includes("challenge-3"), "Gap must remain traceable to the explicit challenge event.");

const influential = radar.items.find((item) => item.kind === "evidence_changed_view");
assert(influential?.provenanceEventIds.includes("revision-1"), "Influence must point to the explicit revision event.");
assert(radar.counts.attention >= 2, "Radar should distinguish attention items from open/resolved items.");
assert(radar.counts.resolved === 1, "Only the explicit evidence-driven revision is a resolved positive signal here.");

console.log("✓ ChatChat Evidence Gap Radar provenance tests passed");
