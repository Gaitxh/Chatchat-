import type { CouncilPhase } from "../core/types.js";
import type { ProviderTransportAuditRecord } from "../provider-sdk/transport-audit.js";

export type ProviderPublicPayloadIntegrityState =
  | "verified"
  | "peer_payload_drift"
  | "repair_deck_drift"
  | "payload_unverified"
  | "unavailable";

export type ProviderRepairDeckState =
  | "not_used"
  | "matched"
  | "drift"
  | "unverified";

export interface ProviderPublicPayloadTurn {
  key: string;
  sessionId: string;
  actorId: string;
  phase: CouncilPhase | "consultation";
  round: number;
  mode: ProviderTransportAuditRecord["mode"];
  promptMemoryObserved: boolean;
  firstPayloadFingerprint: string | null;
  firstPayloadEventCount: number | null;
  repairPayloadFingerprint: string | null;
  repairPayloadEventCount: number | null;
  /** Exact public selection-provenance equality aid derived from frozen receipt arrays. */
  firstSelectionFingerprint: string | null;
  repairSelectionFingerprint: string | null;
  repairPayloadMatched: boolean | null;
  repairSelectionMatched: boolean | null;
  repairDeckState: ProviderRepairDeckState;
}

export interface ProviderPublicPayloadRound {
  key: string;
  phase: CouncilPhase | "consultation";
  round: number;
  seatCount: number;
  fingerprintedSeatCount: number;
  unverifiedSeatCount: number;
  uniquePayloadFingerprints: string[];
  uniquePayloadReceipts: string[];
  payloadsConsistent: boolean | null;
  repairUsedSeatCount: number;
  repairMatchedSeatCount: number;
  repairDriftSeatCount: number;
  repairPayloadDriftSeatCount: number;
  repairSelectionDriftSeatCount: number;
  repairUnverifiedSeatCount: number;
}

export interface ProviderPublicPayloadIntegrityModel {
  sessionId: string | null;
  state: ProviderPublicPayloadIntegrityState;
  turns: ProviderPublicPayloadTurn[];
  rounds: ProviderPublicPayloadRound[];
  auditedTurnCount: number;
  fingerprintedTurnCount: number;
  unverifiedTurnCount: number;
  peerPayloadDriftRoundCount: number;
  repairUsedTurnCount: number;
  repairDeckDriftTurnCount: number;
  repairPayloadDriftTurnCount: number;
  repairSelectionDriftTurnCount: number;
  repairUnverifiedTurnCount: number;
}

/**
 * Audit serialized public-event payload equality from transport receipts.
 *
 * This is intentionally separate from Provider Memory Coverage. Event-id deck
 * equality answers "which public events were selected". Payload fingerprints
 * answer the narrower second question "were those selected public events
 * serialized identically for equal peers?". Repair parity is deliberately
 * stronger: a format-only repair must preserve both the serialized public
 * payload and the exact selected/pinned/latest provenance arrays.
 *
 * Every transport-observed consultation turn stays in the denominator even if
 * Prompt-memory observation is missing. Missing evidence is `payload_unverified`,
 * never silently deleted until the remaining seats appear verified.
 *
 * Fingerprints are equality aids only. They are not signatures, content
 * authenticity proofs, evidence-quality scores, or answer-correctness signals.
 */
export function deriveProviderPublicPayloadIntegrity(
  transports: readonly ProviderTransportAuditRecord[],
): ProviderPublicPayloadIntegrityModel {
  const sessionId = latestSessionId(transports);
  if (!sessionId) return emptyModel();
  const sessionRecords = transports.filter((record) => record.sessionId === sessionId);
  const turnKeys = unique(sessionRecords
    .filter(isConsultationTurnRecord)
    .map((record) => `${record.actorId}|${record.phase}|${record.round}`));

  const turns = turnKeys.map((key) => {
    const [actorId, phaseText, roundText] = key.split("|");
    const phase = phaseText as CouncilPhase | "consultation";
    const round = Number(roundText);
    const records = sessionRecords.filter((record) =>
      record.actorId === actorId
      && record.phase === phase
      && record.round === round,
    );
    const first = bestAttemptRecord(records.filter((record) => !record.repairAttempt));
    const repair = bestAttemptRecord(records.filter((record) => record.repairAttempt));
    const firstFingerprint = completePayloadFingerprint(first);
    const repairFingerprint = completePayloadFingerprint(repair);
    const firstSelection = selectionFingerprint(first);
    const repairSelection = selectionFingerprint(repair);
    const repairPayloadMatched = !repair || !firstFingerprint || !repairFingerprint
      ? null
      : firstFingerprint === repairFingerprint;
    const repairSelectionMatched = !repair || !firstSelection || !repairSelection
      ? null
      : firstSelection === repairSelection;
    const repairDeckState: ProviderRepairDeckState = !repair
      ? "not_used"
      : repairPayloadMatched === null || repairSelectionMatched === null
        ? "unverified"
        : repairPayloadMatched && repairSelectionMatched
          ? "matched"
          : "drift";
    return {
      key: `${sessionId}|${key}`,
      sessionId,
      actorId: actorId ?? "",
      phase,
      round,
      mode: first?.mode ?? repair?.mode ?? "live-provider-tabs",
      promptMemoryObserved: records.some((record) => record.promptMemoryObserved === true),
      firstPayloadFingerprint: first?.publicPayloadFingerprint ?? null,
      firstPayloadEventCount: first?.publicPayloadEventCount ?? null,
      repairPayloadFingerprint: repair?.publicPayloadFingerprint ?? null,
      repairPayloadEventCount: repair?.publicPayloadEventCount ?? null,
      firstSelectionFingerprint: firstSelection,
      repairSelectionFingerprint: repairSelection,
      repairPayloadMatched,
      repairSelectionMatched,
      repairDeckState,
    } satisfies ProviderPublicPayloadTurn;
  }).sort((a, b) => a.round - b.round || phaseRank(a.phase) - phaseRank(b.phase) || a.actorId.localeCompare(b.actorId));

  const roundKeys = unique(turns.map((turn) => `${turn.phase}|${turn.round}`));
  const rounds = roundKeys.map((key) => {
    const [phaseText, roundText] = key.split("|");
    const phase = phaseText as CouncilPhase | "consultation";
    const round = Number(roundText);
    const roundTurns = turns.filter((turn) => turn.phase === phase && turn.round === round);
    const payloadReceipts = unique(roundTurns.flatMap((turn) => {
      const fingerprint = completeTurnPayloadFingerprint(turn);
      return fingerprint ? [fingerprint] : [];
    }));
    const fingerprints = unique(roundTurns.flatMap((turn) => turn.firstPayloadFingerprint ? [turn.firstPayloadFingerprint] : []));
    const fingerprintedSeatCount = roundTurns.filter((turn) => Boolean(completeTurnPayloadFingerprint(turn))).length;
    const complete = fingerprintedSeatCount === roundTurns.length && roundTurns.length > 0;
    return {
      key,
      phase,
      round,
      seatCount: roundTurns.length,
      fingerprintedSeatCount,
      unverifiedSeatCount: roundTurns.length - fingerprintedSeatCount,
      uniquePayloadFingerprints: fingerprints,
      uniquePayloadReceipts: payloadReceipts,
      payloadsConsistent: complete ? payloadReceipts.length <= 1 : null,
      repairUsedSeatCount: roundTurns.filter((turn) => turn.repairDeckState !== "not_used").length,
      repairMatchedSeatCount: roundTurns.filter((turn) => turn.repairDeckState === "matched").length,
      repairDriftSeatCount: roundTurns.filter((turn) => turn.repairDeckState === "drift").length,
      repairPayloadDriftSeatCount: roundTurns.filter((turn) => turn.repairDeckState === "drift" && turn.repairPayloadMatched === false).length,
      repairSelectionDriftSeatCount: roundTurns.filter((turn) => turn.repairDeckState === "drift" && turn.repairSelectionMatched === false).length,
      repairUnverifiedSeatCount: roundTurns.filter((turn) => turn.repairDeckState === "unverified").length,
    } satisfies ProviderPublicPayloadRound;
  }).sort((a, b) => a.round - b.round || phaseRank(a.phase) - phaseRank(b.phase));

  const peerPayloadDriftRoundCount = rounds.filter((round) => round.payloadsConsistent === false).length;
  const repairDeckDriftTurnCount = turns.filter((turn) => turn.repairDeckState === "drift").length;
  const repairPayloadDriftTurnCount = turns.filter((turn) => turn.repairDeckState === "drift" && turn.repairPayloadMatched === false).length;
  const repairSelectionDriftTurnCount = turns.filter((turn) => turn.repairDeckState === "drift" && turn.repairSelectionMatched === false).length;
  const repairUnverifiedTurnCount = turns.filter((turn) => turn.repairDeckState === "unverified").length;
  const fingerprintedTurnCount = turns.filter((turn) => Boolean(completeTurnPayloadFingerprint(turn))).length;
  const unverifiedTurnCount = turns.length - fingerprintedTurnCount;
  const state: ProviderPublicPayloadIntegrityState = repairDeckDriftTurnCount > 0
    ? "repair_deck_drift"
    : peerPayloadDriftRoundCount > 0
      ? "peer_payload_drift"
      : unverifiedTurnCount > 0 || repairUnverifiedTurnCount > 0
        ? "payload_unverified"
        : turns.length > 0
          ? "verified"
          : "unavailable";

  return {
    sessionId,
    state,
    turns,
    rounds,
    auditedTurnCount: turns.length,
    fingerprintedTurnCount,
    unverifiedTurnCount,
    peerPayloadDriftRoundCount,
    repairUsedTurnCount: turns.filter((turn) => turn.repairDeckState !== "not_used").length,
    repairDeckDriftTurnCount,
    repairPayloadDriftTurnCount,
    repairSelectionDriftTurnCount,
    repairUnverifiedTurnCount,
  };
}

function bestAttemptRecord(records: readonly ProviderTransportAuditRecord[]): ProviderTransportAuditRecord | undefined {
  return [...records].sort((a, b) => {
    const stateRank = transportStateRank(b.state) - transportStateRank(a.state);
    return stateRank || b.observedAt.localeCompare(a.observedAt);
  })[0];
}

function completePayloadFingerprint(record: ProviderTransportAuditRecord | undefined): string | null {
  if (!record?.publicPayloadFingerprint || !Number.isInteger(record.publicPayloadEventCount) || record.publicPayloadEventCount! < 0) return null;
  return `${record.publicPayloadFingerprint}|events:${record.publicPayloadEventCount}`;
}

function completeTurnPayloadFingerprint(turn: ProviderPublicPayloadTurn): string | null {
  if (!turn.firstPayloadFingerprint || !Number.isInteger(turn.firstPayloadEventCount) || turn.firstPayloadEventCount! < 0) return null;
  return `${turn.firstPayloadFingerprint}|events:${turn.firstPayloadEventCount}`;
}

function selectionFingerprint(record: ProviderTransportAuditRecord | undefined): string | null {
  if (!record || record.promptMemoryObserved !== true) return null;
  if (
    record.pinnedOpenIssueEventIds === undefined
    || record.pinnedIssueSourceEventIds === undefined
    || record.latestRoundEventIds === undefined
  ) return null;
  return JSON.stringify({
    snapshot: [...record.snapshotEventIds],
    pinned: [...record.pinnedOpenIssueEventIds],
    sources: [...record.pinnedIssueSourceEventIds],
    latest: [...record.latestRoundEventIds],
  });
}

function isConsultationTurnRecord(record: ProviderTransportAuditRecord): boolean {
  return Boolean(record.sessionId && record.actorId)
    && Number.isFinite(record.round)
    && record.round > 0
    && (record.phase === "sealed" || record.phase === "debate" || record.phase === "final");
}

function transportStateRank(state: ProviderTransportAuditRecord["state"]): number {
  if (state === "received") return 2;
  if (state === "failed") return 1;
  return 0;
}

function latestSessionId(records: readonly ProviderTransportAuditRecord[]): string | null {
  const sorted = [...records].filter(isConsultationTurnRecord).sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  return sorted.at(-1)?.sessionId ?? null;
}

function emptyModel(): ProviderPublicPayloadIntegrityModel {
  return {
    sessionId: null,
    state: "unavailable",
    turns: [],
    rounds: [],
    auditedTurnCount: 0,
    fingerprintedTurnCount: 0,
    unverifiedTurnCount: 0,
    peerPayloadDriftRoundCount: 0,
    repairUsedTurnCount: 0,
    repairDeckDriftTurnCount: 0,
    repairPayloadDriftTurnCount: 0,
    repairSelectionDriftTurnCount: 0,
    repairUnverifiedTurnCount: 0,
  };
}

function phaseRank(phase: CouncilPhase | "consultation"): number {
  if (phase === "sealed") return 0;
  if (phase === "debate") return 1;
  if (phase === "final") return 2;
  return 3;
}

function unique<T>(values: readonly T[]): T[] { return [...new Set(values)]; }
