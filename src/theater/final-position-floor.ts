import type {
  CouncilEvent,
  CouncilParticipant,
  CouncilPosition,
  CouncilReport,
} from "../core/types.js";
import type {
  ProviderAttendanceAuditModel,
  ProviderSeatAttendanceAudit,
  ProviderTurnAttendanceAudit,
} from "./provider-attendance.js";

export type FinalSeatExecutionState =
  | "verified"
  | "repaired"
  | "fallback"
  | "failed"
  | "incomplete"
  | "unknown";

export interface FinalPositionRevisionStep {
  eventId: string;
  previousEventId: string;
  round: number;
  fromStance?: string;
  toStance: string;
  causedByEventIds: string[];
}

export interface FinalPositionSeat {
  actorId: string;
  participantName: string;
  providerId: string;
  stance: string;
  stanceKey: string;
  content: string;
  confidence: number;
  caveats: string[];
  finalEventId?: string;
  firstExplicitStance?: string;
  firstExplicitEventId?: string;
  latestPreFinalStance?: string;
  latestPreFinalEventId?: string;
  revisionSteps: FinalPositionRevisionStep[];
  changedExplicitStance: boolean;
  /** Final changed relative to the latest pre-final stance without a matching revision event. */
  unexplainedFinalShift: boolean;
  executionState: FinalSeatExecutionState;
  finalTurnState?: ProviderTurnAttendanceAudit["state"];
  verifiedTurns: number;
  totalTurns: number;
}

export interface FinalPositionGroup {
  id: string;
  stance: string;
  stanceKey: string;
  memberActorIds: string[];
  memberNames: string[];
  count: number;
  share: number;
  averageConfidence: number;
  isLargestGroup: boolean;
  isReportLeadingGroup: boolean;
  degradedMemberCount: number;
}

export interface FinalPositionFloorModel {
  sessionId: string;
  seats: FinalPositionSeat[];
  groups: FinalPositionGroup[];
  participantCount: number;
  largestGroupCount: number;
  largestGroupShare: number;
  reportConsensusStance: string | null;
  reportConsensusRatio: number;
  reportAlignmentMatchesGroups: boolean;
  minorityActorIds: string[];
  unexplainedFinalShiftActorIds: string[];
  degradedActorIds: string[];
}

/**
 * Meeting-wide final position map.
 *
 * This deliberately does NOT reuse thread-local Conflict Stance Fronts. Final
 * seat membership comes only from CouncilReport.positions (the participant's
 * own final submission). Challenge/evidence/support activity cannot move a seat
 * into a final group. Grouping follows the orchestrator's report semantics:
 * trim + case-insensitive comparison only; no embeddings or semantic merging.
 */
export function deriveFinalPositionFloor(
  report: CouncilReport,
  events: readonly CouncilEvent[],
  attendance?: ProviderAttendanceAuditModel | null,
): FinalPositionFloorModel {
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const ordered = new Map(events.map((event, index) => [event.id, index] as const));
  const attendanceByActor = new Map((attendance?.seats ?? []).map((seat) => [seat.actorId, seat] as const));

  const seats = report.positions.map((position) => buildSeat(
    position,
    events,
    eventById,
    ordered,
    attendanceByActor.get(position.participant.id),
  ));

  const grouped = new Map<string, FinalPositionSeat[]>();
  for (const seat of seats) {
    const current = grouped.get(seat.stanceKey) ?? [];
    current.push(seat);
    grouped.set(seat.stanceKey, current);
  }

  const largestGroupCount = Math.max(0, ...[...grouped.values()].map((group) => group.length));
  const participantCount = report.positions.length;
  const largestGroupShare = participantCount ? largestGroupCount / participantCount : 0;
  const reportLeadingKey = report.consensusStance ? normalizeFinalStance(report.consensusStance) : null;

  const groups = [...grouped.entries()].map(([stanceKey, members]) => ({
    id: `${report.sessionId}:final:${safeKey(stanceKey)}`,
    stance: members[0]?.stance ?? stanceKey,
    stanceKey,
    memberActorIds: members.map((seat) => seat.actorId),
    memberNames: members.map((seat) => seat.participantName),
    count: members.length,
    share: participantCount ? members.length / participantCount : 0,
    averageConfidence: members.length
      ? members.reduce((sum, seat) => sum + seat.confidence, 0) / members.length
      : 0,
    isLargestGroup: members.length === largestGroupCount && largestGroupCount > 0,
    isReportLeadingGroup: reportLeadingKey === stanceKey,
    degradedMemberCount: members.filter((seat) => isExecutionDegraded(seat.executionState)).length,
  } satisfies FinalPositionGroup)).sort((a, b) =>
    Number(b.isReportLeadingGroup) - Number(a.isReportLeadingGroup)
      || b.count - a.count
      || a.stance.localeCompare(b.stance),
  );

  const minorityActorIds = seats
    .filter((seat) => reportLeadingKey !== null && seat.stanceKey !== reportLeadingKey)
    .map((seat) => seat.actorId);
  const unexplainedFinalShiftActorIds = seats.filter((seat) => seat.unexplainedFinalShift).map((seat) => seat.actorId);
  const degradedActorIds = seats.filter((seat) => isExecutionDegraded(seat.executionState)).map((seat) => seat.actorId);
  const ratioMatches = Math.abs(report.consensusRatio - largestGroupShare) < 1e-9;
  const leadingMatches = reportLeadingKey === null
    ? groups.length === 0
    : groups.some((group) => group.stanceKey === reportLeadingKey && group.isLargestGroup);

  return {
    sessionId: report.sessionId,
    seats,
    groups,
    participantCount,
    largestGroupCount,
    largestGroupShare,
    reportConsensusStance: report.consensusStance,
    reportConsensusRatio: report.consensusRatio,
    reportAlignmentMatchesGroups: ratioMatches && leadingMatches,
    minorityActorIds,
    unexplainedFinalShiftActorIds,
    degradedActorIds,
  };
}

function buildSeat(
  position: CouncilPosition,
  events: readonly CouncilEvent[],
  eventById: ReadonlyMap<string, CouncilEvent>,
  order: ReadonlyMap<string, number>,
  attendance: ProviderSeatAttendanceAudit | undefined,
): FinalPositionSeat {
  const actorEvents = events
    .filter((event) => event.actorId === position.participant.id)
    .sort((a, b) => a.round - b.round || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const finalEvents = actorEvents.filter((event) => event.kind === "final_position");
  const finalEvent = finalEvents.at(-1);
  const preFinalStanceEvents = actorEvents.filter((event) => event.kind === "argument" || event.kind === "revision");
  const firstExplicit = preFinalStanceEvents[0];
  const latestPreFinal = preFinalStanceEvents.at(-1);
  const revisionSteps = actorEvents
    .filter((event) => event.kind === "revision")
    .map((event) => {
      const previous = eventById.get(event.previousEventId);
      return {
        eventId: event.id,
        previousEventId: event.previousEventId,
        round: event.round,
        ...(previous && hasStance(previous) ? { fromStance: previous.stance } : {}),
        toStance: event.stance,
        causedByEventIds: [...(event.causedBy ?? [])],
      } satisfies FinalPositionRevisionStep;
    });
  const changedExplicitStance = revisionSteps.some((step) =>
    step.fromStance !== undefined && normalizeFinalStance(step.fromStance) !== normalizeFinalStance(step.toStance),
  );
  const unexplainedFinalShift = Boolean(
    latestPreFinal
      && hasStance(latestPreFinal)
      && normalizeFinalStance(latestPreFinal.stance) !== normalizeFinalStance(position.stance),
  );
  const execution = finalExecutionState(attendance);

  return {
    actorId: position.participant.id,
    participantName: position.participant.name,
    providerId: position.participant.provider,
    stance: position.stance,
    stanceKey: normalizeFinalStance(position.stance),
    content: position.content,
    confidence: position.confidence,
    caveats: [...position.caveats],
    ...(finalEvent ? { finalEventId: finalEvent.id } : {}),
    ...(firstExplicit && hasStance(firstExplicit) ? {
      firstExplicitStance: firstExplicit.stance,
      firstExplicitEventId: firstExplicit.id,
    } : {}),
    ...(latestPreFinal && hasStance(latestPreFinal) ? {
      latestPreFinalStance: latestPreFinal.stance,
      latestPreFinalEventId: latestPreFinal.id,
    } : {}),
    revisionSteps,
    changedExplicitStance,
    unexplainedFinalShift,
    executionState: execution.state,
    ...(execution.finalTurn ? { finalTurnState: execution.finalTurn.state } : {}),
    verifiedTurns: attendance?.verifiedTurns ?? 0,
    totalTurns: attendance?.turns.length ?? 0,
  };
}

function finalExecutionState(
  seat: ProviderSeatAttendanceAudit | undefined,
): { state: FinalSeatExecutionState; finalTurn?: ProviderTurnAttendanceAudit } {
  if (!seat) return { state: "unknown" };
  const finalTurn = [...seat.turns].filter((turn) => turn.phase === "final").sort((a, b) => b.round - a.round)[0];
  if (!finalTurn) return { state: seat.turns.length ? "incomplete" : "unknown" };
  if (finalTurn.state === "repaired") return { state: "repaired", finalTurn };
  if (finalTurn.state === "published") return { state: "verified", finalTurn };
  if (finalTurn.state === "fallback") return { state: "fallback", finalTurn };
  if (finalTurn.state === "failed") return { state: "failed", finalTurn };
  return { state: "incomplete", finalTurn };
}

function hasStance(event: CouncilEvent): event is CouncilEvent & { stance: string; confidence: number } {
  return event.kind === "argument" || event.kind === "revision" || event.kind === "final_position";
}

/** Must match the orchestrator report grouping contract. */
export function normalizeFinalStance(stance: string): string {
  return stance.trim().toLocaleLowerCase();
}

function isExecutionDegraded(state: FinalSeatExecutionState): boolean {
  return state === "fallback" || state === "failed" || state === "incomplete";
}

function safeKey(value: string): string {
  const key = value.replace(/[^a-z0-9\u3400-\u9fff]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 48);
  return key || "stance";
}
