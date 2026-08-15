import type { CouncilParticipant, CouncilReport } from "../src/core/types.js";
import type { MeetingExecutionIntegrity } from "../src/theater/meeting-integrity.js";
import type { MeetingMemoryIntegrity } from "../src/theater/meeting-memory-integrity.js";
import { deriveResultIntegrityBundle } from "../src/theater/result-integrity-bundle.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const alpha: CouncilParticipant = { id: "a", name: "Alpha", provider: "alpha" };
const beta: CouncilParticipant = { id: "b", name: "Beta", provider: "beta" };
const report: CouncilReport = {
  sessionId: "bundle-session",
  question: "Which option?",
  mode: "balanced",
  stopReason: "round_budget",
  consensusStance: "A",
  consensusRatio: .83,
  confidence: .8,
  rounds: 4,
  positions: [
    { participant: alpha, stance: "A", content: "A", confidence: .8, caveats: [] },
    { participant: beta, stance: "B", content: "B", confidence: .7, caveats: [] },
  ],
  disagreements: [{ participant: beta, stance: "B", content: "B", confidence: .7, caveats: [] }],
  eventCount: 20,
};

const clean = deriveResultIntegrityBundle(report, execution("verified"), memory("verified"));
assert(clean.stanceAlignment === .83, "Bundle must preserve stance alignment as a descriptive ratio.");
assert(clean.answerCorrectness === "not_scored", "ChatChat must never invent answer correctness from alignment or protocol provenance.");
assert(clean.caveats.includes("minority_survives") && clean.caveats.includes("round_budget_stop"), "Minority and round-budget provenance must survive beside clean protocol integrity.");
assert(!clean.requiresProminentCaveat, "Minority/round-budget context alone should not masquerade as an execution or memory protocol failure.");

const bounded = deriveResultIntegrityBundle(report, execution("verified"), memory("bounded_coverage"));
assert(bounded.caveats.includes("memory_bounded_coverage"), "Known unresolved memory gaps must travel with the result.");
assert(bounded.requiresProminentCaveat, "Bounded unresolved memory coverage should be prominent next to stance alignment.");

const drift = deriveResultIntegrityBundle(report, execution("verified"), memory("selector_drift"));
assert(drift.caveats.includes("memory_selector_drift"), "Selector-to-Prompt integrity drift must not be hidden by successful Provider execution.");
assert(drift.requiresProminentCaveat, "Selector drift must produce a prominent result caveat.");

const unfair = deriveResultIntegrityBundle(report, execution("verified"), memory("peer_fairness_violation"));
assert(unfair.caveats.includes("memory_peer_fairness_violation"), "Different same-round public Prompt decks must be a first-class result caveat.");
assert(unfair.requiresProminentCaveat, "Peer memory fairness violations must be prominent even when every Provider turn published successfully.");

const executionGap = deriveResultIntegrityBundle(report, execution("degraded"), memory("verified"));
assert(executionGap.caveats.includes("execution_degraded") && executionGap.requiresProminentCaveat, "Execution fallback/failure must remain a prominent result limitation.");

const repaired = deriveResultIntegrityBundle(report, execution("verified_after_repair"), memory("verified"));
assert(repaired.caveats.includes("execution_repair_visible"), "Structured repair must remain visible in the result provenance.");
assert(!repaired.requiresProminentCaveat, "A successfully repaired execution chain should stay visibly repaired without being relabeled as an incomplete meeting.");

const legacy = deriveResultIntegrityBundle(report, execution("verified"), {
  ...memory("verified"),
  evidenceStrength: "selector_audit",
});
assert(legacy.caveats.includes("memory_selector_only_archive"), "Old selector-only archives must disclose weaker evidence strength.");
assert(legacy.answerCorrectness === "not_scored", "No historical provenance upgrade may become an invented correctness score.");

console.log("✓ Result Integrity Bundle keeps alignment, execution, memory protocol and correctness separate without a composite score");

function execution(state: MeetingExecutionIntegrity["state"]): MeetingExecutionIntegrity {
  return {
    state,
    totalTurns: 8,
    verifiedTurns: state === "degraded" ? 7 : 8,
    repairedTurns: state === "verified_after_repair" ? 1 : 0,
    fallbackTurns: state === "degraded" ? 1 : 0,
    failedTurns: 0,
    unresolvedTurns: 0,
    totalSeats: 2,
    fullyVerifiedSeats: state === "degraded" ? 1 : 2,
  };
}

function memory(protocolState: MeetingMemoryIntegrity["protocolState"]): MeetingMemoryIntegrity {
  return {
    protocolState,
    evidenceStrength: "actual_prompt",
    contextBudget: 12,
    auditedTurns: 8,
    actualPromptTurns: 8,
    auditedRounds: 4,
    pinnedRounds: 1,
    peerMismatchRounds: protocolState === "peer_fairness_violation" ? 1 : 0,
    selectorMismatchTurns: protocolState === "selector_drift" ? 1 : 0,
    gapTurns: protocolState === "bounded_coverage" ? 2 : 0,
    uniqueGapSourceEventIds: protocolState === "bounded_coverage" ? ["q-old"] : [],
    gapSetMismatchRounds: protocolState === "peer_fairness_violation" ? 1 : 0,
  };
}
