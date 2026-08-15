import type { CouncilReport } from "../core/types.js";
import type { FinalPositionFloorModel, FinalPositionSeat } from "./final-position-floor.js";

export type FinalCoverageGapKind = "fallback_final" | "failed_final" | "incomplete_final" | "unverified_final" | "unexplained_final_shift";
export type FinalCoverageGapClass = "execution" | "provenance";

export interface FinalCoverageGap {
  id: string;
  sessionId: string;
  actorId: string;
  participantName: string;
  providerId: string;
  kind: FinalCoverageGapKind;
  class: FinalCoverageGapClass;
  finalStance: string;
  finalConfidence: number;
  finalEventId?: string;
  latestPreFinalStance?: string;
  latestPreFinalEventId?: string;
  executionState: FinalPositionSeat["executionState"];
  recordSource: FinalPositionSeat["recordSource"];
  recommendedOperation: "retry_final_against_exact_prompt" | "verify_final_execution_provenance" | "request_final_shift_explanation";
}

export interface FinalCoveragePlan {
  sessionId: string;
  gaps: FinalCoverageGap[];
  executionGapCount: number;
  provenanceGapCount: number;
  affectedActorIds: string[];
  complete: boolean;
}

export function deriveFinalCoveragePlan(report: CouncilReport, floor: FinalPositionFloorModel): FinalCoveragePlan {
  const gaps = floor.seats.flatMap((seat) => gapsForSeat(report, seat));
  return {
    sessionId: report.sessionId,
    gaps,
    executionGapCount: gaps.filter((gap) => gap.class === "execution").length,
    provenanceGapCount: gaps.filter((gap) => gap.class === "provenance").length,
    affectedActorIds: [...new Set(gaps.map((gap) => gap.actorId))],
    complete: gaps.length === 0,
  };
}

export function finalCoverageRecoveryBrief(report: CouncilReport, plan: FinalCoveragePlan): string {
  const lines = [
    "ChatChat Final Coverage Recovery Plan",
    `Original session: ${report.sessionId}`,
    `Proposal: ${compact(report.question, 360)}`,
    `Execution gaps: ${plan.executionGapCount}`,
    `Provenance gaps: ${plan.provenanceGapCount}`,
    "",
    "Recovery invariants:",
    "- Keep the original completed consultation and archive immutable.",
    "- Do not give successful seats an extra speaking turn because another seat failed.",
    "- A Final retry is allowed only from the exact original Final Prompt receipt; event IDs alone are insufficient.",
    "- Append recovery provenance in a new recovery record/session; never overwrite the original Final.",
    "- A later clarification must never be backfilled as a revision that supposedly happened in the original meeting.",
  ];
  for (const gap of plan.gaps) lines.push(`- ${gap.participantName}: ${operationText(gap)}`);
  if (!plan.gaps.length) lines.push("- No final-seat coverage gaps are currently derived.");
  return lines.join("\n");
}

function gapsForSeat(report: CouncilReport, seat: FinalPositionSeat): FinalCoverageGap[] {
  const base = {
    sessionId: report.sessionId,
    actorId: seat.actorId,
    participantName: seat.participantName,
    providerId: seat.providerId,
    finalStance: seat.stance,
    finalConfidence: seat.confidence,
    ...(seat.finalEventId ? { finalEventId: seat.finalEventId } : {}),
    ...(seat.latestPreFinalStance ? { latestPreFinalStance: seat.latestPreFinalStance } : {}),
    ...(seat.latestPreFinalEventId ? { latestPreFinalEventId: seat.latestPreFinalEventId } : {}),
    executionState: seat.executionState,
    recordSource: seat.recordSource,
  };
  if (seat.recordSource === "fallback_placeholder" || seat.executionState === "fallback") {
    return [{ ...base, id: `${report.sessionId}:${seat.actorId}:fallback`, kind: "fallback_final", class: "execution", recommendedOperation: "retry_final_against_exact_prompt" }];
  }
  if (seat.executionState === "failed") return [{ ...base, id: `${report.sessionId}:${seat.actorId}:failed`, kind: "failed_final", class: "execution", recommendedOperation: "retry_final_against_exact_prompt" }];
  if (seat.executionState === "incomplete") return [{ ...base, id: `${report.sessionId}:${seat.actorId}:incomplete`, kind: "incomplete_final", class: "execution", recommendedOperation: "retry_final_against_exact_prompt" }];
  if (seat.recordSource === "unverified_record" || seat.executionState === "unknown") {
    return [{ ...base, id: `${report.sessionId}:${seat.actorId}:unverified`, kind: "unverified_final", class: "execution", recommendedOperation: "verify_final_execution_provenance" }];
  }
  if (seat.unexplainedFinalShift) {
    return [{ ...base, id: `${report.sessionId}:${seat.actorId}:shift`, kind: "unexplained_final_shift", class: "provenance", recommendedOperation: "request_final_shift_explanation" }];
  }
  return [];
}

function operationText(gap: FinalCoverageGap): string {
  if (gap.recommendedOperation === "retry_final_against_exact_prompt") return "retry this seat only if an exact frozen original Final Prompt receipt is available; successful seats do not speak again.";
  if (gap.recommendedOperation === "verify_final_execution_provenance") return "verify/restore Final execution provenance before deciding whether retry is necessary.";
  return `append a later clarification for ${gap.latestPreFinalStance ?? "pre-final"} → ${gap.finalStance}; do not rewrite the old event graph.`;
}

function compact(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}
