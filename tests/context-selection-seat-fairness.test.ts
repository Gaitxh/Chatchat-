import type { CouncilEvent } from "../src/core/types.js";
import { selectProviderContextEvents } from "../src/provider-sdk/context-selection.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const sessionId = "seat-balanced-latest-round";
const blocks = {
  a: actorEvents("a", 8),
  b: actorEvents("b", 8),
  c: actorEvents("c", 8),
};

// Worst-case publication layout for the old slice(-12) policy: entire actor
// blocks are contiguous, so later Blackboard publication position determines
// who survives when the latest round alone exceeds the whole context budget.
const abc = [...blocks.a, ...blocks.b, ...blocks.c];
const abcSelection = selectProviderContextEvents(abc, { maxEvents: 12, maxPinnedIssueEvents: 6 });
assert(abcSelection.events.length === 12, "Overflowing latest round must still obey the exact 12-event hard cap.");
assert(abcSelection.latestRoundEventIds.length === 12, "All selected slots are latest-round protected when the latest round itself overflows.");
assertCounts(abcSelection.latestRoundEventIds, { a: 4, b: 4, c: 4 }, "12 slots across 3 equally active seats must allocate 4/4/4.");
assert(isChronological(abcSelection.events, abc), "Fair allocation must restore exact Blackboard chronology before Prompt serialization.");

// Reorder the actor publication blocks while preserving each actor's own event
// sequence. The selected event SET must not change. This proves seat coverage is
// independent of which actor's block happened to be published later.
const cab = [...blocks.c, ...blocks.a, ...blocks.b];
const cabSelection = selectProviderContextEvents(cab, { maxEvents: 12, maxPinnedIssueEvents: 6 });
assertCounts(cabSelection.latestRoundEventIds, { a: 4, b: 4, c: 4 }, "Reordered actor blocks must retain 4/4/4 coverage.");
assert(
  sorted(abcSelection.latestRoundEventIds).join(",") === sorted(cabSelection.latestRoundEventIds).join(","),
  "Selected latest-round event set must be invariant to actor block publication order.",
);
assert(isChronological(cabSelection.events, cab), "Reordered input must still be serialized in its own Blackboard chronology.");

// An indivisible budget cannot be perfectly equal, so require the strongest
// possible invariant: no sufficiently active seat differs by more than one.
const five = selectProviderContextEvents(abc, { maxEvents: 5, maxPinnedIssueEvents: 0 });
const fiveCounts = actorCounts(five.latestRoundEventIds);
const fiveValues = [fiveCounts.a ?? 0, fiveCounts.b ?? 0, fiveCounts.c ?? 0];
assert(Math.max(...fiveValues) - Math.min(...fiveValues) <= 1, "Indivisible latest-round budgets must differ by at most one slot across equally active seats.");
assert(fiveValues.every((value) => value >= 1), "Every active seat must receive one latest-round slot before any seat receives a second when the budget permits it.");

// A quieter seat must not disappear just because two other seats emitted many
// events. Round-robin allocation exhausts the quiet bucket only after preserving
// its available contribution.
const asymmetric = [
  ...actorEvents("a", 10),
  ...actorEvents("b", 10),
  ...actorEvents("c", 1),
];
const asymmetricSelection = selectProviderContextEvents(asymmetric, { maxEvents: 6, maxPinnedIssueEvents: 0 });
const asymmetricCounts = actorCounts(asymmetricSelection.latestRoundEventIds);
assert(asymmetricCounts.c === 1, "A seat with one public event must keep that event under latest-round pressure.");
assert((asymmetricCounts.a ?? 0) + (asymmetricCounts.b ?? 0) === 5, "Remaining capacity may be shared by seats that still have events.");
assert(Math.abs((asymmetricCounts.a ?? 0) - (asymmetricCounts.b ?? 0)) <= 1, "Remaining equally active seats must remain balanced after a quiet bucket is exhausted.");

// Different Provider-facing contexts built from the same immutable public
// snapshot must still select the exact same balanced latest-round event ids.
const repeated = selectProviderContextEvents(abc, { maxEvents: 12 });
assert(
  repeated.latestRoundEventIds.join(",") === abcSelection.latestRoundEventIds.join(","),
  "Seat-balanced allocation must be deterministic for one immutable public snapshot.",
);

console.log("✓ overflowing latest-round Provider memory is seat-balanced and publication-order independent");
console.log("✓ indivisible budgets differ by at most one slot and never erase a quiet active seat when capacity exists");

function actorEvents(actorId: string, count: number): CouncilEvent[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${actorId}-${index + 1}`,
    sessionId,
    round: 5,
    actorId,
    kind: "argument" as const,
    stance: actorId.toUpperCase(),
    content: `${actorId} public contribution ${index + 1}`,
    confidence: 0.7,
    createdAt: `2026-08-21T00:${String(actorId.charCodeAt(0) - 97).padStart(2, "0")}:${String(index).padStart(2, "0")}.000Z`,
  }));
}

function actorCounts(ids: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const id of ids) {
    const actor = id.split("-")[0]!;
    result[actor] = (result[actor] ?? 0) + 1;
  }
  return result;
}

function assertCounts(ids: readonly string[], expected: Record<string, number>, message: string): void {
  const actual = actorCounts(ids);
  assert(
    Object.entries(expected).every(([actor, count]) => actual[actor] === count),
    `${message} Actual: ${JSON.stringify(actual)}`,
  );
}

function isChronological(selected: readonly CouncilEvent[], full: readonly CouncilEvent[]): boolean {
  const indexes = selected.map((item) => full.findIndex((candidate) => candidate.id === item.id));
  return indexes.every((value, index) => index === 0 || indexes[index - 1]! < value);
}

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}
