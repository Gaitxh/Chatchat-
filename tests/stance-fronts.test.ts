import type { CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import { deriveConflictBoard } from "../src/theater/conflict-board.js";
import { deriveConflictStanceFronts } from "../src/theater/stance-fronts.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "gpt", name: "ChatGPT", provider: "openai" },
  { id: "claude", name: "Claude", provider: "anthropic" },
  { id: "gemini", name: "Gemini", provider: "google" },
];
const base = { sessionId: "front-session", createdAt: "2026-08-15T00:00:00.000Z" };
const events: CouncilEvent[] = [
  { ...base, id: "c1", round: 1, actorId: "claude", kind: "argument", stance: "Web UI", content: "Web Room should be visible.", confidence: .72 },
  { ...base, id: "ch1", round: 2, actorId: "gpt", kind: "challenge", targetEventId: "c1", content: "How does it reach logged-in Provider tabs?" },
  { ...base, id: "ev1", round: 2, actorId: "gemini", kind: "evidence", targetEventId: "c1", claim: "Runtime host permission exists.", content: "Browser docs support a hidden bridge.", confidence: .84 },
  { ...base, id: "c2", round: 3, actorId: "claude", kind: "revision", previousEventId: "c1", stance: "Web + Extension", content: "I now prefer Web-first with a bridge.", confidence: .87, causedBy: ["ev1"] },
  { ...base, id: "s1", round: 3, actorId: "gemini", kind: "support", targetEventId: "c2", content: "I support that split." },
  { ...base, id: "q1", round: 3, actorId: "gpt", kind: "question", targetActorId: "claude", content: "What bridge failure reverses this choice?" },
];

const board = deriveConflictBoard(participants, events);
const thread = board.threads.find((item) => item.anchorEventId === "c1");
assert(thread, "Expected Claude's original stance to anchor a conflict thread");
const fronts = deriveConflictStanceFronts(thread, events);

const oldFront = fronts.fronts.find((front) => front.stance === "Web UI");
const newFront = fronts.fronts.find((front) => front.stance === "Web + Extension");
assert(oldFront?.state === "vacated", "An abandoned explicit stance should remain as a vacated front");
assert(oldFront.currentMembers.length === 0 && oldFront.formerMembers.some((member) => member.actorId === "claude"), "Vacated front should preserve who previously occupied it");
assert(oldFront.challengeEventIds.includes("ch1"), "Challenge pressure should stay attached to the exact stance it targeted");
assert(oldFront.evidenceEventIds.includes("ev1"), "Targeted evidence should stay attached to the exact stance it targeted");
assert(newFront?.state === "current" && newFront.currentMembers.some((member) => member.actorId === "claude"), "Latest explicit revision should occupy the current front");
assert(newFront.supportEventIds.includes("s1"), "Explicit support should attach to the stance-bearing event it targeted");
assert(newFront.unresolvedTargetEventIds.includes("q1"), "Open direct question to the current holder should remain attached to that front");
assert(fronts.movements.length === 1, "One explicit revision across different stance labels should create one movement");
assert(fronts.movements[0]?.revisionEventId === "c2" && fronts.movements[0]?.previousEventId === "c1", "Movement must preserve exact revision provenance");
assert(fronts.movements[0]?.causedByEventIds.includes("ev1"), "Movement must retain explicit causedBy provenance");
assert(fronts.uncommittedActorIds.includes("gpt") && fronts.uncommittedActorIds.includes("gemini"), "Challenge/evidence/support participation must not be silently promoted into a stance");

const exactLabelEvents: CouncilEvent[] = [
  { ...base, id: "a1", round: 1, actorId: "claude", kind: "argument", stance: "Web + Extension", content: "A.", confidence: .7 },
  { ...base, id: "a2", round: 2, actorId: "gpt", kind: "argument", replyToEventId: "a1", stance: "web + extension", content: "Same explicit label ignoring case.", confidence: .7 },
  { ...base, id: "a3", round: 2, actorId: "gemini", kind: "argument", replyToEventId: "a1", stance: "Web+Extension", content: "Semantically similar but textually distinct label.", confidence: .7 },
];
const exactBoard = deriveConflictBoard(participants, exactLabelEvents);
const exactThread = exactBoard.threads.find((item) => item.anchorEventId === "a1");
assert(exactThread, "Reply-linked stance events should form a conflict thread");
const exactFronts = deriveConflictStanceFronts(exactThread, exactLabelEvents);
assert(exactFronts.fronts.length === 2, "Only case/repeated-whitespace normalization is allowed; punctuation/spacing variants must not be semantically merged");
const grouped = exactFronts.fronts.find((front) => front.currentMembers.length === 2);
assert(grouped?.currentMembers.some((member) => member.actorId === "claude") && grouped.currentMembers.some((member) => member.actorId === "gpt"), "Case-only variants may share one deterministic exact-label front");

console.log("✓ ChatChat explicit stance-front tests passed");
console.log("✓ Challenge/evidence/support activity never invents an unstated participant stance");
console.log("✓ Revisions preserve vacated fronts and exact movement provenance");
