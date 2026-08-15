import type { CouncilReport } from "../core/types.js";
import type { MeetingExecutionIntegrity } from "./meeting-integrity.js";
import type { MeetingMemoryIntegrity } from "./meeting-memory-integrity.js";

export type ResultIntegrityCaveatCode =
  | "execution_repair_visible"
  | "execution_degraded"
  | "execution_incomplete"
  | "memory_bounded_coverage"
  | "memory_selector_drift"
  | "memory_peer_fairness_violation"
  | "memory_evidence_mixed"
  | "memory_selector_only_archive"
  | "minority_survives"
  | "round_budget_stop";

export interface ResultIntegrityBundle {
  stanceAlignment: number;
  answerCorrectness: "not_scored";
  execution: MeetingExecutionIntegrity;
  memory: MeetingMemoryIntegrity;
  caveats: ResultIntegrityCaveatCode[];
  requiresProminentCaveat: boolean;
}

/**
 * Keep result-interpretation facts adjacent without turning them into one
 * synthetic trust score. No arithmetic combines alignment, execution, memory
 * protocol state or answer correctness.
 */
export function deriveResultIntegrityBundle(
  report: CouncilReport,
  execution: MeetingExecutionIntegrity,
  memory: MeetingMemoryIntegrity,
): ResultIntegrityBundle {
  const caveats: ResultIntegrityCaveatCode[] = [];

  if (execution.state === "verified_after_repair") caveats.push("execution_repair_visible");
  if (execution.state === "degraded") caveats.push("execution_degraded");
  if (execution.state === "incomplete" || execution.state === "waiting") caveats.push("execution_incomplete");

  if (memory.protocolState === "bounded_coverage") caveats.push("memory_bounded_coverage");
  if (memory.protocolState === "selector_drift") caveats.push("memory_selector_drift");
  if (memory.protocolState === "peer_fairness_violation") caveats.push("memory_peer_fairness_violation");
  if (memory.evidenceStrength === "mixed") caveats.push("memory_evidence_mixed");
  if (memory.evidenceStrength === "selector_audit") caveats.push("memory_selector_only_archive");

  if (report.disagreements.length > 0) caveats.push("minority_survives");
  if (report.stopReason === "round_budget") caveats.push("round_budget_stop");

  return {
    stanceAlignment: report.consensusRatio,
    answerCorrectness: "not_scored",
    execution,
    memory,
    caveats: [...new Set(caveats)],
    requiresProminentCaveat: caveats.some((code) =>
      code === "execution_degraded"
      || code === "execution_incomplete"
      || code === "memory_bounded_coverage"
      || code === "memory_selector_drift"
      || code === "memory_peer_fairness_violation",
    ),
  };
}
