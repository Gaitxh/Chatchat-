import type { CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import {
  deriveEvidenceLedger,
  evidenceDisplayState,
  type EvidenceVerificationSnapshot,
} from "../src/evidence/evidence-ledger.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "gpt", name: "ChatGPT", provider: "openai" },
  { id: "claude", name: "Claude", provider: "anthropic" },
  { id: "gemini", name: "Gemini", provider: "google" },
];

const events: CouncilEvent[] = [
  { id:"c1",sessionId:"s",round:1,actorId:"claude",kind:"argument",stance:"A",content:"A claim.",confidence:.7,createdAt:"1" },
  { id:"e1",sessionId:"s",round:2,actorId:"gemini",kind:"evidence",targetEventId:"c1",claim:"The browser workflow exists.",content:"A public source discusses the browser behavior.",source:"https://www.example.com/report?x=1",sourceDate:"2026-08-01",confidence:.8,createdAt:"2" },
  { id:"ch1",sessionId:"s",round:2,actorId:"gpt",kind:"challenge",targetEventId:"e1",content:"Reachability does not prove the claim scope.",createdAt:"3" },
  { id:"r1",sessionId:"s",round:3,actorId:"claude",kind:"revision",previousEventId:"c1",stance:"B",content:"I revised after inspecting the evidence.",confidence:.82,causedBy:["e1"],createdAt:"4" },
  { id:"e2",sessionId:"s",round:3,actorId:"gpt",kind:"evidence",claim:"Unsafe scheme example",content:"Should not become an openable source.",source:"javascript:alert(1)",confidence:.2,createdAt:"5" },
];

const ledger = deriveEvidenceLedger(participants, events);
assert(ledger.length === 2, "Each explicit evidence event should become one ledger record.");
const first = ledger.find((record) => record.evidenceEventId === "e1")!;
assert(first.actorName === "Gemini", "Evidence provenance should preserve the submitting participant.");
assert(first.sourceHost === "example.com", "Safe public source host should be normalized for display.");
assert(first.sourceUrl?.startsWith("https://www.example.com/report"), "HTTP(S) source should remain inspectable.");
assert(first.targetActorId === "claude", "Target actor must come from explicit targetEventId provenance.");
assert(first.challengeEventIds.length === 1 && first.challengedByActorIds[0] === "gpt", "Challenges to an evidence event must be visible separately from source verification.");
assert(first.downstreamRevisionEventIds.length === 1 && first.downstreamReviserIds[0] === "claude", "Evidence influence requires revision.causedBy provenance.");

const unsafe = ledger.find((record) => record.evidenceEventId === "e2")!;
assert(!unsafe.sourceUrl && !unsafe.sourceHost, "Non-http(s) model-provided sources must never become openable links.");

const reachable: EvidenceVerificationSnapshot = {
  state: "reachable",
  observedAt: "2026-08-13T00:00:00Z",
  statusCode: 200,
};
const display = evidenceDisplayState(first, reachable);
assert(display.sourceState === "reachable", "A tool result may say the source was reachable.");
assert(display.disputed, "A reachable source may remain disputed by participants.");
assert(display.changedMind, "Evidence influence is a separate event-provenance fact.");

const unchecked = evidenceDisplayState(first);
assert(unchecked.sourceState === "not_checked", "A provided URL must not be described as checked before a tool result exists.");

console.log("✓ ChatChat evidence ledger provenance tests passed");
