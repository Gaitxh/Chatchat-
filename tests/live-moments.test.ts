import type {
  CouncilEvent,
  CouncilParticipant,
} from "../src/core/types.js";
import { deriveLiveRoomDynamics } from "../src/theater/live-moments.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "gpt", name: "ChatGPT", provider: "openai" },
  { id: "claude", name: "Claude", provider: "anthropic" },
  { id: "gemini", name: "Gemini", provider: "google" },
];

const events: CouncilEvent[] = [
  {
    id: "gpt-1", sessionId: "s", round: 1, actorId: "gpt", kind: "argument",
    stance: "Extension", content: "Extension first.", confidence: 0.7, createdAt: "2026-08-13T00:00:01Z",
  },
  {
    id: "claude-1", sessionId: "s", round: 1, actorId: "claude", kind: "argument",
    stance: "Web + Extension", content: "Build both.", confidence: 0.7, createdAt: "2026-08-13T00:00:02Z",
  },
  {
    id: "gemini-1", sessionId: "s", round: 1, actorId: "gemini", kind: "argument",
    stance: "Extension", content: "Extension first.", confidence: 0.8, createdAt: "2026-08-13T00:00:03Z",
  },
  {
    id: "gpt-challenge", sessionId: "s", round: 2, actorId: "gpt", kind: "challenge",
    targetEventId: "claude-1", content: "Show evidence that a second product is worth the cost.", createdAt: "2026-08-13T00:00:04Z",
  },
  {
    id: "gemini-evidence", sessionId: "s", round: 2, actorId: "gemini", kind: "evidence",
    targetEventId: "claude-1", claim: "Extension reaches existing signed-in tabs.",
    content: "Browser data supports the workflow claim.", source: "https://example.com/report",
    sourceDate: "2026-08-01", confidence: 0.8, createdAt: "2026-08-13T00:00:05Z",
  },
  {
    id: "claude-revise", sessionId: "s", round: 2, actorId: "claude", kind: "revision",
    previousEventId: "claude-1", stance: "Extension",
    content: "The evidence changes my sequencing recommendation.", confidence: 0.84,
    causedBy: ["gemini-evidence"], createdAt: "2026-08-13T00:00:06Z",
  },
];

const model = deriveLiveRoomDynamics(participants, events);
const kinds = model.moments.map((moment) => moment.kind);

assert(kinds.includes("lone_dissenter"), "A 2-vs-1 explicit stance pattern should create a lone-dissenter moment.");
assert(kinds.includes("clash"), "A challenge targeting a peer event should create a clash moment.");
assert(kinds.includes("evidence_drop"), "An explicit evidence event should create an evidence-drop moment.");
assert(kinds.includes("evidence_turn"), "A revision caused by evidence should create an evidence-turn moment.");
assert(kinds.includes("alignment_surge"), "A large event-backed alignment increase should create an alignment-surge moment.");
assert(kinds.includes("full_alignment"), "All known positions explicitly matching should create a full-alignment moment.");
assert(model.alignment === 100, "Final explicit stance alignment should be 100%.");
assert(model.heat > 0 && model.heat <= 100, "Interaction heat must stay within 1-100 for an active room.");

const evidenceMoment = model.moments.find((moment) => moment.kind === "evidence_drop");
assert(evidenceMoment?.sourceHost === "example.com", "Evidence moment may expose only a safe public source host.");

const empty = deriveLiveRoomDynamics(participants, []);
assert(empty.moments.length === 0, "No structured events means no invented Live Moments.");
assert(empty.heat === 0, "An empty meeting should have zero interaction heat.");
assert(empty.alignment === 0, "An empty meeting should not pretend to have alignment.");

console.log("✓ ChatChat event-derived Live Moments tests passed");
