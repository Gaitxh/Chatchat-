import type { CouncilEvent, CouncilParticipant, CouncilReport } from "../core/types.js";
import { validateFinalPromptReceipt, type FinalPromptReceipt } from "./final-prompt-receipt.js";
import type { FinalCoverageGap, FinalCoveragePlan } from "../theater/final-coverage-gaps.js";
import type { ProviderAttendanceAuditModel, ProviderTurnAttendanceAudit } from "../theater/provider-attendance.js";

export type FinalRecoveryPacketState =
  | "ready_exact_prompt"
  | "verification_only"
  | "clarification_only"
  | "blocked_no_final_turn"
  | "blocked_no_exact_final_prompt"
  | "blocked_invalid_prompt_receipt"
  | "blocked_snapshot_receipt_mismatch"
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
  exactFinalPrompt?: string;
  promptFingerprint?: string;
  promptChars?: number;
  snapshotEventIds: string[];
  snapshotEvents: CouncilEvent[];
  missingSnapshotEventIds: string[];
  receiptValidationIssues: string[];
  finalEventId?: string;
  latestPreFinalEventId?: string;
  immutableOriginal: true;
}

export interface FinalRecoveryPacketSet {
  originalSessionId: string;
  packets: FinalRecoveryPacket[];
  readyRetryCount: number;
  verificationCount: number;
  clarificationCount: number;
  blockedCount: number;
}

export function deriveFinalRecoveryPackets(
  report: CouncilReport,
  events: readonly CouncilEvent[],
  coverage: FinalCoveragePlan,
  attendance: ProviderAttendanceAuditModel | null | undefined,
  finalPromptReceipts: readonly FinalPromptReceipt[],
): FinalRecoveryPacketSet {
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const participantById = new Map(report.positions.map((position) => [position.participant.id, position.participant] as const));
  const attendanceByActor = new Map((attendance?.seats ?? []).map((seat) => [seat.actorId, seat] as const));
  const promptByActor = new Map(finalPromptReceipts.filter((receipt) => receipt.sessionId === report.sessionId).map((receipt) => [receipt.actorId, receipt] as const));

  const packets = coverage.gaps.map((gap) => {
    const participant = participantById.get(gap.actorId);
    if (gap.recommendedOperation === "request_final_shift_explanation") return nonRetryPacket(report, gap, participant, "clarification_only");
    if (gap.recommendedOperation === "verify_final_execution_provenance") return nonRetryPacket(report, gap, participant, "verification_only");

    const finalTurn = latestFinalTurn(attendanceByActor.get(gap.actorId)?.turns ?? []);
    if (!finalTurn) return blockedPacket(report, gap, participant, "blocked_no_final_turn");

    const promptReceipt = promptByActor.get(gap.actorId);
    if (!promptReceipt) return blockedPacket(report, gap, participant, "blocked_no_exact_final_prompt", finalTurn);

    const validation = validateFinalPromptReceipt(promptReceipt);
    if (!validation.valid) return blockedPacket(report, gap, participant, "blocked_invalid_prompt_receipt", finalTurn, promptReceipt, validation.issues);
    if (!sameStrings(promptReceipt.snapshotEventIds, finalTurn.snapshotEventIds)) {
      return blockedPacket(report, gap, participant, "blocked_snapshot_receipt_mismatch", finalTurn, promptReceipt, ["prompt_snapshot_does_not_match_attendance_receipt"]);
    }

    const missingSnapshotEventIds = promptReceipt.snapshotEventIds.filter((id) => !eventById.has(id));
    const snapshotEvents = promptReceipt.snapshotEventIds.map((id) => eventById.get(id)).filter((event): event is CouncilEvent => Boolean(event)).map(cloneEvent);
    if (missingSnapshotEventIds.length) {
      return {
        ...basePacket(report, gap, participant),
        state: "blocked_missing_snapshot_events",
        finalTurnKey: finalTurn.key,
        exactFinalPrompt: promptReceipt.promptText,
        promptFingerprint: promptReceipt.promptFingerprint,
        promptChars: promptReceipt.promptChars,
        snapshotEventIds: [...promptReceipt.snapshotEventIds],
        snapshotEvents,
        missingSnapshotEventIds,
        receiptValidationIssues: [],
      };
    }

    return {
      ...basePacket(report, gap, participant),
      state: "ready_exact_prompt",
      finalTurnKey: finalTurn.key,
      exactFinalPrompt: promptReceipt.promptText,
      promptFingerprint: promptReceipt.promptFingerprint,
      promptChars: promptReceipt.promptChars,
      snapshotEventIds: [...promptReceipt.snapshotEventIds],
      snapshotEvents,
      missingSnapshotEventIds: [],
      receiptValidationIssues: [],
    };
  });

  return {
    originalSessionId: report.sessionId,
    packets,
    readyRetryCount: packets.filter((packet) => packet.state === "ready_exact_prompt").length,
    verificationCount: packets.filter((packet) => packet.state === "verification_only").length,
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
    "Original meeting immutable: YES",
  ];
  if (packet.state === "ready_exact_prompt") {
    lines.push(
      `Exact Final Prompt receipt: ${packet.promptChars ?? 0} chars · fingerprint ${packet.promptFingerprint ?? "?"}`,
      `Frozen prompt snapshot event IDs (${packet.snapshotEventIds.length}): ${packet.snapshotEventIds.join(", ")}`,
      "Retry scope: this seat only. Successful seats receive no extra speaking turn.",
      "Recovery must append a new provenance record/session and must never overwrite the original Final.",
      "The full stored prompt is intentionally omitted from this share text.",
    );
  } else if (packet.state === "verification_only") {
    lines.push("Do not retry yet. First verify/restore whether this recorded Final completed at the Provider.");
  } else if (packet.state === "clarification_only") {
    lines.push("Append a later provenance clarification only; do not retroactively insert a revision into the original meeting.");
  } else {
    lines.push(
      `BLOCKED: exact Final recovery equivalence cannot be proved (${packet.state}).`,
      ...(packet.missingSnapshotEventIds.length ? [`Missing event IDs: ${packet.missingSnapshotEventIds.join(", ")}`] : []),
      ...(packet.receiptValidationIssues.length ? [`Receipt issues: ${packet.receiptValidationIssues.join(", ")}`] : []),
      "Do not run an approximate retry and call it equivalent to the original Final turn.",
    );
  }
  return lines.join("\n");
}

function latestFinalTurn(turns: readonly ProviderTurnAttendanceAudit[]): ProviderTurnAttendanceAudit | undefined {
  return [...turns].filter((turn) => turn.phase === "final").sort((a, b) => b.round - a.round)[0];
}

function nonRetryPacket(report: CouncilReport, gap: FinalCoverageGap, participant: CouncilParticipant | undefined, state: "verification_only" | "clarification_only"): FinalRecoveryPacket {
  return { ...basePacket(report, gap, participant), state, snapshotEventIds: [], snapshotEvents: [], missingSnapshotEventIds: [], receiptValidationIssues: [] };
}

function blockedPacket(
  report: CouncilReport,
  gap: FinalCoverageGap,
  participant: CouncilParticipant | undefined,
  state: "blocked_no_final_turn" | "blocked_no_exact_final_prompt" | "blocked_invalid_prompt_receipt" | "blocked_snapshot_receipt_mismatch",
  finalTurn?: ProviderTurnAttendanceAudit,
  receipt?: FinalPromptReceipt,
  receiptValidationIssues: string[] = [],
): FinalRecoveryPacket {
  return {
    ...basePacket(report, gap, participant),
    state,
    ...(finalTurn ? { finalTurnKey: finalTurn.key } : {}),
    ...(receipt ? { exactFinalPrompt: receipt.promptText, promptFingerprint: receipt.promptFingerprint, promptChars: receipt.promptChars, snapshotEventIds: [...receipt.snapshotEventIds] } : { snapshotEventIds: [] }),
    snapshotEvents: [],
    missingSnapshotEventIds: [],
    receiptValidationIssues: [...receiptValidationIssues],
  };
}

function basePacket(report: CouncilReport, gap: FinalCoverageGap, participant: CouncilParticipant | undefined) {
  return {
    originalSessionId: report.sessionId,
    actorId: gap.actorId,
    participantName: gap.participantName,
    providerId: gap.providerId,
    ...(participant ? { participant: { ...participant } } : {}),
    gapId: gap.id,
    gapKind: gap.kind,
    operation: gap.recommendedOperation,
    originalFinalRound: report.rounds,
    ...(gap.finalEventId ? { finalEventId: gap.finalEventId } : {}),
    ...(gap.latestPreFinalEventId ? { latestPreFinalEventId: gap.latestPreFinalEventId } : {}),
    immutableOriginal: true as const,
  };
}

function sameStrings(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function cloneEvent(event: CouncilEvent): CouncilEvent {
  if (event.kind === "revision") return { ...event, ...(event.causedBy ? { causedBy: [...event.causedBy] } : {}) };
  if (event.kind === "final_position") return { ...event, ...(event.caveats ? { caveats: [...event.caveats] } : {}) };
  return { ...event };
}
