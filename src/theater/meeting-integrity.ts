import type { ProviderAttendanceAuditModel } from "./provider-attendance.js";

export type MeetingExecutionIntegrityState =
  | "waiting"
  | "verified"
  | "verified_after_repair"
  | "degraded"
  | "incomplete";

export interface MeetingExecutionIntegrity {
  state: MeetingExecutionIntegrityState;
  totalTurns: number;
  verifiedTurns: number;
  repairedTurns: number;
  fallbackTurns: number;
  failedTurns: number;
  unresolvedTurns: number;
  totalSeats: number;
  fullyVerifiedSeats: number;
}

/**
 * Execution integrity is intentionally mechanical. It never grades answer
 * quality or reasoning. It only reports whether Provider turns completed the
 * auditable response -> structured parse -> Blackboard publication chain.
 */
export function deriveMeetingExecutionIntegrity(
  audit: ProviderAttendanceAuditModel,
): MeetingExecutionIntegrity {
  const totalSeats = audit.seats.filter((seat) => seat.turns.length > 0).length;
  const fullyVerifiedSeats = audit.seats.filter((seat) =>
    seat.turns.length > 0 && seat.verifiedTurns === seat.turns.length,
  ).length;
  const unresolvedTurns = Math.max(
    0,
    audit.totalTurns - audit.verifiedTurns - audit.fallbackTurns - audit.failedTurns,
  );

  let state: MeetingExecutionIntegrityState;
  if (!audit.totalTurns) state = "waiting";
  else if (audit.fallbackTurns || audit.failedTurns) state = "degraded";
  else if (unresolvedTurns) state = "incomplete";
  else if (audit.repairedTurns) state = "verified_after_repair";
  else state = "verified";

  return {
    state,
    totalTurns: audit.totalTurns,
    verifiedTurns: audit.verifiedTurns,
    repairedTurns: audit.repairedTurns,
    fallbackTurns: audit.fallbackTurns,
    failedTurns: audit.failedTurns,
    unresolvedTurns,
    totalSeats,
    fullyVerifiedSeats,
  };
}
