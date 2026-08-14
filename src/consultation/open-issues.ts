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
      const answered = laterEvents(events, event).some((candidate) => {
        if (!explicitlyAnswersRequest(candidate, event.id)) return false;
        return target ? candidate.actorId === target.actorId : candidate.actorId !== event.actorId;
      });
      if (!answered) {
        result.push(provenance(
          "open_question",
          event,
          [],
          target?.actorId,
        ));
      }
      continue;
    }

    if (event.kind === "challenge") {
      const target = directPeerRequestTarget(event, eventById);
      const answered = laterEvents(events, event).some((candidate) =>
        Boolean(target)
        && candidate.actorId === target!.actorId
        && explicitlyAnswersRequest(candidate, event.id),
      );
      if (!answered) {
        result.push(provenance(
          "challenged_claim",
          event,
          [event.targetEventId],
          target?.actorId,
        ));
      }
      continue;
    }

    if (event.kind === "evidence") {
      const target = directPeerRequestTarget(event, eventById);
      const answered = laterEvents(events, event).some((candidate) => {
        if (target) {
          return candidate.actorId === target.actorId && explicitlyAnswersRequest(candidate, event.id);
        }
        return candidate.actorId !== event.actorId && eventReferences(candidate).includes(event.id);
      });
      if (!answered) {
        result.push(provenance(
          "evidence_awaiting_response",
          event,
          event.targetEventId ? [event.targetEventId] : [],
          target?.actorId,
        ));
      }
      continue;
    }

    if (event.kind === "uncertain") {
      const resolved = laterEvents(events, event).some((candidate) => {
        if (candidate.actorId !== event.actorId) return false;
        if (candidate.kind === "revision") {
          return candidate.confidence > event.confidence
            && (candidate.causedBy ?? []).some((eventId) => eventId !== event.id);
        }
        if (candidate.kind === "final_position") {
          return candidate.confidence > event.confidence && normalize(candidate.stance) !== "uncertain";
        }
        return false;
      });
      if (!resolved) result.push(provenance("explicit_uncertainty", event, []));
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

function laterEvents(events: readonly CouncilEvent[], source: CouncilEvent): CouncilEvent[] {
  const index = events.findIndex((event) => event.id === source.id);
  return index < 0 ? [] : events.slice(index + 1);
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
