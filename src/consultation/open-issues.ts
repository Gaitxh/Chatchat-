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

export interface OpenMeetingIssue {
  id: string;
  kind: OpenMeetingIssueKind;
  sourceEventId: string;
  actorId: string;
  actorName: string;
  round: number;
  content: string;
  relatedEventIds: string[];
  targetActorId?: string;
  targetActorName?: string;
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
  const result: OpenMeetingIssue[] = [];

  for (const event of events) {
    if (event.kind === "question") {
      const target = directPeerRequestTarget(event, eventById);
      const answered = laterEvents(events, event).some((candidate) => {
        if (!explicitlyAnswersRequest(candidate, event.id)) return false;
        return target ? candidate.actorId === target.actorId : candidate.actorId !== event.actorId;
      });
      if (!answered) {
        result.push(issue(
          "open_question",
          event,
          participantNames,
          [],
          event.content,
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
        const challenged = eventById.get(event.targetEventId);
        result.push(issue(
          "challenged_claim",
          event,
          participantNames,
          [event.targetEventId],
          challenged
            ? `${actor(participantNames, event.actorId)} → ${actor(participantNames, challenged.actorId)}: ${event.content}`
            : event.content,
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
        result.push(issue(
          "evidence_awaiting_response",
          event,
          participantNames,
          event.targetEventId ? [event.targetEventId] : [],
          event.claim || event.content,
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
      if (!resolved) result.push(issue("explicit_uncertainty", event, participantNames, []));
    }
  }

  return result.sort((a, b) => b.round - a.round || issueRank(a.kind) - issueRank(b.kind) || a.sourceEventId.localeCompare(b.sourceEventId));
}

function issue(
  kind: OpenMeetingIssueKind,
  event: CouncilEvent,
  participantNames: ReadonlyMap<string, string>,
  relatedEventIds: readonly string[],
  content = event.content,
  targetActorId?: string,
): OpenMeetingIssue {
  return {
    id: `${kind}:${event.id}`,
    kind,
    sourceEventId: event.id,
    actorId: event.actorId,
    actorName: actor(participantNames, event.actorId),
    round: event.round,
    content,
    relatedEventIds: [...relatedEventIds],
    ...(targetActorId ? {
      targetActorId,
      targetActorName: actor(participantNames, targetActorId),
    } : {}),
  };
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
