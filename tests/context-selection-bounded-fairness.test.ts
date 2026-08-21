import type { CouncilEvent } from "../src/core/types.js";
import { selectProviderContextEvents } from "../src/provider-sdk/context-selection.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const sessionId = "bounded-memory-procedural-fairness";

// ---------------------------------------------------------------------------
// Ordinary recency: preserve whole newer rounds, balance only boundary round.
// ---------------------------------------------------------------------------
const r1 = [
  argument("a-r1", "a", 1),
  argument("b-r1", "b", 1),
  argument("c-r1", "c", 1),
];
const r2Blocks = {
  a: [argument("a-r2-1", "a", 2), argument("a-r2-2", "a", 2)],
  b: [argument("b-r2-1", "b", 2), argument("b-r2-2", "b", 2)],
  c: [argument("c-r2-1", "c", 2), argument("c-r2-2", "c", 2)],
};
const r3 = [
  argument("a-r3", "a", 3),
  argument("b-r3", "b", 3),
  argument("c-r3", "c", 3),
];
const ordinaryAbc = [...r1, ...r2Blocks.a, ...r2Blocks.b, ...r2Blocks.c, ...r3];
const ordinaryCab = [...r1, ...r2Blocks.c, ...r2Blocks.a, ...r2Blocks.b, ...r3];

// 7 slots: all 3 latest R3 events + exactly 4 ordinary events. R2 is the
// boundary round: it has 6 candidates but only 4 slots remain. R1 must never
// displace R2 merely to improve actor balance across older history.
const recencyA = selectProviderContextEvents(ordinaryAbc, { maxEvents: 7, maxPinnedIssueEvents: 0 });
const recencyB = selectProviderContextEvents(ordinaryCab, { maxEvents: 7, maxPinnedIssueEvents: 0 });
const selectedR2A = recencyA.recentEventIds.filter((id) => id.includes("-r2-"));
const selectedR2B = recencyB.recentEventIds.filter((id) => id.includes("-r2-"));
assert(recencyA.latestRoundEventIds.length === 3, "Newest R3 must remain fully protected before ordinary recency allocation.");
assert(selectedR2A.length === 4, "Boundary R2 must receive all four remaining ordinary-recency slots.");
assert(!recencyA.recentEventIds.some((id) => id.includes("-r1")), "Older R1 must not displace the newer boundary round.");
assert(maxActorDifference(selectedR2A) <= 1, "Boundary-round ordinary recency must differ by at most one slot across equally active seats.");
assert(allActorsPresent(selectedR2A, ["a", "b", "c"]), "Every active boundary-round seat must get one slot before any seat gets its second.");
assert(
  sorted(selectedR2A).join(",") === sorted(selectedR2B).join(","),
  "Boundary-round selected event set must be invariant to actor block publication order.",
);

// If a newer ordinary round fits whole, keep it whole before considering the
// next older boundary round. This preserves actual recency semantics.
const r4 = [argument("a-r4", "a", 4), argument("b-r4", "b", 4), argument("c-r4", "c", 4)];
const recencyLayered = selectProviderContextEvents([...ordinaryAbc, ...r4], { maxEvents: 9, maxPinnedIssueEvents: 0 });
assert(recencyLayered.latestRoundEventIds.join(",") === "a-r4,b-r4,c-r4", "Latest round must remain exact and whole when it fits.");
const selectedR3 = recencyLayered.recentEventIds.filter((id) => id.includes("-r3"));
assert(selectedR3.length === 3, "The next-newest ordinary round must remain whole when remaining capacity fits it exactly.");

// ---------------------------------------------------------------------------
// Pin budget: same priority + same round must not be source-index biased.
// ---------------------------------------------------------------------------
const pinBlocks = {
  a: [uncertain("a-u1", "a", 1), uncertain("a-u2", "a", 1)],
  b: [uncertain("b-u1", "b", 1), uncertain("b-u2", "b", 1)],
  c: [uncertain("c-u1", "c", 1), uncertain("c-u2", "c", 1)],
};
const latest = [argument("a-latest", "a", 2), argument("b-latest", "b", 2), argument("c-latest", "c", 2)];
const pinAbc = [...pinBlocks.a, ...pinBlocks.b, ...pinBlocks.c, ...latest];
const pinCab = [...pinBlocks.c, ...pinBlocks.a, ...pinBlocks.b, ...latest];

// 6 slots total: 3 protected latest events leave exactly 3 pin slots. All six
// old uncertainties are same rank and same round, so source actor is the only
// procedural tie dimension allowed here. Expect exactly one pin source per seat.
const pinsA = selectProviderContextEvents(pinAbc, { maxEvents: 6, maxPinnedIssueEvents: 6 });
const pinsB = selectProviderContextEvents(pinCab, { maxEvents: 6, maxPinnedIssueEvents: 6 });
assert(pinsA.pinnedEventIds.length === 3, "Pin budget must use exactly the three slots remaining after latest-round protection.");
assert(pinsA.pinnedIssueSourceEventIds.length === 3, "Three one-event issue groups must produce three exact pin-source receipts.");
assert(allActorsPresent(pinsA.pinnedIssueSourceEventIds, ["a", "b", "c"]), "Same-rank same-round pin competition must give one source issue to every active actor before a second issue from one actor.");
assert(
  sorted(pinsA.pinnedIssueSourceEventIds).join(",") === sorted(pinsB.pinnedIssueSourceEventIds).join(","),
  "Pinned source set must be invariant to actor block publication order within the same priority and round.",
);

// Structural priority stays stronger than actor balancing. A targeted challenge
// cohort must consume eligible pin budget before lower-rank uncertainty cohorts.
const parentA = argument("a-parent", "a", 1);
const parentB = argument("b-parent", "b", 1);
const highPriority: CouncilEvent[] = [
  parentA,
  parentB,
  {
    id: "c-challenge-a",
    sessionId,
    round: 2,
    actorId: "c",
    kind: "challenge",
    targetEventId: parentA.id,
    content: "Challenge A",
    createdAt: at(2, 1),
  },
  {
    id: "a-challenge-b",
    sessionId,
    round: 2,
    actorId: "a",
    kind: "challenge",
    targetEventId: parentB.id,
    content: "Challenge B",
    createdAt: at(2, 2),
  },
  uncertain("b-low-uncertain", "b", 2),
  argument("a-new", "a", 3),
  argument("b-new", "b", 3),
  argument("c-new", "c", 3),
];
const prioritySelection = selectProviderContextEvents(highPriority, { maxEvents: 7, maxPinnedIssueEvents: 4 });
assert(prioritySelection.pinnedIssueSourceEventIds.includes("c-challenge-a"), "Higher-priority challenged claim must retain pin eligibility before lower-rank uncertainty.");
assert(prioritySelection.pinnedIssueSourceEventIds.includes("a-challenge-b"), "Same high-priority cohort may allocate across source actors before lower-rank cohorts.");
assert(!prioritySelection.pinnedIssueSourceEventIds.includes("b-low-uncertain"), "Lower-rank uncertainty must not leapfrog unresolved challenges merely for actor equalization.");

// Issue context groups remain indivisible. With only one pin slot after latest
// protection, a two-event challenge group cannot be sliced to pin the challenge
// without its bounded structural parent.
const indivisible = selectProviderContextEvents([
  parentA,
  {
    id: "b-challenge-a",
    sessionId,
    round: 2,
    actorId: "b",
    kind: "challenge",
    targetEventId: parentA.id,
    content: "Needs parent context",
    createdAt: at(2, 3),
  },
  argument("a-new2", "a", 3),
  argument("b-new2", "b", 3),
  argument("c-new2", "c", 3),
], { maxEvents: 4, maxPinnedIssueEvents: 4 });
assert(indivisible.pinnedEventIds.length === 0, "A multi-event issue context group that cannot fit must be skipped whole rather than partially pinned.");
assert(indivisible.pinnedIssueSourceEventIds.length === 0, "Skipped indivisible issue group must not emit a false pin-source receipt.");

console.log("✓ ordinary recency preserves whole newer rounds and seat-balances only the truncated boundary round");
console.log("✓ same-rank same-round pin competition is source-actor balanced without weakening structural priority or splitting issue groups");

function argument(id: string, actorId: string, round: number): CouncilEvent {
  return {
    id,
    sessionId,
    round,
    actorId,
    kind: "argument",
    stance: actorId.toUpperCase(),
    content: id,
    confidence: 0.7,
    createdAt: at(round, numericSuffix(id)),
  };
}

function uncertain(id: string, actorId: string, round: number): CouncilEvent {
  return {
    id,
    sessionId,
    round,
    actorId,
    kind: "uncertain",
    content: id,
    confidence: 0.2,
    createdAt: at(round, numericSuffix(id)),
  };
}

function at(round: number, offset: number): string {
  return `2026-08-21T0${round}:00:${String(offset % 60).padStart(2, "0")}.000Z`;
}

function numericSuffix(id: string): number {
  return [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 59;
}

function actorOf(id: string): string { return id.split("-")[0]!; }
function actorCounts(ids: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of ids) counts[actorOf(id)] = (counts[actorOf(id)] ?? 0) + 1;
  return counts;
}
function maxActorDifference(ids: readonly string[]): number {
  const values = Object.values(actorCounts(ids));
  return values.length ? Math.max(...values) - Math.min(...values) : 0;
}
function allActorsPresent(ids: readonly string[], actorIds: readonly string[]): boolean {
  const seen = new Set(ids.map(actorOf));
  return actorIds.every((actorId) => seen.has(actorId));
}
function sorted(values: readonly string[]): string[] { return [...values].sort(); }
