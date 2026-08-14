import type { CouncilEvent, CouncilParticipant } from "../core/types.js";
import { buildCouncilInfluenceGraph } from "./influence.js";

export type LivePersuasionKind = "revision" | "concede";

export interface LivePersuasionMoment {
  id: string;
  kind: LivePersuasionKind;
  round: number;
  influencerActorId: string;
  influencerName: string;
  changingActorId: string;
  changingActorName: string;
  actionEventId: string;
  causeEventId: string;
  causeKind: CouncilEvent["kind"];
  causeExcerpt: string;
  actionExcerpt: string;
  fromStance: string | null;
  toStance: string | null;
}

/**
 * A live persuasion moment exists only when the canonical influence graph says
 * an interaction is strong. This keeps the live room and post-meeting Theater
 * on one provenance contract: explicit revision.causedBy or concede, never
 * semantic guesswork over prose.
 */
export function deriveLivePersuasionMoments(
  participants: readonly CouncilParticipant[],
  events: readonly CouncilEvent[],
): LivePersuasionMoment[] {
  const graph = buildCouncilInfluenceGraph(participants, events);
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const participantById = new Map(participants.map((participant) => [participant.id, participant] as const));

  return graph.edges
    .filter((edge) => edge.strength === "strong" && (edge.kind === "revision" || edge.kind === "concede"))
    .map((edge): LivePersuasionMoment | null => {
      const action = eventById.get(edge.sourceEventId);
      const causeId = edge.causedByEventId ?? edge.targetEventId;
      const cause = causeId ? eventById.get(causeId) : undefined;
      const influencer = participantById.get(edge.sourceActorId);
      const changing = participantById.get(edge.targetActorId);
      if (!action || !cause || !influencer || !changing) return null;

      return {
        id: edge.id,
        kind: edge.kind,
        round: edge.round,
        influencerActorId: influencer.id,
        influencerName: influencer.name,
        changingActorId: changing.id,
        changingActorName: changing.name,
        actionEventId: action.id,
        causeEventId: cause.id,
        causeKind: cause.kind,
        causeExcerpt: compact(eventText(cause), 180),
        actionExcerpt: compact(eventText(action), 200),
        fromStance: edge.stanceTransition?.from ?? null,
        toStance: edge.stanceTransition?.to ?? null,
      };
    })
    .filter((moment): moment is LivePersuasionMoment => Boolean(moment))
    .sort((a, b) => b.round - a.round || b.actionEventId.localeCompare(a.actionEventId));
}

function eventText(event: CouncilEvent): string {
  return event.kind === "evidence" ? `${event.claim} — ${event.content}` : event.content;
}

function compact(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}
