import type { ProviderMemoryCoverageModel } from "../src/theater/provider-memory-coverage.js";
import type { ProviderMemoryGapModel } from "../src/theater/provider-memory-gaps.js";
import { deriveMeetingMemoryIntegrity } from "../src/theater/meeting-memory-integrity.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const cleanCoverage = coverage({});
const cleanGaps = gaps({});
const clean = deriveMeetingMemoryIntegrity(cleanCoverage, cleanGaps);
assert(clean.protocolState === "verified", "Fully shared actual Prompt memory with no known gaps should be memory-protocol verified.");
assert(clean.evidenceStrength === "actual_prompt", "All audited turns backed by Prompt metadata should expose actual_prompt evidence strength.");

const bounded = deriveMeetingMemoryIntegrity(
  cleanCoverage,
  gaps({ gapTurnCount: 2, uniqueGapSourceEventIds: ["q-old"], rounds: [gapRound(true)] }),
);
assert(bounded.protocolState === "bounded_coverage", "Known unresolved sources omitted by the hard cap should be a bounded coverage limitation, not a fairness violation.");
assert(bounded.uniqueGapSourceEventIds[0] === "q-old", "Bounded coverage must preserve exact source event provenance.");

const selectorDrift = deriveMeetingMemoryIntegrity(
  coverage({ selectorMismatchTurnCount: 1, allPromptSelectorConsistent: false }),
  cleanGaps,
);
assert(selectorDrift.protocolState === "selector_drift", "Selector-to-Prompt disagreement must be distinct from Provider peer unfairness.");
assert(selectorDrift.peerMismatchRounds === 0, "Selector drift alone must not fabricate a peer fairness violation.");

const unfair = deriveMeetingMemoryIntegrity(
  coverage({
    allSharedSnapshotsConsistent: false,
    rounds: [round(false)],
    selectorMismatchTurnCount: 1,
    allPromptSelectorConsistent: false,
  }),
  gaps({ allGapSetsFairWithinRound: false, rounds: [gapRound(false)] }),
);
assert(unfair.protocolState === "peer_fairness_violation", "Different same-round actual public memory decks must take precedence as a peer fairness violation.");
assert(unfair.peerMismatchRounds === 1 && unfair.gapSetMismatchRounds === 1, "Memory fairness violation must preserve both observed mismatch dimensions.");

const legacy = deriveMeetingMemoryIntegrity(
  coverage({ actualPromptTurnCount: 0 }),
  cleanGaps,
);
assert(legacy.protocolState === "verified", "Selector-only historical evidence can still show no observed protocol violation without being upgraded to Prompt proof.");
assert(legacy.evidenceStrength === "selector_audit", "Old archives without Prompt metadata must disclose selector_audit evidence strength.");

const mixed = deriveMeetingMemoryIntegrity(
  coverage({ actualPromptTurnCount: 1 }),
  cleanGaps,
);
assert(mixed.evidenceStrength === "mixed", "Partially upgraded histories must expose mixed evidence strength rather than pretending all turns have Prompt proof.");

console.log("✓ Meeting Memory Integrity separates bounded coverage, selector drift, peer fairness and evidence strength without a composite score");

function coverage(overrides: Partial<ProviderMemoryCoverageModel>): ProviderMemoryCoverageModel {
  return {
    sessionId: "memory-integrity-session",
    contextBudget: 12,
    rounds: overrides.rounds ?? [round(true), { ...round(true), key: "final|4", phase: "final", round: 4 }],
    turns: [turn("a", 3), turn("b", 3)],
    roundsWithPinnedMemory: 1,
    pinnedIssueSourceEventIds: ["q-old"],
    actualPromptTurnCount: 2,
    selectorMismatchTurnCount: 0,
    allSharedSnapshotsConsistent: true,
    allPromptSelectorConsistent: true,
    ...overrides,
  };
}

function gaps(overrides: Partial<ProviderMemoryGapModel>): ProviderMemoryGapModel {
  return {
    sessionId: "memory-integrity-session",
    gaps: [],
    rounds: [],
    gapTurnCount: 0,
    uniqueGapSourceEventIds: [],
    actualPromptGapCount: 0,
    allGapSetsFairWithinRound: true,
    ...overrides,
  };
}

function turn(actorId: string, roundNumber: number): ProviderMemoryCoverageModel["turns"][number] {
  return {
    key: `memory-integrity-session|${actorId}|debate|${roundNumber}`,
    sessionId: "memory-integrity-session",
    actorId,
    actorName: actorId === "a" ? "Alpha" : "Beta",
    providerId: actorId,
    phase: "debate",
    round: roundNumber,
    contextBudget: 12,
    selectionEvidence: "actual_prompt",
    selectorMatchesActualPrompt: true,
    availableEventIds: [],
    snapshotEventIds: [],
    latestRoundEventIds: [],
    pinnedEventIds: [],
    pinnedIssueSourceEventIds: [],
    ordinaryRecentEventIds: [],
    omittedEventIds: [],
    pinnedIssues: [],
    transportAttempted: true,
    transportReceived: true,
  };
}

function round(shared: boolean): ProviderMemoryCoverageModel["rounds"][number] {
  return {
    key: "debate|3",
    phase: "debate",
    round: 3,
    turns: [turn("a", 3), turn("b", 3)],
    seatCount: 2,
    attemptedSeatCount: 2,
    receivedSeatCount: 2,
    actualPromptSeatCount: 2,
    selectorMismatchSeatCount: 0,
    snapshotsConsistent: shared,
    selectionFingerprints: shared ? ["same"] : ["a", "b"],
    snapshotEventIds: [],
    latestRoundEventIds: [],
    pinnedEventIds: [],
    pinnedIssueSourceEventIds: [],
    ordinaryRecentEventIds: [],
    omittedEventIds: [],
    pinnedIssues: [],
    availableCount: 0,
    snapshotCount: 0,
    contextBudget: 12,
  };
}

function gapRound(fair: boolean): ProviderMemoryGapModel["rounds"][number] {
  return {
    key: "debate|3",
    phase: "debate",
    round: 3,
    seatCount: 2,
    turnsWithGaps: 2,
    uniqueGapSourceEventIds: ["q-old"],
    gapCount: 2,
    allSeatsSameGapSet: fair,
  };
}
