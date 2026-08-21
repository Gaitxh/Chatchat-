import type { CouncilEvent } from "../src/core/types.js";
import {
  deriveDirectResponseReceipts,
  pendingDirectRequestEventIds,
} from "../src/consultation/direct-response-receipts.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

let sequence = 0;
const base: CouncilEvent[] = [
  event({
    id: "alice-arg",
    round: 1,
    actorId: "alice",
    kind: "argument",
    stance: "A",
    content: "Keep the room local-first.",
    confidence: .8,
  }),
  event({
    id: "bob-question",
    round: 2,
    actorId: "bob",
    kind: "question",
    targetActorId: "alice",
    content: "How does recovery avoid touching user-owned tabs?",
  }),
  event({
    id: "carol-third-party-answer",
    round: 3,
    actorId: "carol",
    kind: "argument",
    stance: "A",
    content: "Carol tries to answer on Alice's behalf.",
    confidence: .7,
    replyToEventId: "bob-question",
  }),
  event({
    id: "bob-challenge",
    round: 2,
    actorId: "bob",
    kind: "challenge",
    targetEventId: "alice-arg",
    content: "The recovery boundary is underspecified.",
  }),
  event({
    id: "carol-evidence",
    round: 2,
    actorId: "carol",
    kind: "evidence",
    targetEventId: "alice-arg",
    claim: "Provider tabs can contain user-owned work.",
    content: "The recovery design must distinguish ownership.",
    confidence: .85,
  }),
  event({
    id: "self-question",
    round: 2,
    actorId: "alice",
    kind: "question",
    targetActorId: "alice",
    content: "This must not create a peer debt to myself.",
  }),
  event({
    id: "room-question",
    round: 2,
    actorId: "carol",
    kind: "question",
    content: "This is a room-wide question without a named respondent.",
  }),
];

const initial = deriveDirectResponseReceipts(base);
assert(initial.length === 3, "Only explicit peer-to-peer question/challenge/evidence requests should create receipts.");
assert(initial.every((receipt) => receipt.status === "pending"), "All three direct requests should start pending.");
assert(initial.find((receipt) => receipt.requestEventId === "bob-question")?.targetActorId === "alice", "Question receipt must retain the exact named respondent.");
assert(initial.find((receipt) => receipt.requestEventId === "bob-challenge")?.targetActorId === "alice", "Challenge receipt must inherit the author of the challenged event.");
assert(initial.find((receipt) => receipt.requestEventId === "carol-evidence")?.targetActorId === "alice", "Targeted evidence receipt must inherit the author of the referenced event.");
assert(pendingDirectRequestEventIds(base).join(",") === "bob-question,bob-challenge,carol-evidence", "A third party replying to Bob's question must not discharge Alice's debt.");

const withAnswers: CouncilEvent[] = [
  ...base,
  event({
    id: "alice-answer",
    round: 3,
    actorId: "alice",
    kind: "argument",
    stance: "A",
    content: "Recovery only navigates ChatChat-created clean Provider tabs.",
    confidence: .9,
    replyToEventId: "bob-question",
  }),
  event({
    id: "alice-defense",
    round: 3,
    actorId: "alice",
    kind: "defense",
    targetEventId: "bob-challenge",
    content: "Ownership metadata makes the boundary explicit.",
  }),
  event({
    id: "alice-revision",
    round: 3,
    actorId: "alice",
    kind: "revision",
    previousEventId: "alice-arg",
    stance: "A-with-explicit-ownership",
    content: "I narrow the claim to ChatChat-created clean tabs.",
    confidence: .92,
    causedBy: ["carol-evidence"],
  }),
];

const answered = deriveDirectResponseReceipts(withAnswers);
assert(answered.every((receipt) => receipt.status === "answered"), "Each direct request should close only after Alice emits an explicit structured response edge.");
assert(answered.find((receipt) => receipt.requestEventId === "bob-question")?.responseEventId === "alice-answer", "Question receipt must name the exact answering event.");
assert(answered.find((receipt) => receipt.requestEventId === "bob-challenge")?.responseEventId === "alice-defense", "Challenge receipt must name the exact defense event.");
assert(answered.find((receipt) => receipt.requestEventId === "carol-evidence")?.responseEventId === "alice-revision", "Targeted evidence receipt may close through an explicit causedBy revision.");
assert(answered.every((receipt) => receipt.responseRound === 3), "Receipts must retain the actual response round.");
assert(pendingDirectRequestEventIds(withAnswers).length === 0, "Answered direct requests must leave no pending debt.");

console.log("✓ ChatChat direct response receipt tests passed");
console.log("✓ Direct peer obligations close only through exact structured provenance from the participant who actually owes the response");

function event<T extends Omit<CouncilEvent, "sessionId" | "createdAt">>(value: T): CouncilEvent {
  return {
    ...value,
    sessionId: "direct-response-receipts",
    createdAt: `2026-08-21T00:00:${String(sequence++).padStart(2, "0")}.000Z`,
  } as CouncilEvent;
}
