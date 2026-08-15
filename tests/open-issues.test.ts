import type { CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import { deriveOpenMeetingIssues } from "../src/consultation/open-issues.js";
import { directPeerRequestTarget, eventReferences } from "../src/consultation/structured-response.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

let counter = 0;
const participants: CouncilParticipant[] = [
  { id: "a", name: "ChatGPT", provider: "test" },
  { id: "b", name: "Claude", provider: "test" },
  { id: "c", name: "Gemini", provider: "test" },
];
const events: CouncilEvent[] = [
  event({ id: "arg-a", round: 1, actorId: "a", kind: "argument", stance: "A", content: "Original A", confidence: 0.8 }),
  event({ id: "arg-b", round: 1, actorId: "b", kind: "argument", stance: "B", content: "Original B", confidence: 0.8 }),
  event({ id: "q-open", round: 2, actorId: "a", kind: "question", targetActorId: "b", content: "What evidence would reverse B?" }),
  event({ id: "third-party-reply", round: 3, actorId: "c", kind: "argument", stance: "C", content: "Gemini tries to answer for Claude.", confidence: 0.7, replyToEventId: "q-open" }),
  event({ id: "q-answered", round: 2, actorId: "c", kind: "question", content: "Is the source current?" }),
  event({ id: "e-answer", round: 3, actorId: "a", kind: "evidence", targetEventId: "q-answered", claim: "Current source", content: "A current primary source answers the question.", source: "https://example.com/current", confidence: 0.9 }),
  event({ id: "challenge-open", round: 2, actorId: "b", kind: "challenge", targetEventId: "arg-a", content: "A ignores a major failure mode." }),
  event({ id: "challenge-resolved", round: 2, actorId: "a", kind: "challenge", targetEventId: "arg-b", content: "B ignores browser permissions." }),
  event({ id: "revision-b", round: 3, actorId: "b", kind: "revision", previousEventId: "arg-b", stance: "A", content: "I revise after the challenge.", confidence: 0.9, causedBy: ["challenge-resolved"] }),
  event({ id: "e-waiting", round: 3, actorId: "c", kind: "evidence", claim: "Unanswered evidence", content: "No one has reacted yet.", source: "https://example.com/unanswered", confidence: 0.7 }),
  event({ id: "e-used", round: 3, actorId: "a", kind: "evidence", claim: "Influential evidence", content: "This evidence later receives explicit support.", source: "https://example.com/influential", confidence: 0.95 }),
  event({ id: "support-e-used", round: 3, actorId: "b", kind: "support", targetEventId: "e-used", content: "I support this evidence." }),
  event({ id: "self-evidence", round: 3, actorId: "a", kind: "evidence", targetEventId: "arg-a", claim: "Evidence attached to my own claim", content: "This is room material, not a request for myself to answer myself.", confidence: 0.8 }),
  event({ id: "support-self-evidence", round: 3, actorId: "b", kind: "support", targetEventId: "self-evidence", content: "A peer explicitly responds to the self-attached evidence." }),
  event({ id: "uncertain-open", round: 3, actorId: "a", kind: "uncertain", content: "One implementation risk remains.", confidence: 0.3 }),
  event({ id: "uncertain-resolved", round: 3, actorId: "c", kind: "uncertain", content: "I am unsure about the permission boundary.", confidence: 0.2 }),
  event({ id: "final-c", round: 4, actorId: "c", kind: "final_position", stance: "A", content: "Later evidence resolved my uncertainty.", confidence: 0.8, caveats: [] }),
];

const issues = deriveOpenMeetingIssues(participants, events);
const ids = new Set(issues.map((issue) => issue.sourceEventId));
assert(ids.has("q-open"), "A third party must not discharge Claude's direct response obligation.");
assert(!ids.has("q-answered"), "An untargeted question with an explicit later response must close.");
assert(ids.has("challenge-open"), "Unanswered challenge must stay open.");
assert(!ids.has("challenge-resolved"), "Challenge causing the targeted participant's later revision must close.");
assert(ids.has("e-waiting"), "Evidence with no explicit response must remain awaiting response.");
assert(!ids.has("e-used"), "Untargeted evidence explicitly supported later must close its awaiting-response issue.");
assert(!ids.has("self-evidence"), "Evidence attached to the actor's own prior claim must not create self-response debt when a peer explicitly responds.");
assert(ids.has("uncertain-open"), "Unresolved explicit uncertainty must remain visible.");
assert(!ids.has("uncertain-resolved"), "Later confident non-uncertain final position by the same actor must close uncertainty.");
const openQuestion = issues.find((issue) => issue.sourceEventId === "q-open");
assert(openQuestion?.targetActorId === "b" && openQuestion.targetActorName === "Claude", "Open issue must retain the exact participant who owes the response.");
const openChallenge = issues.find((issue) => issue.sourceEventId === "challenge-open");
assert(openChallenge?.actorName === "Claude", "Issue derivation must retain participant identity without another AI summary pass.");
assert(openChallenge?.relatedEventIds.includes("arg-a"), "Open challenge must retain targeted event provenance.");
assert(eventReferences(events.find((item) => item.id === "revision-b")!).includes("challenge-resolved"), "Revision references must expose causedBy ids.");
assert(eventReferences(events.find((item) => item.id === "e-answer")!).includes("q-answered"), "Evidence references must expose target ids.");
const eventById = new Map(events.map((item) => [item.id, item] as const));
assert(directPeerRequestTarget(events.find((item) => item.id === "self-evidence")!, eventById) === null, "Self-targeted evidence must not become a direct peer request to the same actor.");

console.log("✓ ChatChat open meeting issue derivation tests passed");

function event<T extends Omit<CouncilEvent, "sessionId" | "createdAt">>(value: T): CouncilEvent {
  return { ...value, sessionId: "open-issues-test", createdAt: `2026-08-14T00:00:${String(counter++).padStart(2, "0")}.000Z` } as CouncilEvent;
}
