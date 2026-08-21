import type { CouncilEvent } from "../src/core/types.js";
import { selectProviderContextEvents } from "../src/provider-sdk/context-selection.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const overfull = buildOverfullRound(["a", "b", "c"], 6);
const selected = selectProviderContextEvents(overfull, { maxEvents: 12, maxPinnedIssueEvents: 0 });
assert(selected.events.length === 12, "Overfull latest round must stay inside the hard 12-event budget.");
assert(selected.latestRoundEventIds.length === 12, "All selected slots are latest-round slots in this fixture.");
assert(selected.latestRoundActorIds.join(",") === "a,b,c", "Selector must audit every actor that actually spoke in the latest round.");
assert(selected.latestRoundSelectedActorIds.length === 3, "All three latest-round actors must remain represented when 12 slots can cover them.");
assert(selected.latestRoundOmittedActorIds.length === 0, "No actor may be omitted when the budget can give every seat representation.");
const counts = countActors(selected.events);
assert(counts.get("a") === 4 && counts.get("b") === 4 && counts.get("c") === 4, "Three equal seats must receive 4 latest-round slots each instead of publication-order slice bias.");
assert(selected.events.some((event) => event.id === "a-open-question"), "A canonical-open source must survive inside its actor's balanced quota before ordinary same-round recency.");
assert(isChronological(selected.events, overfull), "Seat balancing must restore original Blackboard chronology after selection.");

// Reorder the actor publication blocks. Quotas and per-actor selected suffixes
// must not change merely because one Provider was published later in Blackboard.
const reordered = buildOverfullRound(["c", "a", "b"], 6);
const reorderedSelection = selectProviderContextEvents(reordered, { maxEvents: 12, maxPinnedIssueEvents: 0 });
const reorderedCounts = countActors(reorderedSelection.events);
assert(reorderedCounts.get("a") === 4 && reorderedCounts.get("b") === 4 && reorderedCounts.get("c") === 4, "Changing actor publication order must not change equal seat quotas.");
assert(reorderedSelection.events.some((event) => event.id === "a-open-question"), "Open issue protection must remain independent of actor publication order.");

// Five seats cannot divide 12 perfectly, but no seat should receive fewer than
// two slots and the remainder must not automatically belong to publication-tail actors.
const five = buildOverfullRound(["a", "b", "c", "d", "e"], 4);
const fiveSelection = selectProviderContextEvents(five, { maxEvents: 12, maxPinnedIssueEvents: 0 });
const fiveCounts = [...countActors(fiveSelection.events).values()];
assert(Math.min(...fiveCounts) >= 2 && Math.max(...fiveCounts) <= 3, "Five-seat overfull selection must distribute 12 slots as balanced 2/3 quotas.");
assert(fiveSelection.latestRoundSelectedActorIds.length === 5, "All five seats must remain represented when the cap allows it.");

// If actor count itself exceeds the hard cap, mathematical full representation
// is impossible. That limitation must be explicit rather than silently called fair.
const thirteenActors = Array.from({ length: 13 }, (_, index) => `seat-${index + 1}`);
const actorOverflow = buildOverfullRound(thirteenActors, 1);
const actorOverflowSelection = selectProviderContextEvents(actorOverflow, { maxEvents: 12, maxPinnedIssueEvents: 0 });
assert(actorOverflowSelection.latestRoundSelectedActorIds.length === 12, "A 12-slot cap cannot represent more than 12 one-event actors.");
assert(actorOverflowSelection.latestRoundOmittedActorIds.length === 1, "Unrepresentable latest-round actors must be explicitly audited.");
assert(new Set(actorOverflowSelection.events.map((event) => event.actorId)).size === 12, "Actor-overflow selection must still give one slot per selected seat before duplicates.");

console.log("✓ overfull latest-round context is seat-balanced instead of biased by Blackboard publication order");
console.log("✓ canonical-open same-round sources survive within actor quota and unrepresentable actor overflow stays explicit");

function buildOverfullRound(actorOrder: readonly string[], eventsPerActor: number): CouncilEvent[] {
  const events: CouncilEvent[] = [];
  let tick = 0;
  for (const actorId of actorOrder) {
    for (let index = 0; index < eventsPerActor; index += 1) {
      const isOpenQuestion = actorId === "a" && index === 0;
      events.push({
        id: isOpenQuestion ? "a-open-question" : `${actorId}-${index + 1}`,
        sessionId: "seat-balanced-memory-test",
        round: 2,
        actorId,
        createdAt: `2026-08-21T00:00:${String(tick++).padStart(2, "0")}.000Z`,
        ...(isOpenQuestion
          ? { kind: "question" as const, targetActorId: "b", content: "What concrete failure mode would overturn this stance?" }
          : { kind: "argument" as const, stance: actorId.toUpperCase(), content: `${actorId} ordinary point ${index + 1}`, confidence: .7 }),
      } as CouncilEvent);
    }
  }
  return events;
}

function countActors(events: readonly CouncilEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.actorId, (counts.get(event.actorId) ?? 0) + 1);
  return counts;
}

function isChronological(selected: readonly CouncilEvent[], full: readonly CouncilEvent[]): boolean {
  const indexes = selected.map((item) => full.findIndex((candidate) => candidate.id === item.id));
  return indexes.every((value, index) => index === 0 || indexes[index - 1]! < value);
}
