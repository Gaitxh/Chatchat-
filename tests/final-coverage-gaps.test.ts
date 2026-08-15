import type { CouncilParticipant, CouncilReport } from "../src/core/types.js";
import {
  deriveFinalCoveragePlan,
  finalCoverageRecoveryBrief,
} from "../src/theater/final-coverage-gaps.js";
import type {
  FinalPositionFloorModel,
  FinalPositionSeat,
} from "../src/theater/final-position-floor.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "gpt", name: "ChatGPT", provider: "openai" },
  { id: "claude", name: "Claude", provider: "anthropic" },
  { id: "gemini", name: "Gemini", provider: "google" },
  { id: "deepseek", name: "DeepSeek", provider: "deepseek" },
  { id: "grok", name: "Grok", provider: "xai" },
  { id: "yuanbao", name: "Yuanbao", provider: "tencent" },
];
const report: CouncilReport = {
  sessionId: "coverage-session",
  question: "Which implementation path should we choose?",
  mode: "balanced",
  stopReason: "round_budget",
  consensusStance: "Hybrid",
  consensusRatio: 4 / 6,
  confidence: .81,
  rounds: 4,
  positions: participants.map((participant, index) => ({
    participant,
    stance: index < 4 ? "Hybrid" : "Extension",
    content: `Final ${participant.name}`,
    confidence: .7,
    caveats: [],
  })),
  disagreements: [],
  eventCount: 18,
};

const seats: FinalPositionSeat[] = [
  seat("gpt", "ChatGPT", "openai", "verified", "provider_final"),
  {
    ...seat("claude", "Claude", "anthropic", "repaired", "provider_final"),
    latestPreFinalStance: "Web UI",
    latestPreFinalEventId: "c-rev",
    stance: "Hybrid",
    stanceKey: "hybrid",
    unexplainedFinalShift: true,
  },
  seat("gemini", "Gemini", "google", "fallback", "fallback_placeholder"),
  seat("deepseek", "DeepSeek", "deepseek", "failed", "unverified_record"),
  seat("grok", "Grok", "xai", "incomplete", "unverified_record"),
  seat("yuanbao", "Yuanbao", "tencent", "unknown", "unverified_record"),
];

const floor: FinalPositionFloorModel = {
  sessionId: report.sessionId,
  seats,
  groups: [],
  participantCount: seats.length,
  largestGroupCount: 4,
  largestGroupShare: 4 / 6,
  reportConsensusStance: "Hybrid",
  reportConsensusRatio: 4 / 6,
  reportAlignmentMatchesGroups: true,
  minorityActorIds: ["grok", "yuanbao"],
  unexplainedFinalShiftActorIds: ["claude"],
  degradedActorIds: ["gemini", "deepseek", "grok"],
  fallbackActorIds: ["gemini"],
};

const plan = deriveFinalCoveragePlan(report, floor);
assert(!plan.complete, "Coverage plan should remain incomplete while Final execution/provenance gaps exist");
assert(plan.executionGapCount === 4, "Fallback, failed, incomplete, and unverified Finals should be execution gaps");
assert(plan.provenanceGapCount === 1, "A verified/repaired Final shift without revision should be a separate provenance gap");
assert(!plan.affectedActorIds.includes("gpt"), "A fully verified stable seat must not be dragged into recovery");

const gemini = plan.gaps.find((gap) => gap.actorId === "gemini");
assert(gemini?.kind === "fallback_final" && gemini.recommendedOperation === "retry_final_against_frozen_snapshot", "Fallback Final should require a targeted retry against the frozen snapshot");
const deepseek = plan.gaps.find((gap) => gap.actorId === "deepseek");
assert(deepseek?.kind === "failed_final" && deepseek.priority === "high", "Failed Final should be a high-priority execution gap");
const grok = plan.gaps.find((gap) => gap.actorId === "grok");
assert(grok?.kind === "incomplete_final", "Incomplete Final execution should remain distinct from a hard failure");
const yuanbao = plan.gaps.find((gap) => gap.actorId === "yuanbao");
assert(yuanbao?.kind === "unverified_final" && yuanbao.recommendedOperation === "verify_final_execution_provenance", "Unknown/unverified Final should request provenance verification rather than a fictional rerun");
const claude = plan.gaps.find((gap) => gap.actorId === "claude");
assert(claude?.kind === "unexplained_final_shift" && claude.class === "provenance", "Successful Final shift without revision must remain a provenance gap, not an execution failure");
assert(claude.recommendedOperation === "request_final_shift_explanation", "Unexplained Final shift should request clarification without rewriting the old event graph");

const brief = finalCoverageRecoveryBrief(report, plan);
for (const invariant of [
  "Keep the original completed consultation and archive immutable.",
  "Do not give successful seats an extra speaking turn",
  "exact frozen final public snapshot",
  "Append recovery provenance in a new recovery record/session",
  "must not retroactively invent a revision",
]) {
  assert(brief.includes(invariant), `Recovery brief must preserve invariant: ${invariant}`);
}
assert(brief.includes("Gemini") && brief.includes("Claude"), "Recovery brief should identify the exact affected seats");
assert(!brief.includes("ChatGPT (openai):"), "Recovery brief must not schedule successful seats for recovery");

const completeFloor: FinalPositionFloorModel = {
  ...floor,
  seats: seats.map((item) => ({
    ...item,
    executionState: "verified",
    recordSource: "provider_final",
    unexplainedFinalShift: false,
  })),
  unexplainedFinalShiftActorIds: [],
  degradedActorIds: [],
  fallbackActorIds: [],
};
const complete = deriveFinalCoveragePlan(report, completeFloor);
assert(complete.complete && complete.gaps.length === 0, "A fully verified floor with no unexplained Final shifts should have no recovery debt");
assert(finalCoverageRecoveryBrief(report, complete).includes("No final-seat coverage gaps"), "Complete meetings should produce an explicit no-gap recovery brief");

console.log("✓ ChatChat Final Coverage Gap tests passed");
console.log("✓ Recovery planning never re-runs successful seats or mutates the original meeting");
console.log("✓ Execution gaps and provenance-clarification gaps remain separate");

function seat(
  actorId: string,
  participantName: string,
  providerId: string,
  executionState: FinalPositionSeat["executionState"],
  recordSource: FinalPositionSeat["recordSource"],
): FinalPositionSeat {
  return {
    actorId,
    participantName,
    providerId,
    stance: "Hybrid",
    stanceKey: "hybrid",
    content: `Final ${participantName}`,
    confidence: .7,
    caveats: [],
    revisionSteps: [],
    changedExplicitStance: false,
    unexplainedFinalShift: false,
    executionState,
    recordSource,
    verifiedTurns: executionState === "verified" || executionState === "repaired" ? 4 : 3,
    totalTurns: 4,
  };
}
