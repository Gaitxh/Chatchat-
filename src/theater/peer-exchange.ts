import type {
  CouncilEvent,
  CouncilParticipant,
  CouncilParticipantTurnUpdate,
  CouncilPhaseUpdate,
} from "../core/types.js";
import {
  directPeerRequestTarget,
  explicitlyAnswersRequest,
  type DirectPeerRequestKind,
} from "../consultation/structured-response.js";

export type PeerExchangeRequestKind = DirectPeerRequestKind;
export type PeerExchangeState = "queued" | "responding" | "answered" | "turn_failed" | "unresolved";

export interface PeerExchangeItem {
  requestEventId: string;
  requestKind: PeerExchangeRequestKind;
  requestRound: number;
  requestActorId: string;
  requestActorName: string;
  targetActorId: string;
  targetActorName: string;
  requestContent: string;
  targetEventId?: string;
  targetExcerpt?: string;
  state: PeerExchangeState;
  responseEventId?: string;
  responseKind?: CouncilEvent["kind"];
  responseExcerpt?: string;
  responseRound?: number;
}

export interface PeerExchangeModel {
  items: PeerExchangeItem[];
  pendingCount: number;
  respondingCount: number;
  answeredCount: number;
  unresolvedCount: number;
}

/**
 * Converts explicit public peer-directed events into a response queue. A request
 * becomes answered only when a later structured event from the target participant
 * explicitly cites the request. Topical prose is intentionally ignored.
 */
export function buildPeerExchangeModel(
  participants: readonly CouncilParticipant[],
  events: readonly CouncilEvent[],
  activities: Readonly<Record<string, CouncilParticipantTurnUpdate>>,
  phase: CouncilPhaseUpdate | null,
): PeerExchangeModel {
  const participantById = new Map(participants.map((participant) => [participant.id, participant] as const));
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const eventIndex = new Map(events.map((event, index) => [event.id, index] as const));
  const items: PeerExchangeItem[] = [];

  for (const request of events) {
    const target = directPeerRequestTarget(request, eventById);
    if (!target || target.actorId === request.actorId) continue;
    if (!participantById.has(request.actorId) || !participantById.has(target.actorId)) continue;

    const requestIndex = eventIndex.get(request.id) ?? -1;
    const response = events.slice(requestIndex + 1).find((candidate) =>
      candidate.actorId === target.actorId && explicitlyAnswersRequest(candidate, request.id),
    );
    const state = response
      ? "answered"
      : derivePendingState(target.actorId, request.round, activities, phase);

    const targetEvent = target.targetEventId ? eventById.get(target.targetEventId) : undefined;
    items.push({
      requestEventId: request.id,
      requestKind: target.kind,
      requestRound: request.round,
      requestActorId: request.actorId,
      requestActorName: participantById.get(request.actorId)?.name ?? request.actorId,
      targetActorId: target.actorId,
      targetActorName: participantById.get(target.actorId)?.name ?? target.actorId,
      requestContent: compact(eventText(request), 220),
      ...(target.targetEventId ? { targetEventId: target.targetEventId } : {}),
      ...(targetEvent ? { targetExcerpt: compact(eventText(targetEvent), 160) } : {}),
      state,
      ...(response ? {
        responseEventId: response.id,
        responseKind: response.kind,
        responseExcerpt: compact(eventText(response), 220),
        responseRound: response.round,
      } : {}),
    });
  }

  items.sort((a, b) => {
    const stateRank = (state: PeerExchangeState) => state === "responding" ? 0 : state === "queued" ? 1 : state === "turn_failed" ? 2 : state === "unresolved" ? 3 : 4;
    return stateRank(a.state) - stateRank(b.state) || b.requestRound - a.requestRound;
  });

  return {
    items,
    pendingCount: items.filter((item) => item.state === "queued" || item.state === "turn_failed").length,
    respondingCount: items.filter((item) => item.state === "responding").length,
    answeredCount: items.filter((item) => item.state === "answered").length,
    unresolvedCount: items.filter((item) => item.state === "unresolved").length,
  };
}

function derivePendingState(
  targetActorId: string,
  requestRound: number,
  activities: Readonly<Record<string, CouncilParticipantTurnUpdate>>,
  phase: CouncilPhaseUpdate | null,
): PeerExchangeState {
  if (phase?.phase === "final") return "unresolved";
  const activity = activities[targetActorId];
  if (!activity || activity.phase !== "debate" || activity.round <= requestRound) return "queued";
  if (activity.state === "working") return "responding";
  if (activity.state === "failed") return "turn_failed";
  return "queued";
}

function eventText(event: CouncilEvent): string {
  return event.kind === "evidence" ? `${event.claim} — ${event.content}` : event.content;
}

function compact(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}
