import type { CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import { deriveConflictBoard } from "../src/theater/conflict-board.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "gpt", name: "ChatGPT", provider: "openai" },
  { id: "claude", name: "Claude", provider: "anthropic" },
  { id: "gemini", name: "Gemini", provider: "google" },
];
const base = { sessionId: "conflict-session", createdAt: "2026-08-15T00:00:00.000Z" };
const events: CouncilEvent[] = [
  { ...base, id: "c1", round: 1, actorId: "claude", kind: "argument", stance: "Web UI", content: "Make the Web Room the visible product.", confidence: .72 },
  { ...base, id: "g1", round: 1, actorId: "gpt", kind: "argument", stance: "Extension", content: "Make the extension the visible product.", confidence: .75 },
  // Identical prose does not merge these independent anchors.
  { ...base, id: "gm1", round: 1, actorId: "gemini", kind: "argument", stance: "Extension", content: "Make the extension the visible product.", confidence: .74 },
  { ...base, id: "ch1", round: 2, actorId: "gpt", kind: "challenge", targetEventId: "c1", content: "Show why the Web Room can still reach logged-in Provider tabs." },
  { ...base, id: "ev1", round: 2, actorId: "gemini", kind: "evidence", targetEventId: "c1", claim: "Optional host permissions can be requested at runtime.", content: "Browser permission documentation supports a hidden bridge.", source: "https://example.com/permissions", confidence: .82 },
  { ...base, id: "q1", round: 2, actorId: "claude", kind: "question", targetActorId: "gpt", content: "Which user-facing surface should own the consultation?" },
  { ...base, id: "d1", round: 3, actorId: "claude", kind: "defense", targetEventId: "ch1", content: "The Web Room owns UX while the extension only supplies browser access." },
  { ...base, id: "answer1", round: 3, actorId: "gpt", kind: "argument", replyToEventId: "q1", stance: "Extension", content: "The visible surface can be Web-first if the bridge stays reliable.", confidence: .78 },
  { ...base, id: "c2", round: 3, actorId: "claude", kind: "revision", previousEventId: "c1", stance: "Web + Extension", content: "I now prefer a Web-first room with a hidden bridge.", confidence: .86, causedBy: ["ev1", "q1"] },
  { ...base, id: "s1", round: 3, actorId: "gemini", kind: "support", targetEventId: "c2", content: "This split keeps Provider mechanics out of the primary UX." },
  { ...base, id: "q2", round: 3, actorId: "gpt", kind: "question", targetActorId: "claude", content: "What reliability failure would reverse that architecture choice?" },
];

const board = deriveConflictBoard(participants, events);
const webThread = board.threads.find((thread) => thread.anchorEventId === "c1");
assert(webThread, "Targeted challenge/evidence/revision should stay anchored to Claude's original public position");
assert(webThread.status === "position_changed", "A fully answered thread with an explicit revision should be marked position_changed");
assert(webThread.anchorStance === "Web UI", "The original stance must remain visible as the thread anchor");
assert(webThread.counts.challenge === 1, "Challenge must stay in the target position thread");
assert(webThread.counts.evidence === 1, "Targeted evidence must stay in the target position thread");
assert(webThread.counts.defense === 1, "Defense of the challenge must resolve back through the same thread");
assert(webThread.counts.revision === 1 && webThread.counts.support === 1, "Revision/support activity should remain event-backed");
assert(webThread.openIssueIds.length === 0, "Challenge and evidence explicitly answered by defense/revision should not remain open");
assert(webThread.movementEventIds.includes("c2"), "Revision event id must remain traceable as movement provenance");
assert(webThread.participantIds.length === 3, "Thread participation should come from actual event actors");
assert(webThread.externalInfluences.some((item) => item.causeEventId === "q1" && item.causeThreadId === "conflict:q1"), "Cross-thread revision cause should be linked, not used to semantically merge two threads");

const answeredQuestion = board.threads.find((thread) => thread.anchorEventId === "q1");
assert(answeredQuestion?.status === "answered", "Direct question with exact reply provenance should become answered");
assert(answeredQuestion.counts.reply === 1, "Explicit reply should remain visible in the question thread");
assert(answeredQuestion.eventIds.includes("answer1"), "Answer event must map to the exact question thread");

const openQuestion = board.threads.find((thread) => thread.anchorEventId === "q2");
assert(openQuestion?.status === "open", "Unanswered direct question must remain an open conflict thread");
assert(openQuestion.openIssueEventIds.includes("q2"), "Open issue must preserve exact source event id");

assert(!board.threads.some((thread) => thread.anchorEventId === "g1"), "Standalone positions without interaction should not clutter the Conflict Board");
assert(!board.threads.some((thread) => thread.anchorEventId === "gm1"), "Identical standalone prose must not be merged or promoted into a conflict thread");
assert(board.eventThreadIds.g1 !== board.eventThreadIds.gm1, "Text similarity must never merge independent anchors");
assert(board.eventThreadIds.ch1 === "conflict:c1" && board.eventThreadIds.ev1 === "conflict:c1", "Target references must deterministically map to the anchor thread");
assert(board.openIssueCount === 1, "Only the truly unresolved structured issue should remain open");

const uncertaintyOnly: CouncilEvent[] = [
  { ...base, id: "u1", round: 2, actorId: "gemini", kind: "uncertain", content: "The relevant adoption data is missing.", confidence: .35 },
];
const uncertaintyBoard = deriveConflictBoard(participants, uncertaintyOnly);
assert(uncertaintyBoard.threads[0]?.status === "open", "Explicit unresolved uncertainty should be visible even without a peer target");
assert(uncertaintyBoard.threads[0]?.anchorEventId === "u1", "Uncertainty thread must preserve its own exact anchor event");

const movedButOpenEvents: CouncilEvent[] = [
  { ...base, id: "m1", round: 1, actorId: "claude", kind: "argument", stance: "A", content: "Initial position A.", confidence: .7 },
  { ...base, id: "m-challenge", round: 2, actorId: "gpt", kind: "challenge", targetEventId: "m1", content: "This assumption is still unsupported." },
  { ...base, id: "m-evidence", round: 2, actorId: "gemini", kind: "evidence", targetEventId: "m1", claim: "A separate premise has evidence.", content: "This evidence changes part of the picture.", confidence: .8 },
  { ...base, id: "m2", round: 3, actorId: "claude", kind: "revision", previousEventId: "m1", stance: "B", content: "I revise because of the evidence, but I have not answered the challenge.", confidence: .82, causedBy: ["m-evidence"] },
];
const movedButOpenBoard = deriveConflictBoard(participants, movedButOpenEvents);
const movedButOpen = movedButOpenBoard.threads.find((thread) => thread.anchorEventId === "m1");
assert(movedButOpen?.status === "open", "Unanswered obligations must keep the thread OPEN even after a revision");
assert(movedButOpen.counts.revision === 1 && movedButOpen.movementEventIds.includes("m2"), "Open status must not erase explicit position movement");
assert(movedButOpen.openIssueEventIds.includes("m-challenge"), "The unanswered challenge must remain exactly traceable after movement");

console.log("✓ ChatChat Conflict Board deterministic provenance tests passed");
console.log("✓ Conflict threads keep movement and unresolved obligations as independent facts");
console.log("✓ Conflict threads do not use prose similarity or hidden-chair summarization");
