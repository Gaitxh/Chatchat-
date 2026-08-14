import type {
  CouncilEvent,
  CouncilParticipant,
} from "../src/core/types.js";
import {
  deriveOpenMeetingIssues,
  references,
} from "../src/consultation/open-issues.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "a", name: "ChatGPT", provider: "test" },
  { id: "b", name: "Claude", provider: "test" },
  { id: "c", name: "Gemini", provider: "test" },
];

const events: CouncilEvent[] = [
  event({ id: "arg-a", round: 1, actorId: "a", kind: "argument", stance: "A", content: "Original A", confidence: 0.8 }),
  event({ id: "arg-b", round: 1, actorId: "b", kind: "argument", stance: "B", content: "Original B", confidence: 0.8 }),
  event({ id: "q-open", round: 2, actorId: "a", kind: "question", targetActorId: "b", content: "What evidence would reverse B?" }),
  event({ id: "q-answered", round: 2, actorId: "c", kind: "question", content: "Is the source current?" }),
  event({ id: "e-answer", round: 3, actorId: "a", kind: "evidence", targetEventId: "q-answered", claim: "Current source", content: "A current primary source answers the question.", source: "https://example.com/current", confidence: 0.9 }),
  event({ id: "challenge-open", round: 2, actorId: "b", kind: "challenge", targetEventId: "arg-a", content: "A ignores a major failure mode." }),
  event({ id: "challenge-resolved", round: 2, actorId: "a", kind: "challenge", targetEventId: "arg-b", content: "B ignores browser permissions." }),
  event({ id: "revision-b", round: 3, actorId: "b", kind: "revision", previousEventId: "arg-b", stance: "A", content: "I revise after the challenge.", confidence: 0.9, causedBy: ["challenge-resolved"] }),
  event({ id: "e-waiting", round: 3, actorId: "c", kind: "evidence", claim: "Unanswered evidence", content: "No one has reacted yet.", source: "https://example.com/unanswered", confidence: 0.7 }),
  event({ id: "e-used", round: 3, actorId: "a", kind: "evidence", claim: "Influential evidence", content: "This evidence later changes a position.", source: "https://example.com/influential", confidence: 0.95 }),
  event({ id: "support-e-used", round: 3, actorId: "b", kind: "support", targetEventId: "e-used", content: "I support this evidence." }),
  event({ id: "uncertain-open", round: 3, actorId: "a", kind: "uncertain", content: "One implementation risk remains.", confidence: 0.3 }),
  event({ id: "uncertain-resolved", round: 3, actorId: "c", kind: "uncertain", content: "I am unsure about the permission boundary.", confidence: 0.2 }),
  event({ id: "final-c", round: 4, actorId: "c", kind: "final_position", stance: "A", content: "The later evidence resolved my uncertainty.", confidence: 0.8, caveats: [] }),
];

const issues = deriveOpenMeetingIssues(participants, events);
const ids = new Set(issues.map((issue) => issue.sourceEventId));

assert(ids.has("q-open"), "A question with no explicit later reference must remain open.");
assert(!ids.has("q-answered"), "A question explicitly targeted by later evidence must leave the open-question list.");
assert(ids.has("challenge-open"), "A challenge with no defense/revision/concede/evidence response must remain open.");
assert(!ids.has("challenge-resolved"), "A challenge explicitly causing a later revision must be treated as responded to.");
assert(ids.has("e-waiting"), "Evidence with no explicit later response must remain awaiting response.");
assert(!ids.has("e-used"), "Evidence explicitly supported later must no longer be marked awaiting response.");
assert(ids.has("uncertain-open"), "Explicit uncertainty with no later self-resolution must remain visible.");
assert(!ids.has("uncertain-resolved"), "A later confident non-Uncertain final position by the same actor must close that uncertainty item.");

const openChallenge = issues.find((issue) => issue.sourceEventId === "challenge-open");
assert(openChallenge?.actorName === "Claude", "Open issue derivation must retain participant identity without another AI summary pass.");
assert(openChallenge?.relatedEventIds.includes("arg-a"), "Open challenge must retain the exact targeted event for provenance.");

assert(references(events.find((item) => item.id === "revision-b")!).includes("challenge-resolved"), "Revision references should expose causedBy event ids.");
assert(references(events.find((item) => item.id === "e-answer")!).includes("q-answered"), "Evidence references should expose target event ids.");

const sortedRounds = issues.map((issue) => issue.round);
assert(sortedRounds.every((round, index) => index === 0 || sortedRounds[index - 1]! >= round), "Open issues should surface newest unresolved meeting work first.");

console.log("✓ ChatChat open meeting issue derivation tests passed");
console.log("✓ Questions, challenges, evidence and uncertainty stay open until explicit event-graph responses exist");

function event<T extends Omit<CouncilEvent, "sessionId" | "createdAt">>(value: T): CouncilEvent {
  return {
    ...value,
    sessionId: "open-issues-test",
    createdAt: `2026-08-14T00:00:${String(eventsCounter++).padStart(2, "0")}.000Z`,
  } as CouncilEvent;
}

let eventsCounter = 0;
