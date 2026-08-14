import { explicitReplyEdges } from "../src/consultation/reply-provenance.js";
import type { CouncilContext, CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import {
  buildProviderConsultationPrompt,
  parseProviderConsultationTurn,
} from "../src/provider-sdk/consultation-agent.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertThrows(fn: () => unknown, includes: string, message: string) {
  try {
    fn();
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    assert(text.includes(includes), `${message}; received: ${text}`);
    return;
  }
  throw new Error(`Assertion failed: ${message}; expected an error.`);
}

const alice: CouncilParticipant = { id: "alice", name: "Alice AI", provider: "a" };
const bob: CouncilParticipant = { id: "bob", name: "Bob AI", provider: "b" };
const events: CouncilEvent[] = [
  {
    id: "alice-view", sessionId: "reply-test", round: 1, actorId: "alice", kind: "argument",
    stance: "web-first", content: "Use a web-first room.", confidence: .76, createdAt: "2026-08-14T00:00:01Z",
  },
  {
    id: "bob-question", sessionId: "reply-test", round: 2, actorId: "bob", kind: "question",
    targetActorId: "alice", content: "How does recovery work when the bridge is missing?", createdAt: "2026-08-14T00:00:02Z",
  },
  {
    id: "bob-challenge", sessionId: "reply-test", round: 2, actorId: "bob", kind: "challenge",
    targetEventId: "alice-view", content: "The fallback seems underspecified.", createdAt: "2026-08-14T00:00:03Z",
  },
];

const context: CouncilContext = {
  sessionId: "reply-test",
  question: "Should ChatChat be web-first?",
  mode: "balanced",
  phase: "debate",
  round: 3,
  participant: alice,
  publicEvents: events,
  ownEvents: [events[0]!],
};

const rawAnswer = `<CHATCHAT_COUNCIL_JSON>${JSON.stringify({ contributions: [{
  kind: "argument",
  stance: "web-first-with-recovery",
  content: "The bridge can recover after login without exposing setup controls.",
  confidence: .83,
  replyToEventId: "bob-question",
}] })}</CHATCHAT_COUNCIL_JSON>`;
const parsedAnswer = parseProviderConsultationTurn(rawAnswer, context);
assert(parsedAnswer[0]?.kind === "argument", "The real provider parser should preserve the original accepted contribution kind.");
assert(parsedAnswer[0]?.replyToEventId === "bob-question", "The real provider parse path must attach a validated direct reply event id.");

const rawCounterEvidence = `<CHATCHAT_COUNCIL_JSON>${JSON.stringify({ contributions: [{
  kind: "evidence",
  targetEventId: "bob-challenge",
  claim: "A documented recovery primitive exists.",
  content: "The public platform documentation describes the primitive.",
  source: "https://example.com/platform",
  confidence: .8,
  replyToEventId: "bob-question",
}] })}</CHATCHAT_COUNCIL_JSON>`;
const parsedEvidence = parseProviderConsultationTurn(rawCounterEvidence, context);
assert(parsedEvidence[0]?.kind === "evidence" && parsedEvidence[0].replyToEventId === "bob-question", "Evidence may carry both its claim target and a distinct conversational reply edge.");
assert(parsedEvidence[0]?.kind === "evidence" && parsedEvidence[0].targetEventId === "bob-challenge", "Existing evidence target provenance must remain intact.");

const unknownReply = rawAnswer.replace("bob-question", "invented-event");
assertThrows(
  () => parseProviderConsultationTurn(unknownReply, context),
  "current immutable public snapshot",
  "Invented reply ids must be rejected by the same real provider parse path used in production.",
);

const selfReply = rawAnswer.replace("bob-question", "alice-view");
assertThrows(
  () => parseProviderConsultationTurn(selfReply, context),
  "peer's public event",
  "A participant must not fabricate a peer conversation by replying to itself.",
);

const unsupportedReply = `<CHATCHAT_COUNCIL_JSON>${JSON.stringify({ contributions: [{
  kind: "challenge",
  targetEventId: "bob-question",
  content: "Counter-challenge.",
  replyToEventId: "bob-question",
}] })}</CHATCHAT_COUNCIL_JSON>`;
assertThrows(
  () => parseProviderConsultationTurn(unsupportedReply, context),
  "not allowed on challenge",
  "Kinds with existing structured target fields must not create a second ambiguous reply field.",
);

const sealedContext: CouncilContext = { ...context, phase: "sealed", round: 1 };
assertThrows(
  () => parseProviderConsultationTurn(rawAnswer, sealedContext),
  "only during public debate",
  "Explicit replies must never punch through sealed-round independence.",
);

const answerEvent: CouncilEvent = {
  id: "alice-answer", sessionId: "reply-test", round: 3, actorId: "alice", kind: "argument",
  stance: "web-first-with-recovery", content: "The recovery path is automatic.", confidence: .83,
  replyToEventId: "bob-question", createdAt: "2026-08-14T00:00:04Z",
};
const oldArchiveEvent: CouncilEvent = {
  id: "legacy-view", sessionId: "old-archive", round: 1, actorId: "alice", kind: "argument",
  stance: "legacy", content: "Old archives have no reply field.", confidence: .5, createdAt: "2026-01-01T00:00:00Z",
};
const edges = explicitReplyEdges([...events, answerEvent, oldArchiveEvent]);
assert(edges.length === 1 && edges[0]?.eventId === "alice-answer", "Only explicit new reply provenance should create reply edges; old archive events remain valid and silent.");
assert(edges[0]?.replyToEventId === "bob-question", "Reply edge must preserve the exact source event id.");

const laterContext: CouncilContext = {
  ...context,
  round: 4,
  participant: bob,
  publicEvents: [...events, answerEvent],
  ownEvents: events.filter((event) => event.actorId === "bob"),
};
const prompt = buildProviderConsultationPrompt(laterContext);
assert(prompt.includes("CHATCHAT_EXPLICIT_PEER_REPLIES"), "Every real debate provider prompt must receive the reply provenance contract.");
assert(prompt.includes("alice-answer") && prompt.includes("bob-question"), "Later peers must receive existing explicit reply edges even though legacy compact event context did not carry them.");
assert(prompt.includes("genuine direct reply"), "Prompt must forbid turning topical similarity into fake conversation links.");
assert(prompt.includes("replyToEventId"), "Real provider prompt must explain the optional reply field.");

console.log("✓ ChatChat explicit peer reply provenance tests passed");
console.log("✓ Direct answers are traceable, repairable, old-archive compatible and impossible to infer from prose alone");
