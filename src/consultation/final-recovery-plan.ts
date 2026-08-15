import type {
  CouncilEvent,
  CouncilParticipant,
  CouncilReport,
} from "../core/types.js";
import type {
  FinalCoverageGap,
  FinalCoveragePlan,
} from "../theater/final-coverage-gaps.js";
import type {
  ProviderAttendanceAuditModel,
  ProviderTurnAttendanceAudit,
} from "../theater/provider-attendance.js";

export type FinalRecoveryPacketState =
  | "ready"
  | "clarification_only"
  | "blocked_no_final_turn"
  | "blocked_no_snapshot"
  | "blocked_missing_snapshot_events";

export interface FinalRecoveryPacket {
  originalSessionId: string;
  actorId: string;
  participantName: string;
  providerId: string;
  participant?: CouncilParticipant;
  gapId: string;
  gapKind: FinalCoverageGap["kind"];
  operation: FinalCoverageGap["recommendedOperation"];
  state: FinalRecoveryPacketState;
  originalFinalRound: number;
  finalTurnKey?: string;
  snapshotEventIds: string[];
  snapshotEvents: CouncilEvent[];
  missingSnapshotEventIds: string[];
  finalEventId?: string;
  latestPreFinalEventId?: string;
  /**
   * Recovery must append provenance in a new record/session. Never mutate the
   * original report/archive or give successful seats an extra turn.
   */
  immutableOriginal: true;
}

export interface FinalRecoveryPacketSet {
  originalSessionId: string;
  packets: FinalRecoveryPacket[];
  readyRetryCount: number;
  clarificationCount: number;
  blockedCount: number;
}

/**
 * Reconstruct the exact public snapshot for each Final recovery candidate from
 * the frozen attendance receipt. We do not approximate the original Final
 * context by “all non-final events”; we use the snapshot IDs captured from the
 * actual prompt path. If any ID is unavailable, retry is blocked.
 */
export function deriveFinalRecoveryPackets(
  report: CouncilReport,
  events: readonly CouncilEvent[],
  coverage: FinalCoveragePlan,
  attendance: ProviderAttendanceAuditModel | null | undefined,
): FinalRecoveryPacketSet {
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const participantById = new Map(report.positions.map((position) => [position.participant.id, position.participant] as const));
  const attendanceByActor = new Map((attendance?.seats ?? []).map((seat) => [seat.actorId, seat] as const));

  const packets = coverage.gaps.map((gap) => {
    const participant = participantById.get(gap.actorId);
    if (gap.class === "provenance") {
      return {
        originalSessionId: report.sessionId,
        actorId: gap.actorId,
        participantName: gap.participantName,
        providerId: gap.providerId,
        ...(participant ? { participant: { ...participant } } : {}),
        gapId: gap.id,
        gapKind: gap.kind,
        operation: gap.recommendedOperation,
        state: "clarification_only",
        originalFinalRound: report.rounds,
        snapshotEventIds: [],
        snapshotEvents: [],
        missingSnapshotEventIds: [],
        ...(gap.finalEventId ? { finalEventId: gap.finalEventId } : {}),
        ...(gap.latestPreFinalEventId ? { latestPreFinalEventId: gap.latestPreFinalEventId } : {}),
        immutableOriginal: true,
      } satisfies FinalRecoveryPacket;
    }

    const seatAudit = attendanceByActor.get(gap.actorId);
    const finalTurn = latestFinalTurn(seatAudit?.turns ?? []);
    if (!finalTurn) return blockedPacket(report, gap, participant, "blocked_no_final_turn");
    if (!finalTurn.snapshotEventIds.length) {
      return blockedPacket(report, gap, participant, "blocked_no_snapshot", finalTurn);
    }

    const missingSnapshotEventIds = finalTurn.snapshotEventIds.filter((id) => !eventById.has(id));
    const snapshotEvents = finalTurn.snapshotEventIds
      .map((id) => eventById.get(id))
      .filter((event): event is CouncilEvent => Boolean(event))
      .map(cloneEvent);
    const state: FinalRecoveryPacketState = missingSnapshotEventIds.length
      ? "blocked_missing_snapshot_events"
      : "ready";

    return {
      originalSessionId: report.sessionId,
      actorId: gap.actorId,
      participantName: gap.participantName,
      providerId: gap.providerId,
      ...(participant ? { participant: { ...participant } } : {}),
      gapId: gap.id,
      gapKind: gap.kind,
      operation: gap.recommendedOperation,
      state,
      originalFinalRound: report.rounds,
      finalTurnKey: finalTurn.key,
      snapshotEventIds: [...finalTurn.snapshotEventIds],
      snapshotEvents,
      missingSnapshotEventIds,
      ...(gap.finalEventId ? { finalEventId: gap.finalEventId } : {}),
      ...(gap.latestPreFinalEventId ? { latestPreFinalEventId: gap.latestPreFinalEventId } : {}),
      immutableOriginal: true,
    } satisfies FinalRecoveryPacket;
  });

  return {
    originalSessionId: report.sessionId,
    packets,
    readyRetryCount: packets.filter((packet) => packet.state === "ready").length,
    clarificationCount: packets.filter((packet) => packet.state === "clarification_only").length,
    blockedCount: packets.filter((packet) => packet.state.startsWith("blocked_")).length,
  };
}

export function finalRecoveryPacketText(packet: FinalRecoveryPacket): string {
  const lines = [
    "ChatChat Targeted Final Recovery Packet",
    `Original session: ${packet.originalSessionId}`,
    `Seat: ${packet.participantName} (${packet.providerId})`,
    `Gap: ${packet.gapKind}`,
    `Operation: ${packet.operation}`,
    `Packet state: ${packet.state}`,
    `Original Final round: ${packet.originalFinalRound}`,
    "Original meeting immutable: YES",
  ];
  if (packet.state === "ready") {
    lines.push(
      `Frozen public snapshot event IDs (${packet.snapshotEventIds.length}): ${packet.snapshotEventIds.join(", ")}`,
      "Retry scope: this seat only. Successful seats receive no extra speaking turn.",
      "Write result into a new recovery provenance record/session; never overwrite the original Final.",
    );
  } else if (packet.state === "clarification_only") {
    lines.push(
      "This is not an execution retry. Ask for a later provenance clarification only.",
      "Do not retroactively insert a revision event into the original meeting.",
    );
  } else {
    lines.push(
      `BLOCKED: exact frozen Final snapshot cannot currently be reconstructed (${packet.state}).`,
      ...(packet.missingSnapshotEventIds.length
        ? [`Missing event IDs: ${packet.missingSnapshotEventIds.join(", ")}`]
        : []),
      "Do not run an approximate retry and call it equivalent to the original Final turn.",
    );
  }
  return lines.join("\n");
}

function latestFinalTurn(turns: readonly ProviderTurnAttendanceAudit[]): ProviderTurnAttendanceAudit | undefined {
  return [...turns]
    .filter((turn) => turn.phase === "final")
    .sort((a, b) => b.round - a.round)[0];
}

function blockedPacket(
  report: CouncilReport,
  gap: FinalCoverageGap,
  participant: CouncilParticipant | undefined,
  state: "blocked_no_final_turn" | "blocked_no_snapshot",
  finalTurn?: ProviderTurnAttendanceAudit,
): FinalRecoveryPacket {
  return {
    originalSessionId: report.sessionId,
    actorId: gap.actorId,
    participantName: gap.participantName,
    providerId: gap.providerId,
    ...(participant ? { participant: { ...participant } } : {}),
    gapId: gap.id,
    gapKind: gap.kind,
    operation: gap.recommendedOperation,
    state,
    originalFinalRound: report.rounds,
    ...(finalTurn ? { finalTurnKey: finalTurn.key } : {}),
    snapshotEventIds: finalTurn ? [...finalTurn.snapshotEventIds] : [],
    snapshotEvents: [],
    missingSnapshotEventIds: [],
    ...(gap.finalEventId ? { finalEventId: gap.finalEventId } : {}),
    ...(gap.latestPreFinalEventId ? { latestPreFinalEventId: gap.latestPreFinalEventId } : {}),
    immutableOriginal: true,
  };
}

function cloneEvent(event: CouncilEvent): CouncilEvent {
  if (event.kind === "revision") return { ...event, ...(event.causedBy ? { causedBy: [...event.causedBy] } : {}) };
  if (event.kind === "final_position") return { ...event, ...(event.caveats ? { caveats: [...event.caveats] } : {}) };
  return { ...event };
}
