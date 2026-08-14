import type {
  CouncilEvent,
  CouncilParticipant,
  CouncilParticipantTurnUpdate,
  CouncilPhaseUpdate,
} from "../src/core/types.js";
import { buildPeerExchangeModel } from "../src/theater/peer-exchange.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "gpt", name: "ChatGPT", provider: "openai" },
  { id: "claude", name: "Claude", provider: "anthropic" },
  { id: "gemini", name: "Gemini", provider: "google" },
];

const baseEvents: CouncilEvent[] = [
  {
    id: "gpt-r1", sessionId: "peer-exchange", round: 1, actorId: "gpt", kind: "argument",
    stance: "web-first", content: "Use a web-first room.", confidence: .8, createdAt: "2026-08-14T00:00:01Z",
  },
  {
    id: "claude-question", sessionId: "peer-exchange", round: 2, actorId: "claude", kind: "question",
    targetActorId: "gpt", content: "How should login recovery work?", createdAt: "2026-08-14T00:00:02Z",
  },
  {
    id: "gemini-challenge", sessionId: "peer-exchange", round: 2, actorId: "gemini", kind: "challenge",
    targetEventId: "gpt-r1", content: "What if the bridge is unavailable?", createdAt: "2026-08-14T00:00:03Z",
  },
  {
    id: "claude-evidence", sessionId: "peer-exchange", round: 2, actorId: "claude", kind: "evidence",
    targetEventId: "gpt-r1", claim: "A browser boundary affects the fallback.",
    content: "Public platform documentation describes the limitation.", source: "https://example.com/platform",
    confidence: .82, createdAt: "2026-08-14T00:00:04Z",
  },
];

const round2: CouncilPhaseUpdate = { phase: "debate", round: 2 };
const queued = buildPeerExchangeModel(participants, baseEvents, {}, round2);
assert(queued.items.length === 3, "Direct question, targeted challenge and targeted evidence should each become a peer response obligation.");
assert(queued.items.every((item) => item.targetActorId === "gpt"), "All three explicit targets should resolve to ChatGPT.");
assert(queued.items.every((item) => item.state === "queued"), "Same-round targets cannot answer a newly published parallel event until a later public round.");
assert(queued.pendingCount === 3, "Queued direct events should remain visibly pending.");

const workingActivities: Record<string, CouncilParticipantTurnUpdate> = {
  gpt: {
    phase: "debate", round: 3, participant: participants[0]!, state: "working",
    researchLane: "primary_sources",
  },
};
const responding = buildPeerExchangeModel(participants, baseEvents, workingActivities, { phase: "debate", round: 3 });
assert(responding.respondingCount === 3, "When the addressed AI begins the next debate turn, all unresolved direct events to it should show responding.");
assert(responding.items.every((item) => item.state === "responding"), "Response status must come from the explicit participant lifecycle, not a timer.");

const failedActivities: Record<string, CouncilParticipantTurnUpdate> = {
  gpt: { phase: "debate", round: 3, participant: participants[0]!, state: "failed" },
};
const failed = buildPeerExchangeModel(participants, baseEvents, failedActivities, { phase: "debate", round: 3 });
assert(failed.items.every((item) => item.state === "turn_failed"), "A failed target turn must stay visibly unresolved instead of being silently marked answered.");

const answerEvents: CouncilEvent[] = [
  ...baseEvents,
  {
    id: "gpt-answer", sessionId: "peer-exchange", round: 3, actorId: "gpt", kind: "argument",
    stance: "web-first", content: "Login recovery should resume automatically after readiness.", confidence: .86,
    replyToEventId: "claude-question", createdAt: "2026-08-14T00:00:05Z",
  },
  {
    id: "gpt-defense", sessionId: "peer-exchange", round: 3, actorId: "gpt", kind: "defense",
    targetEventId: "gemini-challenge", content: "The fallback keeps the bridge invisible while preserving recovery.", createdAt: "2026-08-14T00:00:06Z",
  },
  {
    id: "gpt-revision", sessionId: "peer-exchange", round: 3, actorId: "gpt", kind: "revision",
    previousEventId: "gpt-r1", stance: "web-first-with-fallback", content: "The evidence adds a required fallback.", confidence: .88,
    causedBy: ["claude-evidence"], createdAt: "2026-08-14T00:00:07Z",
  },
];
const answered = buildPeerExchangeModel(participants, answerEvents, {}, { phase: "debate", round: 3 });
assert(answered.answeredCount === 3, "replyTo, defense target and revision.causedBy should each close their exact response obligation.");
assert(answered.pendingCount === 0, "Explicit responses should remove those obligations from pending status.");
assert(answered.items.every((item) => item.responseEventId), "Every answered card must preserve the exact structured response event id.");
assert(answered.items.find((item) => item.requestEventId === "claude-question")?.responseEventId === "gpt-answer", "Direct question must resolve through exact replyToEventId provenance.");
assert(answered.items.find((item) => item.requestEventId === "gemini-challenge")?.responseKind === "defense", "A structured defense should resolve the challenged event's response obligation.");
assert(answered.items.find((item) => item.requestEventId === "claude-evidence")?.responseKind === "revision", "A causedBy revision should prove that targeted evidence received a consequential response.");

const proseOnly: CouncilEvent[] = [
  ...baseEvents,
  {
    id: "fake-answer", sessionId: "peer-exchange", round: 3, actorId: "gpt", kind: "argument",
    stance: "web-first", content: "Claude, to answer your question, recovery is automatic.", confidence: .8,
    createdAt: "2026-08-14T00:00:08Z",
  },
];
const proseModel = buildPeerExchangeModel(participants, proseOnly, {}, { phase: "debate", round: 3 });
assert(proseModel.answeredCount === 0, "Reply-like prose without structured provenance must not satisfy any peer response obligation.");
assert(proseModel.pendingCount === 3, "All direct requests must remain pending when the apparent answer is only prose.");

const wrongActor: CouncilEvent[] = [
  ...baseEvents,
  {
    id: "gemini-answer", sessionId: "peer-exchange", round: 3, actorId: "gemini", kind: "argument",
    stance: "web-first", content: "I can answer Claude instead.", confidence: .7,
    replyToEventId: "claude-question", createdAt: "2026-08-14T00:00:09Z",
  },
];
const wrongActorModel = buildPeerExchangeModel(participants, wrongActor, {}, { phase: "debate", round: 3 });
assert(wrongActorModel.items.find((item) => item.requestEventId === "claude-question")?.state === "queued", "A third party replying must not discharge an obligation addressed to another AI.");

const closed = buildPeerExchangeModel(participants, baseEvents, {}, { phase: "final", round: 3 });
assert(closed.unresolvedCount === 3, "If the meeting closes without an explicit response, unresolved direct requests must remain visible as unresolved.");
assert(closed.items.every((item) => item.state === "unresolved"), "Final phase must never silently convert unanswered requests into success.");

console.log("✓ ChatChat live peer exchange queue tests passed");
console.log("✓ Direct requests move queued → responding → answered only through explicit lifecycle and event provenance");
console.log("✓ Prose, third-party replies and meeting close cannot fake a completed response");
