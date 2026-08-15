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
  /**
   * The next protocol operation ChatChat would need in order to close the gap.
   * This is a plan, not an automatic action.
   */
  recommendedOperation:
    | "retry_final_against_frozen_snapshot"
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
  /** Human-readable local plan. It never performs Provider calls. */
  recoveryChecklist: string[];
}

/**
 * Derive what is missing from the meeting's final-seat coverage.
 *
 * This never changes CouncilReport, never rewrites an archive, and never calls
 * a Provider. A successful/repaired Final with no revision receipt is a
 * provenance gap, while fallback/failed/incomplete/unverified Finals are
 * execution gaps. Those two classes must not be collapsed into one another.
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
    recoveryChecklist: gaps.map((gap) => checklistLine(gap)),
  };
}

/**
 * Creates a bounded, local recovery brief for a future targeted recovery
 * protocol. It intentionally says NOT to re-run successful seats or mutate the
 * original archive. The current implementation only prepares/copies this plan.
 */
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
    "- Do not give successful seats an extra speaking turn merely because another seat failed.",
    "- Any execution retry must use the exact frozen final public snapshot that the failed seat should have received.",
    "- Append recovery provenance in a new recovery record/session; never silently overwrite the original Final.",
    "- A provenance clarification may explain a Final shift, but it must not retroactively invent a revision inside the original meeting.",
  ];

  if (!plan.gaps.length) {
    lines.push("", "No final-seat coverage gaps are currently derived from the frozen report + execution provenance.");
    return lines.join("\n");
  }

  lines.push("", "Required recovery operations:");
  for (const gap of plan.gaps) {
    lines.push(`- ${gap.participantName} (${gap.providerId}): ${operationText(gap)}`);
  }
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
    return [{
      ...base,
      id: `${report.sessionId}:coverage:${seat.actorId}:fallback`,
      kind: "fallback_final",
      class: "execution",
      priority: "high",
      recommendedOperation: "retry_final_against_frozen_snapshot",
    }];
  }
  if (seat.executionState === "failed") {
    return [{
      ...base,
      id: `${report.sessionId}:coverage:${seat.actorId}:failed`,
      kind: "failed_final",
      class: "execution",
      priority: "high",
      recommendedOperation: "retry_final_against_frozen_snapshot",
    }];
  }
  if (seat.executionState === "incomplete") {
    return [{
      ...base,
      id: `${report.sessionId}:coverage:${seat.actorId}:incomplete`,
      kind: "incomplete_final",
      class: "execution",
      priority: "high",
      recommendedOperation: "retry_final_against_frozen_snapshot",
    }];
  }
  if (seat.recordSource === "unverified_record" || seat.executionState === "unknown") {
    return [{
      ...base,
      id: `${report.sessionId}:coverage:${seat.actorId}:unverified`,
      kind: "unverified_final",
      class: "execution",
      priority: "medium",
      recommendedOperation: "verify_final_execution_provenance",
    }];
  }
  if (seat.unexplainedFinalShift) {
    return [{
      ...base,
      id: `${report.sessionId}:coverage:${seat.actorId}:unexplained-shift`,
      kind: "unexplained_final_shift",
      class: "provenance",
      priority: "review",
      recommendedOperation: "request_final_shift_explanation",
    }];
  }
  return [];
}

function checklistLine(gap: FinalCoverageGap): string {
  if (gap.recommendedOperation === "retry_final_against_frozen_snapshot") {
    return `${gap.participantName}: retry only this seat's Final against the original frozen final public snapshot; append recovery provenance instead of rewriting session ${gap.sessionId}.`;
  }
  if (gap.recommendedOperation === "verify_final_execution_provenance") {
    return `${gap.participantName}: verify whether the recorded Final actually completed at the Provider before treating it as provider_final.`;
  }
  return `${gap.participantName}: ask for a provenance clarification for ${gap.latestPreFinalStance ?? "the latest pre-final stance"} → ${gap.finalStance}; do not retroactively fabricate a revision event.`;
}

function operationText(gap: FinalCoverageGap): string {
  if (gap.recommendedOperation === "retry_final_against_frozen_snapshot") {
    return `targeted Final retry against the frozen original final snapshot (${gap.kind}).`;
  }
  if (gap.recommendedOperation === "verify_final_execution_provenance") {
    return "verify/restore Final execution provenance before calling this a Provider Final.";
  }
  return `request an explanation for ${gap.latestPreFinalStance ?? "pre-final"} → ${gap.finalStance} without rewriting the original event graph.`;
}

function compact(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}
