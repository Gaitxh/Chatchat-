import type {
  CouncilEvent,
  CouncilParticipant,
} from "../core/types.js";

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
}

export function deriveOpenMeetingIssues(
  participants: readonly CouncilParticipant[],
  events: readonly CouncilEvent[],
): OpenMeetingIssue[] {
  const byId = new Map(events.map((event) => [event.id, event] as const));
  const participantNames = new Map(participants.map((participant) => [participant.id, participant.name] as const));
  const result: OpenMeetingIssue[] = [];

  for (const event of events) {
    if (event.kind === "question") {
      const responses = laterEvents(events, event).filter((candidate) => references(candidate).includes(event.id));
      if (!responses.length) result.push(issue("open_question", event, participantNames, []));
      continue;
    }

    if (event.kind === "challenge") {
      const target = byId.get(event.targetEventId);
      const responses = laterEvents(events, event).filter((candidate) => challengeResponse(candidate, event));
      if (!responses.length) {
        result.push(issue(
          "challenged_claim",
          event,
          participantNames,
          target ? [target.id] : [event.targetEventId],
          target
            ? `${actor(participantNames, event.actorId)} challenged ${actor(participantNames, target.actorId)}: ${event.content}`
            : event.content,
        ));
      }
      continue;
    }

    if (event.kind === "evidence") {
      const responses = laterEvents(events, event).filter((candidate) => references(candidate).includes(event.id));
      if (!responses.length) {
        result.push(issue(
          "evidence_awaiting_response",
          event,
          participantNames,
          event.targetEventId ? [event.targetEventId] : [],
          event.claim || event.content,
        ));
      }
      continue;
    }

    if (event.kind === "uncertain") {
      const resolved = laterEvents(events, event).some((candidate) => {
        if (candidate.actorId !== event.actorId) return false;
        if (candidate.kind === "revision") return candidate.confidence > event.confidence;
        if (candidate.kind === "final_position") {
          return candidate.confidence > 0 && normalize(candidate.stance) !== "uncertain";
        }
        return false;
      });
      if (!resolved) result.push(issue("explicit_uncertainty", event, participantNames, []));
    }
  }

  return result.sort((a, b) => b.round - a.round || a.kind.localeCompare(b.kind) || a.sourceEventId.localeCompare(b.sourceEventId));
}

function issue(
  kind: OpenMeetingIssueKind,
  event: CouncilEvent,
  participantNames: ReadonlyMap<string, string>,
  relatedEventIds: readonly string[],
  content = event.content,
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
  };
}

function actor(names: ReadonlyMap<string, string>, actorId: string): string {
  return names.get(actorId) ?? actorId;
}

function laterEvents(events: readonly CouncilEvent[], source: CouncilEvent): CouncilEvent[] {
  const index = events.findIndex((event) => event.id === source.id);
  return index < 0 ? [] : events.slice(index + 1);
}

function challengeResponse(candidate: CouncilEvent, challenge: Extract<CouncilEvent, { kind: "challenge" }>): boolean {
  if (candidate.kind === "defense" || candidate.kind === "concede") {
    return candidate.targetEventId === challenge.id || candidate.targetEventId === challenge.targetEventId;
  }
  if (candidate.kind === "revision") {
    return candidate.previousEventId === challenge.targetEventId
      || candidate.causedBy?.includes(challenge.id) === true
      || candidate.causedBy?.includes(challenge.targetEventId) === true;
  }
  if (candidate.kind === "evidence") {
    return candidate.targetEventId === challenge.id || candidate.targetEventId === challenge.targetEventId;
  }
  return false;
}

export function references(event: CouncilEvent): string[] {
  if (event.kind === "challenge" || event.kind === "support" || event.kind === "defense" || event.kind === "concede") {
    return [event.targetEventId];
  }
  if (event.kind === "evidence") return event.targetEventId ? [event.targetEventId] : [];
  if (event.kind === "revision") return [event.previousEventId, ...(event.causedBy ?? [])];
  return [];
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}
