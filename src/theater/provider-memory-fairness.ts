import type { CouncilParticipant, CouncilPhase } from "../core/types.js";
import type { ProviderExecutionAuditEvent } from "../provider-sdk/execution-audit.js";
import type { ProviderTransportAuditRecord } from "../provider-sdk/transport-audit.js";

export type ProviderMemoryFairnessState =
  | "verified"
  | "representation_limited"
  | "public_payload_mismatch"
  | "prompt_metadata_drift"
  | "repair_context_drift"
  | "selector_actor_drift"
  | "prompt_unverified"
  | "legacy_unverified";

export interface ProviderMemoryFairnessTurn {
  key: string;
  actorId: string;
  actorName: string;
  phase: CouncilPhase;
  round: number;
  selectorObserved: boolean;
  actualPromptObserved: boolean;
  snapshotMetadataMatchesPayload: boolean | null;
  publicContextFingerprint?: string;
  selectorLatestRoundActorIds: string[];
  selectorSelectedActorIds: string[];
  selectorOmittedActorIds: string[];
  actualSelectedActorIds: string[];
  selectorActorCoverageMatchesActual: boolean | null;
  repairAttemptCount: number;
  repairContextConsistent: boolean | null;
}

export interface ProviderMemoryFairnessRound {
  key: string;
  phase: CouncilPhase;
  round: number;
  turns: ProviderMemoryFairnessTurn[];
  seatCount: number;
  actualPromptSeatCount: number;
  promptMetadataMismatchSeats: number;
  publicPayloadFingerprints: string[];
  publicPayloadConsistent: boolean;
  selectorActorMismatchSeats: number;
  repairContextMismatchSeats: number;
  latestRoundActorIds: string[];
  latestRoundRepresentedActorIds: string[];
  latestRoundOmittedActorIds: string[];
  latestRoundRepresentationComplete: boolean;
}

export interface ProviderMemoryFairnessModel {
  state: ProviderMemoryFairnessState;
  sessionId: string | null;
  rounds: ProviderMemoryFairnessRound[];
  turns: ProviderMemoryFairnessTurn[];
  auditedRounds: number;
  auditedTurns: number;
  actualPromptTurns: number;
  publicPayloadMismatchRounds: number;
  promptMetadataMismatchTurns: number;
  repairContextMismatchTurns: number;
  selectorActorMismatchTurns: number;
  representationLimitedRounds: number;
}

/**
 * Procedural fairness for bounded public memory.
 *
 * This model never judges answer quality or semantic importance. It asks five
 * mechanical questions only:
 * 1) did the hard cap still represent every actor from the previous public round;
 * 2) did equal peers receive equivalent normalized public event payloads;
 * 3) did PUBLIC_SNAPSHOT_EVENT_IDS_JSON match ids parsed independently from the
 *    actual CONSULTATION_EVENTS_JSON payload;
 * 4) did selector actor coverage agree with what the actual Prompt contained;
 * 5) did a repair attempt preserve exactly the same public deck as attempt one.
 */
export function deriveProviderMemoryFairness(
  participants: readonly CouncilParticipant[],
  execution: readonly ProviderExecutionAuditEvent[],
  transports: readonly ProviderTransportAuditRecord[],
): ProviderMemoryFairnessModel {
  const sessionId = latestSessionId(execution, transports);
  if (!sessionId) return emptyModel();
  const names = new Map(participants.map((participant) => [participant.id, participant.name] as const));
  const turnAudits = chooseTurnAuditEvents(execution.filter((event) => event.sessionId === sessionId));

  const turns = turnAudits.map((audit) => {
    const matching = transports.filter((record) =>
      record.sessionId === sessionId
      && record.actorId === audit.actorId
      && record.phase === audit.phase
      && record.round === audit.round,
    );
    const first = [...matching].reverse().find((record) => !record.repairAttempt && record.promptMemoryObserved === true);
    const repairs = matching.filter((record) => record.repairAttempt && record.promptMemoryObserved === true);
    const selectorObserved = audit.contextSelectionObserved === true;
    const selectorSelected = unique(audit.latestRoundSelectedActorIds ?? []);
    const selectorActors = unique(audit.latestRoundActorIds ?? []);
    const selectorOmitted = unique(audit.latestRoundOmittedActorIds ?? []);
    const actualSelected = unique(first?.latestRoundSelectedActorIds ?? []);
    const selectorActorCoverageMatchesActual = first && selectorObserved
      ? sameSet(selectorSelected, actualSelected)
      : null;
    const repairContextConsistent = repairs.length && first
      ? repairs.every((repair) => samePromptDeck(first, repair))
      : null;

    return {
      key: `${sessionId}|${audit.actorId}|${audit.phase}|${audit.round}`,
      actorId: audit.actorId,
      actorName: names.get(audit.actorId) ?? audit.providerName ?? audit.actorId,
      phase: audit.phase,
      round: audit.round,
      selectorObserved,
      actualPromptObserved: Boolean(first),
      snapshotMetadataMatchesPayload: first?.snapshotMetadataMatchesPayload ?? null,
      ...(first?.publicContextFingerprint ? { publicContextFingerprint: first.publicContextFingerprint } : {}),
      selectorLatestRoundActorIds: selectorActors,
      selectorSelectedActorIds: selectorSelected,
      selectorOmittedActorIds: selectorOmitted,
      actualSelectedActorIds: actualSelected,
      selectorActorCoverageMatchesActual,
      repairAttemptCount: repairs.length,
      repairContextConsistent,
    } satisfies ProviderMemoryFairnessTurn;
  }).sort((a, b) => a.round - b.round || phaseRank(a.phase) - phaseRank(b.phase) || a.actorName.localeCompare(b.actorName));

  const roundKeys = unique(turns.map((turn) => `${turn.phase}|${turn.round}`));
  const rounds = roundKeys.map((key) => {
    const [phaseText, roundText] = key.split("|");
    const phase = phaseText as CouncilPhase;
    const round = Number(roundText);
    const roundTurns = turns.filter((turn) => turn.phase === phase && turn.round === round);
    const actualFingerprints = unique(roundTurns.flatMap((turn) => turn.publicContextFingerprint ? [turn.publicContextFingerprint] : []));
    const selectorActors = union(roundTurns.map((turn) => turn.selectorLatestRoundActorIds));
    const represented = union(roundTurns.map((turn) => turn.selectorSelectedActorIds));
    const omitted = union(roundTurns.map((turn) => turn.selectorOmittedActorIds));
    return {
      key,
      phase,
      round,
      turns: roundTurns,
      seatCount: roundTurns.length,
      actualPromptSeatCount: roundTurns.filter((turn) => turn.actualPromptObserved).length,
      promptMetadataMismatchSeats: roundTurns.filter((turn) => turn.snapshotMetadataMatchesPayload === false).length,
      publicPayloadFingerprints: actualFingerprints,
      publicPayloadConsistent: actualFingerprints.length <= 1,
      selectorActorMismatchSeats: roundTurns.filter((turn) => turn.selectorActorCoverageMatchesActual === false).length,
      repairContextMismatchSeats: roundTurns.filter((turn) => turn.repairContextConsistent === false).length,
      latestRoundActorIds: selectorActors,
      latestRoundRepresentedActorIds: represented,
      latestRoundOmittedActorIds: omitted,
      latestRoundRepresentationComplete: omitted.length === 0,
    } satisfies ProviderMemoryFairnessRound;
  }).sort((a, b) => a.round - b.round || phaseRank(a.phase) - phaseRank(b.phase));

  const publicPayloadMismatchRounds = rounds.filter((round) => !round.publicPayloadConsistent).length;
  const promptMetadataMismatchTurns = turns.filter((turn) => turn.snapshotMetadataMatchesPayload === false).length;
  const repairContextMismatchTurns = turns.filter((turn) => turn.repairContextConsistent === false).length;
  const selectorActorMismatchTurns = turns.filter((turn) => turn.selectorActorCoverageMatchesActual === false).length;
  const representationLimitedRounds = rounds.filter((round) => !round.latestRoundRepresentationComplete).length;
  const actualPromptTurns = turns.filter((turn) => turn.actualPromptObserved).length;
  const allLegacy = turns.length > 0 && turns.every((turn) => !turn.actualPromptObserved && !turn.selectorObserved);

  const state: ProviderMemoryFairnessState = publicPayloadMismatchRounds > 0
    ? "public_payload_mismatch"
    : promptMetadataMismatchTurns > 0
      ? "prompt_metadata_drift"
      : repairContextMismatchTurns > 0
        ? "repair_context_drift"
        : selectorActorMismatchTurns > 0
          ? "selector_actor_drift"
          : representationLimitedRounds > 0
            ? "representation_limited"
            : allLegacy
              ? "legacy_unverified"
              : actualPromptTurns < turns.length
                ? "prompt_unverified"
                : "verified";

  return {
    state,
    sessionId,
    rounds,
    turns,
    auditedRounds: rounds.length,
    auditedTurns: turns.length,
    actualPromptTurns,
    publicPayloadMismatchRounds,
    promptMetadataMismatchTurns,
    repairContextMismatchTurns,
    selectorActorMismatchTurns,
    representationLimitedRounds,
  };
}

function samePromptDeck(a: ProviderTransportAuditRecord, b: ProviderTransportAuditRecord): boolean {
  return JSON.stringify({
    actualSnapshot: a.snapshotEventIds,
    declaredSnapshot: a.declaredSnapshotEventIds ?? null,
    metadataParity: a.snapshotMetadataMatchesPayload ?? null,
    latest: a.latestRoundEventIds ?? [],
    pinned: a.pinnedOpenIssueEventIds ?? [],
    sources: a.pinnedIssueSourceEventIds ?? [],
    actors: a.latestRoundSelectedActorIds ?? [],
    payload: a.publicContextFingerprint ?? null,
  }) === JSON.stringify({
    actualSnapshot: b.snapshotEventIds,
    declaredSnapshot: b.declaredSnapshotEventIds ?? null,
    metadataParity: b.snapshotMetadataMatchesPayload ?? null,
    latest: b.latestRoundEventIds ?? [],
    pinned: b.pinnedOpenIssueEventIds ?? [],
    sources: b.pinnedIssueSourceEventIds ?? [],
    actors: b.latestRoundSelectedActorIds ?? [],
    payload: b.publicContextFingerprint ?? null,
  });
}

function chooseTurnAuditEvents(events: readonly ProviderExecutionAuditEvent[]): ProviderExecutionAuditEvent[] {
  const byKey = new Map<string, ProviderExecutionAuditEvent[]>();
  for (const event of events) {
    const key = `${event.actorId}|${event.phase}|${event.round}`;
    const group = byKey.get(key) ?? [];
    group.push(event);
    byKey.set(key, group);
  }
  return [...byKey.values()].map((group) =>
    group.find((event) => event.stage === "turn_started")
      ?? group.find((event) => event.stage === "structured_parsed")
      ?? group[0]!,
  );
}

function latestSessionId(
  execution: readonly ProviderExecutionAuditEvent[],
  transports: readonly ProviderTransportAuditRecord[],
): string | null {
  const candidates: Array<{ id: string; at: string }> = [];
  for (const event of execution) candidates.push({ id: event.sessionId, at: event.observedAt });
  for (const record of transports) candidates.push({ id: record.sessionId, at: record.observedAt });
  candidates.sort((a, b) => a.at.localeCompare(b.at));
  return candidates.at(-1)?.id ?? null;
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const left = [...a].sort();
  const right = [...b].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function union(values: readonly string[][]): string[] {
  return unique(values.flat());
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function phaseRank(phase: CouncilPhase): number {
  if (phase === "sealed") return 0;
  if (phase === "debate") return 1;
  return 2;
}

function emptyModel(): ProviderMemoryFairnessModel {
  return {
    state: "prompt_unverified",
    sessionId: null,
    rounds: [],
    turns: [],
    auditedRounds: 0,
    auditedTurns: 0,
    actualPromptTurns: 0,
    publicPayloadMismatchRounds: 0,
    promptMetadataMismatchTurns: 0,
    repairContextMismatchTurns: 0,
    selectorActorMismatchTurns: 0,
    representationLimitedRounds: 0,
  };
}
