import type { CouncilEvent } from "../src/core/types.js";
import { selectProviderContextEvents } from "../src/provider-sdk/context-selection.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const oldQuestion: CouncilEvent = {
  id: "old-direct-question",
  sessionId: "obligation-memory-session",
  round: 1,
  actorId: "a",
  createdAt: "2026-08-21T00:00:00.000Z",
  kind: "question",
  targetActorId: "b",
  content: "What concrete rollback path exists if provider authentication expires mid-consultation?",
};

const latest = buildLatestRound(["a", "b", "c"], 6);
const events = [oldQuestion, ...latest];
const selection = selectProviderContextEvents(events, { maxEvents: 12, maxPinnedIssueEvents: 6 });

assert(selection.events.length === 12, "Obligation-aware scheduling must stay inside the hard 12-event public deck.");
assert(selection.pinnedIssueSourceEventIds.includes(oldQuestion.id), "Old unresolved direct question must regain bounded memory capacity under an overfull newest round.");
assert(selection.pinnedEventIds.includes(oldQuestion.id), "Recovered direct question source must actually be present in the Provider deck.");
assert(selection.latestRoundActorIds.join(",") === "a,b,c", "Audit must retain every actor who spoke in the overfull newest round.");
assert(selection.latestRoundSelectedActorIds.length === 3, "All newest-round actors must remain represented before old obligations consume extra-speech capacity.");
assert(selection.latestRoundOmittedActorIds.length === 0, "Recovering an old obligation must not erase a representable newest-round seat.");
assert(selection.latestRoundEventIds.length === 11, "One old direct obligation should displace one optional newest-round extra event, not an actor floor slot.");
const counts = countActors(selection.events.filter((event) => event.round === 2));
assert(Math.min(...counts.values()) >= 3 && Math.max(...counts.values()) <= 4, "Remaining newest-round events must stay seat-balanced after obligation scheduling.");

const reordered = [oldQuestion, ...buildLatestRound(["c", "a", "b"], 6)];
const reorderedSelection = selectProviderContextEvents(reordered, { maxEvents: 12, maxPinnedIssueEvents: 6 });
assert(reorderedSelection.pinnedEventIds.includes(oldQuestion.id), "Old obligation recovery must not depend on latest-round publication block order.");
assert(reorderedSelection.latestRoundSelectedActorIds.length === 3, "Reordered publication blocks must preserve all newest-round seats.");
const reorderedCounts = countActors(reorderedSelection.events.filter((event) => event.round === 2));
assert(Math.min(...reorderedCounts.values()) >= 3 && Math.max(...reorderedCounts.values()) <= 4, "Reordered latest-round blocks must remain balanced after reserving obligation capacity.");

// A challenge obligation needs its challenged parent to remain intelligible.
const challengedParent: CouncilEvent = {
  id: "old-claim",
  sessionId: "obligation-memory-session",
  round: 1,
  actorId: "b",
  createdAt: "2026-08-21T00:00:01.000Z",
  kind: "argument",
  stance: "Keep bridge visible",
  content: "Visible bridge controls are required for reliability.",
  confidence: .68,
};
const oldChallenge: CouncilEvent = {
  id: "old-challenge",
  sessionId: "obligation-memory-session",
  round: 1,
  actorId: "a",
  createdAt: "2026-08-21T00:00:02.000Z",
  kind: "challenge",
  targetEventId: challengedParent.id,
  content: "Why must reliability controls remain visible rather than becoming automatic infrastructure?",
};
const challengeSelection = selectProviderContextEvents(
  [challengedParent, oldChallenge, ...latest],
  { maxEvents: 12, maxPinnedIssueEvents: 6 },
);
assert(challengeSelection.pinnedIssueSourceEventIds.includes(oldChallenge.id), "Old unresolved challenge must be scheduled as an obligation group.");
assert(challengeSelection.pinnedEventIds.includes(oldChallenge.id), "Challenge source must be restored.");
assert(challengeSelection.pinnedEventIds.includes(challengedParent.id), "Challenge target parent must be restored with its source so the obligation stays intelligible.");
assert(challengeSelection.latestRoundSelectedActorIds.length === 3, "Two-slot obligation group must still preserve one newest-round event per representable actor.");

// If the actor floor itself consumes all 12 slots, old obligations cannot fit.
// That is a mathematical limit, not permission to silently sacrifice a seat.
const twelveActors = Array.from({ length: 12 }, (_, index) => `seat-${index + 1}`);
const saturated = selectProviderContextEvents(
  [oldQuestion, ...buildLatestRound(twelveActors, 2)],
  { maxEvents: 12, maxPinnedIssueEvents: 6 },
);
assert(saturated.latestRoundSelectedActorIds.length === 12, "A saturated 12-seat floor must represent every newest-round actor once.");
assert(!saturated.pinnedEventIds.includes(oldQuestion.id), "Old obligation cannot displace a newest-round actor when the seat floor consumes the entire hard cap.");
assert(saturated.events.length === 12, "Saturated floor must still respect the hard cap.");

console.log("✓ obligation-aware memory scheduling preserves seat floor, restores old direct duties, carries structural parents, and exposes mathematical saturation");

function buildLatestRound(actorOrder: readonly string[], eventsPerActor: number): CouncilEvent[] {
  const result: CouncilEvent[] = [];
  let tick = 10;
  for (const actorId of actorOrder) {
    for (let index = 0; index < eventsPerActor; index += 1) {
      result.push({
        id: `r2-${actorId}-${index + 1}`,
        sessionId: "obligation-memory-session",
        round: 2,
        actorId,
        createdAt: `2026-08-21T00:00:${String(tick++).padStart(2, "0")}.000Z`,
        kind: "argument",
        stance: actorId.toUpperCase(),
        content: `${actorId} newest-round public point ${index + 1}`,
        confidence: .7,
      });
    }
  }
  return result;
}

function countActors(events: readonly CouncilEvent[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const event of events) result.set(event.actorId, (result.get(event.actorId) ?? 0) + 1);
  return result;
}
