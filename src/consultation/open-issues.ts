import type { CouncilEvent, CouncilParticipant } from "../core/types.js";
import {
  directPeerRequestTarget,
  eventReferences,
  explicitlyAnswersRequest,
} from "./structured-response.js";

export type OpenMeetingIssueKind =
  | "open_question"
  | "challenged_claim"
  | "evidence_awaiting_response"
  | "explicit_uncertainty";

export interface OpenMeetingIssueProvenance {
  kind: OpenMeetingIssueKind;
  sourceEventId: string;
  actorId: string;
  round: number;
  relatedEventIds: string[];
  targetActorId?: string;
}

export interface OpenMeetingIssue extends OpenMeetingIssueProvenance {
  id: string;
  actorName: string;
  content: string;
  targetActorName?: string;
}

/**
 * Canonical structural closure detector shared by Open Issues, Provider context
 * selection and the Conflict Resolution Ledger. Returning an event here is the
 * one mechanical definition of "this public obligation was explicitly closed".
 */
export function findMeetingIssueResolver(
  events: readonly CouncilEvent[],
  source: CouncilEvent,
  eventById: ReadonlyMap<string, CouncilEvent> = new Map(events.map((event) => [event.id, event] as const)),
): CouncilEvent | undefined {
  const target = source.kind === "uncertain" ? undefined : directPeerRequestTarget(source, eventById);
  const sourceIndex = events.findIndex((event) => event.id === source.id);
  if (sourceIndex < 0) return undefined;

  for (const candidate of events.slice(sourceIndex + 1)) {
    if (source.kind === "question") {
      if (!explicitlyAnswersRequest(candidate, source.id)) continue;
      if (target ? candidate.actorId === target.actorId : candidate.actorId !== source.actorId) return candidate;
      continue;
    }

    if (source.kind === "challenge") {
      if (target && candidate.actorId === target.actorId && explicitlyAnswersRequest(candidate, source.id)) return candidate;
      continue;
    }

    if (source.kind === "evidence") {
      if (target) {
        if (candidate.actorId === target.actorId && explicitlyAnswersRequest(candidate, source.id)) return candidate;
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

/**
 * Pure structural issue detection shared by UI and Provider context selection.
 * It carries ids/actors/rounds only and never needs participant names or a
 * summarizing model, so there is one canonical definition of "still open".
 */
export function deriveOpenMeetingIssueProvenance(
  events: readonly CouncilEvent[],
): OpenMeetingIssueProvenance[] {
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const result: OpenMeetingIssueProvenance[] = [];

  for (const event of events) {
    if (event.kind === "question") {
      const target = directPeerRequestTarget(event, eventById);
      if (!findMeetingIssueResolver(events, event, eventById)) {
        result.push(provenance("open_question", event, [], target?.actorId));
      }
      continue;
    }

    if (event.kind === "challenge") {
      const target = directPeerRequestTarget(event, eventById);
      if (!findMeetingIssueResolver(events, event, eventById)) {
        result.push(provenance("challenged_claim", event, [event.targetEventId], target?.actorId));
      }
      continue;
    }

    if (event.kind === "evidence") {
      const target = directPeerRequestTarget(event, eventById);
      if (!findMeetingIssueResolver(events, event, eventById)) {
        result.push(provenance(
          "evidence_awaiting_response",
          event,
          event.targetEventId ? [event.targetEventId] : [],
          target?.actorId,
        ));
      }
      continue;
    }

    if (event.kind === "uncertain" && !findMeetingIssueResolver(events, event, eventById)) {
      result.push(provenance("explicit_uncertainty", event, []));
    }
  }

  return result.sort((a, b) => b.round - a.round || issueRank(a.kind) - issueRank(b.kind) || a.sourceEventId.localeCompare(b.sourceEventId));
}

/**
 * Conservative, deterministic meeting-secretary view. It never asks an LLM
 * whether an issue "feels resolved"; only explicit public protocol edges can
 * close an item.
 */
export function deriveOpenMeetingIssues(
  participants: readonly CouncilParticipant[],
  events: readonly CouncilEvent[],
): OpenMeetingIssue[] {
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const participantNames = new Map(participants.map((participant) => [participant.id, participant.name] as const));

  return deriveOpenMeetingIssueProvenance(events).flatMap((item) => {
    const event = eventById.get(item.sourceEventId);
    if (!event) return [];
    const content = issueContent(item.kind, event, item.relatedEventIds, eventById, participantNames);
    return [{
      ...item,
      id: `${item.kind}:${item.sourceEventId}`,
      actorName: actor(participantNames, item.actorId),
      content,
      ...(item.targetActorId ? {
        targetActorName: actor(participantNames, item.targetActorId),
      } : {}),
    } satisfies OpenMeetingIssue];
  });
}

function provenance(
  kind: OpenMeetingIssueKind,
  event: CouncilEvent,
  relatedEventIds: readonly string[],
  targetActorId?: string,
): OpenMeetingIssueProvenance {
  return {
    kind,
    sourceEventId: event.id,
    actorId: event.actorId,
    round: event.round,
    relatedEventIds: [...relatedEventIds],
    ...(targetActorId ? { targetActorId } : {}),
  };
}

function issueContent(
  kind: OpenMeetingIssueKind,
  event: CouncilEvent,
  relatedEventIds: readonly string[],
  eventById: ReadonlyMap<string, CouncilEvent>,
  participantNames: ReadonlyMap<string, string>,
): string {
  if (kind === "challenged_claim" && event.kind === "challenge") {
    const challenged = relatedEventIds[0] ? eventById.get(relatedEventIds[0]) : undefined;
    return challenged
      ? `${actor(participantNames, event.actorId)} → ${actor(participantNames, challenged.actorId)}: ${event.content}`
      : event.content;
  }
  if (kind === "evidence_awaiting_response" && event.kind === "evidence") {
    return event.claim || event.content;
  }
  return event.content;
}

function actor(names: ReadonlyMap<string, string>, actorId: string): string {
  return names.get(actorId) ?? actorId;
}

function issueRank(kind: OpenMeetingIssueKind): number {
  if (kind === "open_question") return 0;
  if (kind === "challenged_claim") return 1;
  if (kind === "evidence_awaiting_response") return 2;
  return 3;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}
