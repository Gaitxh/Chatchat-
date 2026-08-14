import type {
  CouncilEvent,
  CouncilEventKind,
  CouncilParticipant,
  CouncilPhase,
} from "../core/types.js";

export interface DiscussionCause {
  eventId: string;
  actorId: string;
  actorName: string;
  kind: CouncilEventKind;
}

export interface DiscussionEntry {
  id: string;
  event: CouncilEvent;
  actorName: string;
  replyToEventId?: string;
  replyToActorId?: string;
  replyToActorName?: string;
  replyToExcerpt?: string;
  targetActorId?: string;
  targetActorName?: string;
  targetEventId?: string;
  targetExcerpt?: string;
  previousStance?: string;
  sourceHost?: string;
  causes: DiscussionCause[];
}

export interface DiscussionRound {
  round: number;
  phase: CouncilPhase;
  entries: DiscussionEntry[];
}

export interface DiscussionStreamModel {
  rounds: DiscussionRound[];
  eventCount: number;
  participantCount: number;
}

/**
 * Builds the watchable meeting transcript exclusively from structured Council events.
 * It never infers a reply, relationship, persuasion, or source from ordinary prose.
 */
export function buildDiscussionStream(
  participants: readonly CouncilParticipant[],
  events: readonly CouncilEvent[],
): DiscussionStreamModel {
  const eventById = new Map(events.map((event) => [event.id, event]));
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const finalRounds = new Set(
    events.filter((event) => event.kind === "final_position").map((event) => event.round),
  );
  const rounds = new Map<number, DiscussionRound>();

  for (const event of events) {
    const actorName = participantById.get(event.actorId)?.name ?? event.actorId;
    const replyToEventId = explicitReplyEventId(event);
    const replyToEvent = replyToEventId ? eventById.get(replyToEventId) : undefined;
    const replyToActorId = replyToEvent?.actorId;
    const replyToActorName = replyToActorId
      ? participantById.get(replyToActorId)?.name ?? replyToActorId
      : undefined;
    const targetEventId = explicitTargetEventId(event);
    const targetEvent = targetEventId ? eventById.get(targetEventId) : undefined;
    const directTargetActorId = event.kind === "question" ? event.targetActorId : undefined;
    const targetActorId = directTargetActorId ?? targetEvent?.actorId;
    const targetActorName = targetActorId
      ? participantById.get(targetActorId)?.name ?? targetActorId
      : undefined;
    const previousEvent = event.kind === "revision" ? eventById.get(event.previousEventId) : undefined;
    const sourceHost = event.kind === "evidence" && event.source
      ? safeSourceHost(event.source)
      : undefined;
    const causes = event.kind === "revision"
      ? (event.causedBy ?? []).flatMap((eventId): DiscussionCause[] => {
          const cause = eventById.get(eventId);
          if (!cause) return [];
          return [{
            eventId,
            actorId: cause.actorId,
            actorName: participantById.get(cause.actorId)?.name ?? cause.actorId,
            kind: cause.kind,
          }];
        })
      : [];

    const entry: DiscussionEntry = {
      id: event.id,
      event,
      actorName,
      causes,
      ...(replyToEventId ? { replyToEventId } : {}),
      ...(replyToActorId ? { replyToActorId } : {}),
      ...(replyToActorName ? { replyToActorName } : {}),
      ...(replyToEvent ? { replyToExcerpt: compactExcerpt(eventText(replyToEvent), 150) } : {}),
      ...(targetActorId ? { targetActorId } : {}),
      ...(targetActorName ? { targetActorName } : {}),
      ...(targetEventId ? { targetEventId } : {}),
      ...(targetEvent ? { targetExcerpt: compactExcerpt(eventText(targetEvent), 150) } : {}),
      ...(previousEvent && hasStance(previousEvent) ? { previousStance: previousEvent.stance } : {}),
      ...(sourceHost ? { sourceHost } : {}),
    };

    const phase: CouncilPhase = event.round === 1
      ? "sealed"
      : finalRounds.has(event.round) && event.kind === "final_position"
        ? "final"
        : "debate";
    const existing = rounds.get(event.round);
    if (existing) existing.entries.push(entry);
    else rounds.set(event.round, { round: event.round, phase, entries: [entry] });
  }

  return {
    rounds: [...rounds.values()].sort((a, b) => a.round - b.round),
    eventCount: events.length,
    participantCount: participants.length,
  };
}

function explicitReplyEventId(event: CouncilEvent): string | undefined {
  switch (event.kind) {
    case "argument":
    case "evidence":
    case "question":
    case "uncertain":
      return event.replyToEventId;
    default:
      return undefined;
  }
}

function explicitTargetEventId(event: CouncilEvent): string | undefined {
  switch (event.kind) {
    case "challenge":
    case "support":
    case "defense":
    case "concede":
      return event.targetEventId;
    case "evidence":
      return event.targetEventId;
    default:
      return undefined;
  }
}

function eventText(event: CouncilEvent): string {
  if (event.kind === "evidence") return event.claim || event.content;
  return event.content;
}

function hasStance(event: CouncilEvent): event is Extract<CouncilEvent, { stance: string }> {
  return event.kind === "argument" || event.kind === "revision" || event.kind === "final_position";
}

function safeSourceHost(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.hostname || undefined : undefined;
  } catch {
    return undefined;
  }
}

function compactExcerpt(value: string, max: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= max) return compact;
  return `${compact.slice(0, max - 1)}…`;
}
