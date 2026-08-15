import type { CouncilEvent, CouncilParticipant, CouncilPhase } from "../core/types.js";
import {
  deriveOpenMeetingIssueProvenance,
  type OpenMeetingIssueKind,
} from "../consultation/open-issues.js";
import type {
  ProviderMemoryCoverageModel,
  ProviderMemoryTurn,
} from "./provider-memory-coverage.js";

export interface ProviderMemoryCoverageGap {
  id: string;
  turnKey: string;
  actorId: string;
  actorName: string;
  phase: CouncilPhase;
  round: number;
  sourceEventId: string;
  kind: OpenMeetingIssueKind;
  openedRound: number;
  sourceActorId: string;
  sourceActorName: string;
  targetActorId?: string;
  targetActorName?: string;
  sourceExcerpt: string;
  selectionEvidence: ProviderMemoryTurn["selectionEvidence"];
}

export interface ProviderMemoryGapRound {
  key: string;
  phase: CouncilPhase;
  round: number;
  seatCount: number;
  turnsWithGaps: number;
  uniqueGapSourceEventIds: string[];
  gapCount: number;
  allSeatsSameGapSet: boolean;
}

export interface ProviderMemoryGapModel {
  sessionId: string | null;
  gaps: ProviderMemoryCoverageGap[];
  rounds: ProviderMemoryGapRound[];
  gapTurnCount: number;
  uniqueGapSourceEventIds: string[];
  actualPromptGapCount: number;
  allGapSetsFairWithinRound: boolean;
}

/**
 * Expose known unresolved obligations that were absent from a Provider's public
 * memory deck because the hard context budget is finite.
 *
 * This is coverage provenance, not a claim that an omitted issue was important
 * or that the Provider would have answered differently if it had been present.
 */
export function deriveProviderMemoryGaps(
  participants: readonly CouncilParticipant[],
  publicEvents: readonly CouncilEvent[],
  coverage: ProviderMemoryCoverageModel,
): ProviderMemoryGapModel {
  const participantById = new Map(participants.map((participant) => [participant.id, participant] as const));
  const eventById = new Map(publicEvents.map((event) => [event.id, event] as const));
  const gaps = coverage.turns.flatMap((turn) => deriveTurnGaps(turn, publicEvents, eventById, participantById));
  const roundKeys = unique(coverage.turns.map((turn) => `${turn.phase}|${turn.round}`));
  const rounds = roundKeys.map((key) => {
    const [phaseText, roundText] = key.split("|");
    const phase = phaseText as CouncilPhase;
    const round = Number(roundText);
    const turns = coverage.turns.filter((turn) => turn.phase === phase && turn.round === round);
    const turnGapSets = turns.map((turn) =>
      gaps.filter((gap) => gap.turnKey === turn.key).map((gap) => gap.sourceEventId).sort(),
    );
    const fingerprints = unique(turnGapSets.map((ids) => JSON.stringify(ids)));
    const roundGaps = gaps.filter((gap) => gap.phase === phase && gap.round === round);
    return {
      key,
      phase,
      round,
      seatCount: turns.length,
      turnsWithGaps: turnGapSets.filter((ids) => ids.length > 0).length,
      uniqueGapSourceEventIds: unique(roundGaps.map((gap) => gap.sourceEventId)),
      gapCount: roundGaps.length,
      allSeatsSameGapSet: fingerprints.length <= 1,
    } satisfies ProviderMemoryGapRound;
  }).sort((a, b) => a.round - b.round || phaseRank(a.phase) - phaseRank(b.phase));

  return {
    sessionId: coverage.sessionId,
    gaps,
    rounds,
    gapTurnCount: unique(gaps.map((gap) => gap.turnKey)).length,
    uniqueGapSourceEventIds: unique(gaps.map((gap) => gap.sourceEventId)),
    actualPromptGapCount: gaps.filter((gap) => gap.selectionEvidence === "actual_prompt").length,
    allGapSetsFairWithinRound: rounds.every((round) => round.allSeatsSameGapSet),
  };
}

function deriveTurnGaps(
  turn: ProviderMemoryTurn,
  publicEvents: readonly CouncilEvent[],
  eventById: ReadonlyMap<string, CouncilEvent>,
  participants: ReadonlyMap<string, CouncilParticipant>,
): ProviderMemoryCoverageGap[] {
  const available = turn.availableEventIds
    .map((id) => eventById.get(id))
    .filter((event): event is CouncilEvent => Boolean(event));
  const snapshot = new Set(turn.snapshotEventIds);
  const issues = deriveOpenMeetingIssueProvenance(available);
  return issues.flatMap((issue) => {
    if (snapshot.has(issue.sourceEventId)) return [];
    const source = eventById.get(issue.sourceEventId);
    if (!source) return [];
    return [{
      id: `${turn.key}|${issue.sourceEventId}`,
      turnKey: turn.key,
      actorId: turn.actorId,
      actorName: turn.actorName,
      phase: turn.phase,
      round: turn.round,
      sourceEventId: issue.sourceEventId,
      kind: issue.kind,
      openedRound: issue.round,
      sourceActorId: issue.actorId,
      sourceActorName: actorName(participants, issue.actorId),
      ...(issue.targetActorId ? {
        targetActorId: issue.targetActorId,
        targetActorName: actorName(participants, issue.targetActorId),
      } : {}),
      sourceExcerpt: excerpt(source),
      selectionEvidence: turn.selectionEvidence,
    } satisfies ProviderMemoryCoverageGap];
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

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function phaseRank(phase: CouncilPhase): number {
  if (phase === "sealed") return 0;
  if (phase === "debate") return 1;
  return 2;
}
