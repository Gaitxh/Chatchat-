import type { CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import { deriveOpenMeetingIssueProvenance } from "../src/consultation/open-issues.js";
import { deriveConflictBoard } from "../src/theater/conflict-board.js";
import { deriveConflictResolutionLedger } from "../src/theater/conflict-resolution.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "a", name: "Alpha", provider: "a" },
  { id: "b", name: "Beta", provider: "b" },
  { id: "c", name: "Gamma", provider: "c" },
];
const base = { sessionId: "conflict-resolution-session", createdAt: "2026-08-15T00:00:00.000Z" };
const events: CouncilEvent[] = [
  { ...base, id: "a1", round: 1, actorId: "a", kind: "argument", stance: "Plan A", content: "Use Plan A.", confidence: .72 },
  { ...base, id: "b1", round: 1, actorId: "b", kind: "argument", stance: "Plan B", content: "Use Plan B.", confidence: .7 },
  { ...base, id: "q1", round: 2, actorId: "b", kind: "question", targetActorId: "a", content: "What is the failure bound?" },
  { ...base, id: "ch1", round: 2, actorId: "c", kind: "challenge", targetEventId: "a1", content: "The cost assumption is unsupported." },
  { ...base, id: "ev1", round: 2, actorId: "c", kind: "evidence", targetEventId: "a1", claim: "Benchmark contradicts the cost assumption.", content: "A public benchmark gives a higher cost.", confidence: .82 },
  { ...base, id: "u1", round: 2, actorId: "b", kind: "uncertain", content: "I am unsure about rollout risk.", confidence: .35 },
  { ...base, id: "ans1", round: 3, actorId: "a", kind: "argument", stance: "Plan A", content: "The failure bound is 5% under the stated constraint.", confidence: .75, replyToEventId: "q1" },
  { ...base, id: "evReply", round: 3, actorId: "a", kind: "argument", stance: "Plan A", content: "The benchmark comparison needs a narrower scope.", confidence: .8, replyToEventId: "ev1" },
  { ...base, id: "b2", round: 3, actorId: "b", kind: "revision", previousEventId: "b1", stance: "Plan A with guardrails", content: "The new evidence changes my rollout view.", confidence: .68, causedBy: ["ev1"] },
  { ...base, id: "f1", round: 4, actorId: "a", kind: "final_position", stance: "Plan A", content: "Final.", confidence: .8 },
  { ...base, id: "f2", round: 4, actorId: "b", kind: "final_position", stance: "Plan A with guardrails", content: "Final.", confidence: .75 },
  { ...base, id: "f3", round: 4, actorId: "c", kind: "final_position", stance: "Plan B", content: "Final.", confidence: .72 },
];

const board = deriveConflictBoard(participants, events);
const ledger = deriveConflictResolutionLedger(participants, events, board);

const question = ledger.obligations.find((item) => item.sourceEventId === "q1");
assert(question?.state === "resolved", "The exact direct reply should resolve the targeted question.");
assert(question.resolvedByEventId === "ans1" && question.resolvedRound === 3, "Question closure must preserve the exact resolver event and round.");
assert(question.resolverActorId === "a", "Only the targeted actor's explicit answer should close the question.");

const challenge = ledger.obligations.find((item) => item.sourceEventId === "ch1");
assert(challenge?.state === "open", "An unanswered challenge must remain open even when the target later publishes unrelated text.");
assert(!challenge.resolvedByEventId, "Open obligations must never receive an invented resolver event.");

const evidence = ledger.obligations.find((item) => item.sourceEventId === "ev1");
assert(evidence?.state === "resolved" && evidence.resolvedByEventId === "evReply", "Targeted evidence must close only through exact structured response provenance.");

const uncertainty = ledger.obligations.find((item) => item.sourceEventId === "u1");
assert(uncertainty?.state === "resolved" && uncertainty.resolvedByEventId === "b2", "Higher-confidence own revision caused by another event should resolve explicit uncertainty.");

assert(ledger.openCount === 1, "Exactly the unanswered challenge should remain open.");
assert(ledger.resolvedCount === 3, "Question, evidence and uncertainty should have exact closure receipts.");

const openIssueIds = deriveOpenMeetingIssueProvenance(events)
  .map((item) => item.sourceEventId)
  .sort();
const openLedgerIds = ledger.obligations
  .filter((item) => item.state === "open")
  .map((item) => item.sourceEventId)
  .sort();
assert(
  JSON.stringify(openIssueIds) === JSON.stringify(openLedgerIds),
  "Open Issues and Conflict Resolution Ledger must expose exactly the same unresolved source events.",
);

const planAThreadId = board.eventThreadIds.a1;
assert(Boolean(planAThreadId), "The Plan A anchor must have a conflict thread.");
const planA = ledger.threads.find((thread) => thread.threadId === planAThreadId);
assert(planA, "Resolution ledger must preserve Conflict Board thread identity.");
assert(planA.obligations.some((item) => item.sourceEventId === "ch1"), "Challenge obligation must stay in its target position thread.");
assert(planA.trajectory.some((item) => item.round === 2 && item.openedCount >= 2), "Round 2 trajectory must show newly opened structural obligations.");
assert(planA.trajectory.some((item) => item.round === 3 && item.resolvedCount >= 1), "Round 3 trajectory must show an exact closure event.");
assert(planA.trajectory.at(-1)?.openAtEnd === 1, "Trajectory must retain the still-open challenge at the end of the meeting.");

const unrelatedReply: CouncilEvent = {
  ...base,
  id: "fake-answer",
  round: 3,
  actorId: "c",
  kind: "argument",
  stance: "Plan B",
  content: "I answered the failure-bound question in prose.",
  confidence: .8,
};
const withoutExactReply = events.filter((event) => event.id !== "ans1").concat(unrelatedReply);
const strictLedger = deriveConflictResolutionLedger(participants, withoutExactReply);
assert(
  strictLedger.obligations.find((item) => item.sourceEventId === "q1")?.state === "open",
  "Similar prose or third-party claims of answering must not close a direct question.",
);
const strictOpenIssueIds = deriveOpenMeetingIssueProvenance(withoutExactReply)
  .map((item) => item.sourceEventId)
  .sort();
const strictOpenLedgerIds = strictLedger.obligations
  .filter((item) => item.state === "open")
  .map((item) => item.sourceEventId)
  .sort();
assert(
  JSON.stringify(strictOpenIssueIds) === JSON.stringify(strictOpenLedgerIds),
  "Canonical resolver consistency must survive anti-prose-inference cases too.",
);

console.log("✓ Conflict Resolution Ledger preserves exact closure provenance, round trajectory and Open Issues consistency");
