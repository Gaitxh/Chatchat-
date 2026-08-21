import type { CouncilEvent, CouncilParticipant, CouncilPhase } from "../core/types.js";
import {
  deriveOpenMeetingIssueProvenance,
  findMeetingIssueResolver,
  type OpenMeetingIssueKind,
} from "../consultation/open-issues.js";
import type { ProviderExecutionAuditEvent } from "../provider-sdk/execution-audit.js";
import type { ProviderTransportAuditRecord } from "../provider-sdk/transport-audit.js";
import { DEFAULT_PROVIDER_CONTEXT_EVENTS } from "../provider-sdk/context-selection.js";

export type ProviderMemorySelectionEvidence =
  | "actual_prompt"
  | "selector_audit"
  | "legacy_selector_audit";

export interface ProviderPinnedMemoryIssue {
  sourceEventId: string;
  kind: OpenMeetingIssueKind;
  openedRound: number;
  sourceActorId: string;
  sourceActorName: string;
  targetActorId?: string;
  targetActorName?: string;
  sourceExcerpt: string;
  resolverEventId?: string;
  resolverActorId?: string;
  resolverActorName?: string;
  resolvedRound?: number;
  stillOpenAtMeetingEnd: boolean;
}

export interface ProviderMemoryTurn {
  key: string;
  sessionId: string;
  actorId: string;
  actorName: string;
  providerId: string;
  phase: CouncilPhase;
  round: number;
  contextBudget: number;
  selectionEvidence: ProviderMemorySelectionEvidence;
  selectorMatchesActualPrompt: boolean | null;
  availableEventIds: string[];
  snapshotEventIds: string[];
  latestRoundEventIds: string[];
  pinnedEventIds: string[];
  pinnedIssueSourceEventIds: string[];
  ordinaryRecentEventIds: string[];
  omittedEventIds: string[];
  pinnedIssues: ProviderPinnedMemoryIssue[];
  transportAttempted: boolean;
  transportReceived: boolean;
}

export interface ProviderMemoryRound {
  key: string;
  phase: CouncilPhase;
  round: number;
  turns: ProviderMemoryTurn[];
  seatCount: number;
  attemptedSeatCount: number;
  receivedSeatCount: number;
  actualPromptSeatCount: number;
  legacySelectorSeatCount: number;
  selectorMismatchSeatCount: number;
  snapshotsConsistent: boolean;
  selectionFingerprints: string[];
  snapshotEventIds: string[];
  latestRoundEventIds: string[];
  pinnedEventIds: string[];
  pinnedIssueSourceEventIds: string[];
  ordinaryRecentEventIds: string[];
  omittedEventIds: string[];
  pinnedIssues: ProviderPinnedMemoryIssue[];
  availableCount: number;
  snapshotCount: number;
  contextBudget: number;
}

export interface ProviderMemoryCoverageModel {
  sessionId: string | null;
  contextBudget: number;
  rounds: ProviderMemoryRound[];
  turns: ProviderMemoryTurn[];
  roundsWithPinnedMemory: number;
  pinnedIssueSourceEventIds: string[];
  actualPromptTurnCount: number;
  legacySelectorTurnCount: number;
  selectorMismatchTurnCount: number;
  allSharedSnapshotsConsistent: boolean;
  allPromptSelectorConsistent: boolean;
}

/**
 * Reconstruct exact public-memory accounting for each Provider turn.
 *
 * Actual RUN_SPEECH metadata wins when it exists. The deterministic selector
 * audit remains a separate comparison source rather than being silently merged
 * into the Prompt observation. Old archives that predate explicit selection
 * provenance remain visibly legacy.
 */
export function deriveProviderMemoryCoverage(
  participants: readonly CouncilParticipant[],
  publicEvents: readonly CouncilEvent[],
  execution: readonly ProviderExecutionAuditEvent[],
  transports: readonly ProviderTransportAuditRecord[] = [],
  contextBudget = DEFAULT_PROVIDER_CONTEXT_EVENTS,
): ProviderMemoryCoverageModel {
  const sessionId = latestSessionId(execution, publicEvents);
  if (!sessionId) return emptyModel(contextBudget);

  const participantById = new Map(participants.map((participant) => [participant.id, participant] as const));
  const sessionEvents = publicEvents.filter((event) => event.sessionId === sessionId);
  const turnAudits = chooseTurnAuditEvents(execution.filter((event) => event.sessionId === sessionId));

  const turns = turnAudits.map((audit) => {
    const participant = participantById.get(audit.actorId);
    const availableEvents = sessionEvents.filter((event) => event.round < audit.round);
    const availableIds = availableEvents.map((event) => event.id);
    const turnTransports = transports.filter((record) =>
      record.sessionId === sessionId
      && record.actorId === audit.actorId
      && record.phase === audit.phase
      && record.round === audit.round
      && !record.repairAttempt,
    );
    const actualPromptRecord = [...turnTransports]
      .reverse()
      .find((record) => record.promptMemoryObserved === true);
    const selectorObserved = audit.contextSelectionObserved === true;
    const selectionEvidence: ProviderMemorySelectionEvidence = actualPromptRecord
      ? "actual_prompt"
      : selectorObserved
        ? "selector_audit"
        : "legacy_selector_audit";

    const auditSnapshot = unique(audit.snapshotEventIds);
    const auditLatest = unique(audit.latestRoundEventIds ?? []).filter((id) => auditSnapshot.includes(id));
    const auditPinned = unique(audit.pinnedOpenIssueEventIds ?? []).filter((id) => auditSnapshot.includes(id));
    const auditPinnedSources = unique(audit.pinnedIssueSourceEventIds ?? []);

    const snapshot = unique(actualPromptRecord?.snapshotEventIds ?? auditSnapshot);
    const latest = unique(actualPromptRecord?.latestRoundEventIds ?? auditLatest).filter((id) => snapshot.includes(id));
    const pinned = unique(actualPromptRecord?.pinnedOpenIssueEventIds ?? auditPinned).filter((id) => snapshot.includes(id));
    const pinnedSources = unique(actualPromptRecord?.pinnedIssueSourceEventIds ?? auditPinnedSources);
    const selectorMatchesActualPrompt = actualPromptRecord && selectorObserved
      ? memoryFingerprint(snapshot, latest, pinned, pinnedSources)
        === memoryFingerprint(auditSnapshot, auditLatest, auditPinned, auditPinnedSources)
      : null;

    const pinnedSet = new Set(pinned);
    const latestSet = new Set(latest);
    const snapshotSet = new Set(snapshot);
    const ordinaryRecent = snapshot.filter((id) => !pinnedSet.has(id) && !latestSet.has(id));
    const omitted = availableIds.filter((id) => !snapshotSet.has(id));

    return {
      key: `${sessionId}|${audit.actorId}|${audit.phase}|${audit.round}`,
      sessionId,
      actorId: audit.actorId,
      actorName: participant?.name ?? audit.providerName ?? audit.actorId,
      providerId: participant?.provider ?? audit.providerId,
      phase: audit.phase,
      round: audit.round,
      contextBudget,
      selectionEvidence,
      selectorMatchesActualPrompt,
      availableEventIds: availableIds,
      snapshotEventIds: snapshot,
      latestRoundEventIds: latest,
      pinnedEventIds: pinned,
      pinnedIssueSourceEventIds: pinnedSources,
      ordinaryRecentEventIds: ordinaryRecent,
      omittedEventIds: omitted,
      pinnedIssues: describePinnedIssues(pinnedSources, availableEvents, sessionEvents, participantById),
      transportAttempted: turnTransports.length > 0,
      transportReceived: turnTransports.some((record) => record.state === "received"),
    } satisfies ProviderMemoryTurn;
  }).sort((a, b) => a.round - b.round || phaseRank(a.phase) - phaseRank(b.phase) || a.actorName.localeCompare(b.actorName));

  const roundKeys = unique(turns.map((turn) => `${turn.phase}|${turn.round}`));
  const rounds = roundKeys.map((key) => {
    const [phaseText, roundText] = key.split("|");
    const phase = phaseText as CouncilPhase;
    const round = Number(roundText);
    const roundTurns = turns.filter((turn) => turn.phase === phase && turn.round === round);
    const fingerprints = unique(roundTurns.map(selectionFingerprint));
    const representative = roundTurns[0];
    return {
      key,
      phase,
      round,
      turns: roundTurns,
      seatCount: roundTurns.length,
      attemptedSeatCount: roundTurns.filter((turn) => turn.transportAttempted).length,
      receivedSeatCount: roundTurns.filter((turn) => turn.transportReceived).length,
      actualPromptSeatCount: roundTurns.filter((turn) => turn.selectionEvidence === "actual_prompt").length,
      legacySelectorSeatCount: roundTurns.filter((turn) => turn.selectionEvidence === "legacy_selector_audit").length,
      selectorMismatchSeatCount: roundTurns.filter((turn) => turn.selectorMatchesActualPrompt === false).length,
      snapshotsConsistent: fingerprints.length <= 1,
      selectionFingerprints: fingerprints,
      snapshotEventIds: representative ? [...representative.snapshotEventIds] : [],
      latestRoundEventIds: representative ? [...representative.latestRoundEventIds] : [],
      pinnedEventIds: representative ? [...representative.pinnedEventIds] : [],
      pinnedIssueSourceEventIds: representative ? [...representative.pinnedIssueSourceEventIds] : [],
      ordinaryRecentEventIds: representative ? [...representative.ordinaryRecentEventIds] : [],
      omittedEventIds: representative ? [...representative.omittedEventIds] : [],
      pinnedIssues: representative ? representative.pinnedIssues.map((issue) => ({ ...issue })) : [],
      availableCount: representative?.availableEventIds.length ?? 0,
      snapshotCount: representative?.snapshotEventIds.length ?? 0,
      contextBudget,
    } satisfies ProviderMemoryRound;
  }).sort((a, b) => a.round - b.round || phaseRank(a.phase) - phaseRank(b.phase));

  return {
    sessionId,
    contextBudget,
    rounds,
    turns,
    roundsWithPinnedMemory: rounds.filter((round) => round.pinnedEventIds.length > 0).length,
    pinnedIssueSourceEventIds: unique(rounds.flatMap((round) => round.pinnedIssueSourceEventIds)),
    actualPromptTurnCount: turns.filter((turn) => turn.selectionEvidence === "actual_prompt").length,
    legacySelectorTurnCount: turns.filter((turn) => turn.selectionEvidence === "legacy_selector_audit").length,
    selectorMismatchTurnCount: turns.filter((turn) => turn.selectorMatchesActualPrompt === false).length,
    allSharedSnapshotsConsistent: rounds.every((round) => round.snapshotsConsistent),
    allPromptSelectorConsistent: turns.every((turn) => turn.selectorMatchesActualPrompt !== false),
  };
}

function emptyModel(contextBudget: number): ProviderMemoryCoverageModel {
  return {
    sessionId: null,
    contextBudget,
    rounds: [],
    turns: [],
    roundsWithPinnedMemory: 0,
    pinnedIssueSourceEventIds: [],
    actualPromptTurnCount: 0,
    legacySelectorTurnCount: 0,
    selectorMismatchTurnCount: 0,
    allSharedSnapshotsConsistent: true,
    allPromptSelectorConsistent: true,
  };
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

function describePinnedIssues(
  sourceIds: readonly string[],
  availableEvents: readonly CouncilEvent[],
  fullEvents: readonly CouncilEvent[],
  participants: ReadonlyMap<string, CouncilParticipant>,
): ProviderPinnedMemoryIssue[] {
  const availableById = new Map(availableEvents.map((event) => [event.id, event] as const));
  const openById = new Map(
    deriveOpenMeetingIssueProvenance(availableEvents).map((issue) => [issue.sourceEventId, issue] as const),
  );
  return sourceIds.flatMap((sourceEventId) => {
    const source = availableById.get(sourceEventId);
    const issue = openById.get(sourceEventId);
    if (!source || !issue) return [];
    const resolver = findMeetingIssueResolver(fullEvents, source);
    return [{
      sourceEventId,
      kind: issue.kind,
      openedRound: issue.round,
      sourceActorId: issue.actorId,
      sourceActorName: actorName(participants, issue.actorId),
      ...(issue.targetActorId ? {
        targetActorId: issue.targetActorId,
        targetActorName: actorName(participants, issue.targetActorId),
      } : {}),
      sourceExcerpt: excerpt(source),
      ...(resolver ? {
        resolverEventId: resolver.id,
        resolverActorId: resolver.actorId,
        resolverActorName: actorName(participants, resolver.actorId),
        resolvedRound: resolver.round,
      } : {}),
      stillOpenAtMeetingEnd: !resolver,
    } satisfies ProviderPinnedMemoryIssue];
  });
}

function selectionFingerprint(turn: ProviderMemoryTurn): string {
  return memoryFingerprint(
    turn.snapshotEventIds,
    turn.latestRoundEventIds,
    turn.pinnedEventIds,
    turn.pinnedIssueSourceEventIds,
  );
}

function memoryFingerprint(
  snapshotEventIds: readonly string[],
  latestRoundEventIds: readonly string[],
  pinnedEventIds: readonly string[],
  pinnedIssueSourceEventIds: readonly string[],
): string {
  return JSON.stringify({
    snapshot: snapshotEventIds,
    latest: latestRoundEventIds,
    pinned: pinnedEventIds,
    sources: pinnedIssueSourceEventIds,
  });
}

function excerpt(event: CouncilEvent): string {
  const value = event.kind === "evidence" ? (event.claim || event.content) : event.content;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= 180 ? normalized : `${normalized.slice(0, 179)}…`;
}

function actorName(participants: ReadonlyMap<string, CouncilParticipant>, actorId: string): string {
  return participants.get(actorId)?.name ?? actorId;
}

function latestSessionId(
  execution: readonly ProviderExecutionAuditEvent[],
  publicEvents: readonly CouncilEvent[],
): string | null {
  const candidates: Array<{ id: string; at: string }> = [];
  for (const event of execution) candidates.push({ id: event.sessionId, at: event.observedAt });
  for (const event of publicEvents) candidates.push({ id: event.sessionId, at: event.createdAt });
  candidates.sort((a, b) => a.at.localeCompare(b.at));
  return candidates.at(-1)?.id ?? null;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function phaseRank(phase: CouncilPhase): number {
  if (phase === "sealed") return 0;
  if (phase === "debate") return 1;
  return 2;
}
