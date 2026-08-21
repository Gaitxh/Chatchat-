import type {
  CouncilEvent,
  CouncilParticipant,
  CouncilParticipantTurnUpdate,
  CouncilPhaseUpdate,
} from "../core/types.js";
import {
  deriveDirectResponseReceipts,
  type DirectResponseReceipt,
} from "../consultation/direct-response-receipts.js";
import type { DirectPeerRequestKind } from "../consultation/structured-response.js";

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
 * Converts the canonical direct-response receipt ledger into the live response
 * queue. Theater owns only presentation state (queued/responding/turn_failed/
 * unresolved). Whether a request is actually answered, and by which exact event,
 * comes from the same receipt truth used by Open Issues, Provider Inbox and the
 * Orchestrator. The UI never re-infers closure from prose or its own rules.
 */
export function buildPeerExchangeModel(
  participants: readonly CouncilParticipant[],
  events: readonly CouncilEvent[],
  activities: Readonly<Record<string, CouncilParticipantTurnUpdate>>,
  phase: CouncilPhaseUpdate | null,
): PeerExchangeModel {
  const participantById = new Map(participants.map((participant) => [participant.id, participant] as const));
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const items = deriveDirectResponseReceipts(events)
    .flatMap((receipt): PeerExchangeItem[] => {
      const request = eventById.get(receipt.requestEventId);
      if (!request) return [];
      if (!participantById.has(receipt.fromActorId) || !participantById.has(receipt.targetActorId)) return [];
      return [receiptItem(receipt, request, eventById, participantById, activities, phase)];
    });

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

function receiptItem(
  receipt: DirectResponseReceipt,
  request: CouncilEvent,
  eventById: ReadonlyMap<string, CouncilEvent>,
  participantById: ReadonlyMap<string, CouncilParticipant>,
  activities: Readonly<Record<string, CouncilParticipantTurnUpdate>>,
  phase: CouncilPhaseUpdate | null,
): PeerExchangeItem {
  const targetEventId = (request.kind === "challenge" || request.kind === "evidence")
    ? request.targetEventId
    : undefined;
  const targetEvent = targetEventId ? eventById.get(targetEventId) : undefined;
  const response = receipt.responseEventId ? eventById.get(receipt.responseEventId) : undefined;
  const state: PeerExchangeState = receipt.status === "answered"
    ? "answered"
    : derivePendingState(receipt.targetActorId, receipt.requestRound, activities, phase);

  return {
    requestEventId: receipt.requestEventId,
    requestKind: receipt.requestKind,
    requestRound: receipt.requestRound,
    requestActorId: receipt.fromActorId,
    requestActorName: participantById.get(receipt.fromActorId)?.name ?? receipt.fromActorId,
    targetActorId: receipt.targetActorId,
    targetActorName: participantById.get(receipt.targetActorId)?.name ?? receipt.targetActorId,
    requestContent: compact(eventText(request), 220),
    ...(targetEventId ? { targetEventId } : {}),
    ...(targetEvent ? { targetExcerpt: compact(eventText(targetEvent), 160) } : {}),
    state,
    ...(response ? {
      responseEventId: response.id,
      responseKind: response.kind,
      responseExcerpt: compact(eventText(response), 220),
      responseRound: response.round,
    } : {}),
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
