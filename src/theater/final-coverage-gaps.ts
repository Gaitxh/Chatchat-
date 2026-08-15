import type { CouncilReport } from "../core/types.js";
import type {
  FinalPositionFloorModel,
  FinalPositionSeat,
} from "./final-position-floor.js";

export type FinalCoverageGapKind =
  | "fallback_final"
  | "failed_final"
  | "incomplete_final"
  | "unverified_final"
  | "unexplained_final_shift";

export type FinalCoverageGapClass = "execution" | "provenance";
export type FinalCoveragePriority = "high" | "medium" | "review";

export interface FinalCoverageGap {
  id: string;
  sessionId: string;
  actorId: string;
  participantName: string;
  providerId: string;
  kind: FinalCoverageGapKind;
  class: FinalCoverageGapClass;
  priority: FinalCoveragePriority;
  finalStance: string;
  finalConfidence: number;
  finalEventId?: string;
  latestPreFinalStance?: string;
  latestPreFinalEventId?: string;
  executionState: FinalPositionSeat["executionState"];
  recordSource: FinalPositionSeat["recordSource"];
  recommendedOperation:
    | "retry_final_against_exact_prompt"
    | "verify_final_execution_provenance"
    | "request_final_shift_explanation";
}

export interface FinalCoveragePlan {
  sessionId: string;
  gaps: FinalCoverageGap[];
  executionGapCount: number;
  provenanceGapCount: number;
  affectedActorIds: string[];
  complete: boolean;
  recoveryChecklist: string[];
}

/**
 * Pure diagnosis of final-seat coverage debt. This never calls Providers and
 * never mutates the completed report/archive.
 */
export function deriveFinalCoveragePlan(
  report: CouncilReport,
  floor: FinalPositionFloorModel,
): FinalCoveragePlan {
  const gaps = floor.seats.flatMap((seat) => gapsForSeat(report, seat));
  const executionGapCount = gaps.filter((gap) => gap.class === "execution").length;
  const provenanceGapCount = gaps.filter((gap) => gap.class === "provenance").length;
  const affectedActorIds = [...new Set(gaps.map((gap) => gap.actorId))];
  return {
    sessionId: report.sessionId,
    gaps,
    executionGapCount,
    provenanceGapCount,
    affectedActorIds,
    complete: gaps.length === 0,
    recoveryChecklist: gaps.map(checklistLine),
  };
}

export function finalCoverageRecoveryBrief(
  report: CouncilReport,
  plan: FinalCoveragePlan,
): string {
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
    "- A Final execution retry is allowed only from the exact original Final Prompt receipt; snapshot IDs alone are insufficient.",
    "- Append recovery provenance in a new recovery record/session; never overwrite the original Final.",
    "- A provenance clarification may explain a Final shift, but it must not retroactively invent a revision inside the original meeting.",
  ];
  if (!plan.gaps.length) {
    lines.push("", "No final-seat coverage gaps are currently derived from the frozen report + execution provenance.");
    return lines.join("\n");
  }
  lines.push("", "Required recovery operations:");
  for (const gap of plan.gaps) lines.push(`- ${gap.participantName} (${gap.providerId}): ${operationText(gap)}`);
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
    return [{ ...base, id: `${report.sessionId}:coverage:${seat.actorId}:fallback`, kind: "fallback_final", class: "execution", priority: "high", recommendedOperation: "retry_final_against_exact_prompt" }];
  }
  if (seat.executionState === "failed") {
    return [{ ...base, id: `${report.sessionId}:coverage:${seat.actorId}:failed`, kind: "failed_final", class: "execution", priority: "high", recommendedOperation: "retry_final_against_exact_prompt" }];
  }
  if (seat.executionState === "incomplete") {
    return [{ ...base, id: `${report.sessionId}:coverage:${seat.actorId}:incomplete`, kind: "incomplete_final", class: "execution", priority: "high", recommendedOperation: "retry_final_against_exact_prompt" }];
  }
  if (seat.recordSource === "unverified_record" || seat.executionState === "unknown") {
    return [{ ...base, id: `${report.sessionId}:coverage:${seat.actorId}:unverified`, kind: "unverified_final", class: "execution", priority: "medium", recommendedOperation: "verify_final_execution_provenance" }];
  }
  if (seat.unexplainedFinalShift) {
    return [{ ...base, id: `${report.sessionId}:coverage:${seat.actorId}:unexplained-shift`, kind: "unexplained_final_shift", class: "provenance", priority: "review", recommendedOperation: "request_final_shift_explanation" }];
  }
  return [];
}

function checklistLine(gap: FinalCoverageGap): string {
  if (gap.recommendedOperation === "retry_final_against_exact_prompt") {
    return `${gap.participantName}: retry only this seat's Final from the exact frozen original Final Prompt receipt; successful seats do not speak again.`;
  }
  if (gap.recommendedOperation === "verify_final_execution_provenance") {
    return `${gap.participantName}: verify/restore Final execution provenance before deciding whether retry is needed.`;
  }
  return `${gap.participantName}: append a provenance clarification for ${gap.latestPreFinalStance ?? "the latest pre-final stance"} → ${gap.finalStance}; do not backfill a revision into the old event graph.`;
}

function operationText(gap: FinalCoverageGap): string {
  if (gap.recommendedOperation === "retry_final_against_exact_prompt") return `targeted Final retry only if the exact original Final Prompt receipt exists (${gap.kind}).`;
  if (gap.recommendedOperation === "verify_final_execution_provenance") return "verify/restore Final execution provenance before calling this a Provider Final or scheduling retry.";
  return `request a later explanation for ${gap.latestPreFinalStance ?? "pre-final"} → ${gap.finalStance} without rewriting the original meeting.`;
}

function compact(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}
