import type { CouncilParticipant, CouncilReport } from "../src/core/types.js";
import { deriveFinalCoveragePlan, finalCoverageRecoveryBrief } from "../src/theater/final-coverage-gaps.js";
import type { FinalPositionFloorModel, FinalPositionSeat } from "../src/theater/final-position-floor.js";

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`Assertion failed: ${message}`); }
const participants: CouncilParticipant[] = [
  { id: "gpt", name: "ChatGPT", provider: "openai" },
  { id: "claude", name: "Claude", provider: "anthropic" },
  { id: "gemini", name: "Gemini", provider: "google" },
  { id: "deepseek", name: "DeepSeek", provider: "deepseek" },
  { id: "grok", name: "Grok", provider: "xai" },
];
const report: CouncilReport = {
  sessionId: "coverage-core", question: "Which option?", mode: "balanced", stopReason: "round_budget", consensusStance: "Hybrid", consensusRatio: .6, confidence: .8, rounds: 4,
  positions: participants.map((participant) => ({ participant, stance: "Hybrid", content: "Final", confidence: .7, caveats: [] })), disagreements: [], eventCount: 10,
};
const seats: FinalPositionSeat[] = [
  seat("gpt", "ChatGPT", "openai", "verified", "provider_final"),
  { ...seat("claude", "Claude", "anthropic", "repaired", "provider_final"), latestPreFinalStance: "Web UI", latestPreFinalEventId: "c1", unexplainedFinalShift: true },
  seat("gemini", "Gemini", "google", "fallback", "fallback_placeholder"),
  seat("deepseek", "DeepSeek", "deepseek", "failed", "unverified_record"),
  seat("grok", "Grok", "xai", "unknown", "unverified_record"),
];
const floor: FinalPositionFloorModel = {
  sessionId: report.sessionId, seats, groups: [], participantCount: 5, largestGroupCount: 3, largestGroupShare: .6,
  reportConsensusStance: "Hybrid", reportConsensusRatio: .6, reportAlignmentMatchesGroups: true, minorityActorIds: [],
  unexplainedFinalShiftActorIds: ["claude"], degradedActorIds: ["gemini", "deepseek"], fallbackActorIds: ["gemini"],
};
const plan = deriveFinalCoveragePlan(report, floor);
assert(plan.executionGapCount === 3, "fallback/failed/unverified should be execution coverage debt");
assert(plan.provenanceGapCount === 1, "verified unexplained Final shift should be separate provenance debt");
assert(!plan.affectedActorIds.includes("gpt"), "successful stable seat must not enter recovery");
assert(plan.gaps.find((gap) => gap.actorId === "gemini")?.recommendedOperation === "retry_final_against_exact_prompt", "fallback needs exact-prompt targeted retry");
assert(plan.gaps.find((gap) => gap.actorId === "grok")?.recommendedOperation === "verify_final_execution_provenance", "unknown Final should verify provenance before retry");
assert(plan.gaps.find((gap) => gap.actorId === "claude")?.recommendedOperation === "request_final_shift_explanation", "verified no-revision shift is clarification debt");
const brief = finalCoverageRecoveryBrief(report, plan);
for (const text of ["original completed consultation and archive immutable", "successful seats an extra speaking turn", "exact original Final Prompt receipt", "event IDs alone are insufficient", "never overwrite the original Final", "never be backfilled as a revision"]) {
  assert(brief.toLowerCase().includes(text.toLowerCase()), `Recovery brief must preserve invariant: ${text}`);
}
console.log("✓ Final coverage debt remains immutable, seat-targeted, and split between execution vs provenance gaps");

function seat(actorId: string, participantName: string, providerId: string, executionState: FinalPositionSeat["executionState"], recordSource: FinalPositionSeat["recordSource"]): FinalPositionSeat {
  return { actorId, participantName, providerId, stance: "Hybrid", stanceKey: "hybrid", content: "Final", confidence: .7, caveats: [], revisionSteps: [], changedExplicitStance: false, unexplainedFinalShift: false, executionState, recordSource, verifiedTurns: executionState === "verified" || executionState === "repaired" ? 4 : 3, totalTurns: 4 };
}
