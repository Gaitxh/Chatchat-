import type { CouncilEvent, CouncilParticipant } from "../core/types.js";
import {
  directPeerRequestTarget,
  eventReferences,
  explicitlyAnswersRequest,
} from "../consultation/structured-response.js";
import type { OpenMeetingIssueKind } from "../consultation/open-issues.js";
import { deriveConflictBoard, type ConflictBoardModel } from "./conflict-board.js";

export type ConflictObligationState = "open" | "resolved";

export interface ConflictObligationResolution {
  id: string;
  threadId: string;
  kind: OpenMeetingIssueKind;
  sourceEventId: string;
  sourceActorId: string;
  sourceActorName: string;
  openedRound: number;
  targetActorId?: string;
  targetActorName?: string;
  state: ConflictObligationState;
  resolvedByEventId?: string;
  resolverActorId?: string;
  resolverActorName?: string;
  resolvedRound?: number;
}

export interface ConflictRoundTrajectory {
  round: number;
  eventCount: number;
  openedCount: number;
  resolvedCount: number;
  openAtEnd: number;
  movementCount: number;
  eventIds: string[];
  openedEventIds: string[];
  resolvedByEventIds: string[];
  movementEventIds: string[];
}

export interface ConflictThreadResolution {
  threadId: string;
  anchorEventId: string;
  obligations: ConflictObligationResolution[];
  openedCount: number;
  resolvedCount: number;
  openCount: number;
  trajectory: ConflictRoundTrajectory[];
}

export interface ConflictResolutionLedger {
  threads: ConflictThreadResolution[];
  obligations: ConflictObligationResolution[];
  openedCount: number;
  resolvedCount: number;
  openCount: number;
}

/**
 * Deterministic closure ledger for Conflict Board obligations.
 *
 * A resolution exists only when the same exact structural rule that would make
 * an Open Issue disappear can identify the first later event that closes it.
 * No prose similarity, embeddings, sentiment or model confidence ranking is
 * used to decide whether a question/challenge/evidence obligation was answered.
 */
export function deriveConflictResolutionLedger(
  participants: readonly CouncilParticipant[],
  events: readonly CouncilEvent[],
  board: ConflictBoardModel = deriveConflictBoard(participants, events),
): ConflictResolutionLedger {
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const participantNames = new Map(participants.map((participant) => [participant.id, participant.name] as const));
  const obligations: ConflictObligationResolution[] = [];

  for (const event of events) {
    const obligation = obligationForEvent(event, events, eventById, board, participantNames);
    if (obligation) obligations.push(obligation);
  }

  const threads = board.threads.map((thread) => {
    const threadObligations = obligations.filter((item) => item.threadId === thread.id);
    return {
      threadId: thread.id,
      anchorEventId: thread.anchorEventId,
      obligations: threadObligations,
      openedCount: threadObligations.length,
      resolvedCount: threadObligations.filter((item) => item.state === "resolved").length,
      openCount: threadObligations.filter((item) => item.state === "open").length,
      trajectory: deriveTrajectory(thread.eventIds, threadObligations, eventById),
    } satisfies ConflictThreadResolution;
  });

  return {
    threads,
    obligations,
    openedCount: obligations.length,
    resolvedCount: obligations.filter((item) => item.state === "resolved").length,
    openCount: obligations.filter((item) => item.state === "open").length,
  };
}

function obligationForEvent(
  event: CouncilEvent,
  events: readonly CouncilEvent[],
  eventById: ReadonlyMap<string, CouncilEvent>,
  board: ConflictBoardModel,
  participantNames: ReadonlyMap<string, string>,
): ConflictObligationResolution | null {
  if (event.kind !== "question" && event.kind !== "challenge" && event.kind !== "evidence" && event.kind !== "uncertain") {
    return null;
  }

  const kind: OpenMeetingIssueKind = event.kind === "question"
    ? "open_question"
    : event.kind === "challenge"
      ? "challenged_claim"
      : event.kind === "evidence"
        ? "evidence_awaiting_response"
        : "explicit_uncertainty";
  const target = event.kind === "uncertain" ? undefined : directPeerRequestTarget(event, eventById);
  const resolver = firstResolver(event, events, target?.actorId);
  const threadId = board.eventThreadIds[event.id] ?? `conflict:${event.id}`;

  return {
    id: `${kind}:${event.id}`,
    threadId,
    kind,
    sourceEventId: event.id,
    sourceActorId: event.actorId,
    sourceActorName: actorName(participantNames, event.actorId),
    openedRound: event.round,
    ...(target ? {
      targetActorId: target.actorId,
      targetActorName: actorName(participantNames, target.actorId),
    } : {}),
    state: resolver ? "resolved" : "open",
    ...(resolver ? {
      resolvedByEventId: resolver.id,
      resolverActorId: resolver.actorId,
      resolverActorName: actorName(participantNames, resolver.actorId),
      resolvedRound: resolver.round,
    } : {}),
  };
}

function firstResolver(
  source: CouncilEvent,
  events: readonly CouncilEvent[],
  targetActorId?: string,
): CouncilEvent | undefined {
  const sourceIndex = events.findIndex((event) => event.id === source.id);
  if (sourceIndex < 0) return undefined;

  for (const candidate of events.slice(sourceIndex + 1)) {
    if (source.kind === "question") {
      if (!explicitlyAnswersRequest(candidate, source.id)) continue;
      if (targetActorId ? candidate.actorId === targetActorId : candidate.actorId !== source.actorId) return candidate;
      continue;
    }

    if (source.kind === "challenge") {
      if (targetActorId && candidate.actorId === targetActorId && explicitlyAnswersRequest(candidate, source.id)) return candidate;
      continue;
    }

    if (source.kind === "evidence") {
      if (targetActorId) {
        if (candidate.actorId === targetActorId && explicitlyAnswersRequest(candidate, source.id)) return candidate;
      } else if (candidate.actorId !== source.actorId && eventReferences(candidate).includes(source.id)) {
        return candidate;
      }
      continue;
    }

    if (source.kind === "uncertain" && candidate.actorId === source.actorId) {
      if (
        candidate.kind === "revision"
        && candidate.confidence > source.confidence
        && (candidate.causedBy ?? []).some((eventId) => eventId !== source.id)
      ) return candidate;
      if (
        candidate.kind === "final_position"
        && candidate.confidence > source.confidence
        && normalize(candidate.stance) !== "uncertain"
      ) return candidate;
    }
  }
  return undefined;
}

function deriveTrajectory(
  threadEventIds: readonly string[],
  obligations: readonly ConflictObligationResolution[],
  eventById: ReadonlyMap<string, CouncilEvent>,
): ConflictRoundTrajectory[] {
  const threadEvents = threadEventIds
    .map((eventId) => eventById.get(eventId))
    .filter((event): event is CouncilEvent => Boolean(event));
  const rounds = [...new Set([
    ...threadEvents.map((event) => event.round),
    ...obligations.map((item) => item.openedRound),
    ...obligations.flatMap((item) => item.resolvedRound == null ? [] : [item.resolvedRound]),
  ])].sort((a, b) => a - b);

  return rounds.map((round) => {
    const eventsThisRound = threadEvents.filter((event) => event.round === round);
    const opened = obligations.filter((item) => item.openedRound === round);
    const resolved = obligations.filter((item) => item.resolvedRound === round);
    const movements = eventsThisRound.filter((event) => event.kind === "revision" || event.kind === "concede");
    const openAtEnd = obligations.filter((item) =>
      item.openedRound <= round && (item.resolvedRound == null || item.resolvedRound > round),
    ).length;
    return {
      round,
      eventCount: eventsThisRound.length,
      openedCount: opened.length,
      resolvedCount: resolved.length,
      openAtEnd,
      movementCount: movements.length,
      eventIds: eventsThisRound.map((event) => event.id),
      openedEventIds: opened.map((item) => item.sourceEventId),
      resolvedByEventIds: resolved.flatMap((item) => item.resolvedByEventId ? [item.resolvedByEventId] : []),
      movementEventIds: movements.map((event) => event.id),
    };
  });
}

function actorName(names: ReadonlyMap<string, string>, actorId: string): string {
  return names.get(actorId) ?? actorId;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}
