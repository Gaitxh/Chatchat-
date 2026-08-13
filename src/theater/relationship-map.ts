import type {
  CouncilEvent,
  CouncilParticipant,
} from "../core/types.js";

export type RelationshipKind =
  | "challenge"
  | "support"
  | "defense"
  | "question"
  | "concede"
  | "evidence"
  | "influence"
  | "evidence_influence";

export interface RelationshipEdge {
  id: string;
  kind: RelationshipKind;
  fromActorId: string;
  toActorId: string;
  eventIds: string[];
  count: number;
  latestRound: number;
}

export interface RelationshipNodeStats {
  participantId: string;
  challengesSent: number;
  supportsSent: number;
  evidenceSubmitted: number;
  revisionsMade: number;
  influenceReceived: number;
}

export interface RelationshipGraph {
  edges: RelationshipEdge[];
  nodes: RelationshipNodeStats[];
}

export function deriveRelationshipGraph(
  participants: readonly CouncilParticipant[],
  events: readonly CouncilEvent[],
): RelationshipGraph {
  const participantIds = new Set(participants.map((participant) => participant.id));
  const byId = new Map<string, CouncilEvent>();
  const edges = new Map<string, RelationshipEdge>();
  const stats = new Map<string, RelationshipNodeStats>(
    participants.map((participant) => [participant.id, emptyStats(participant.id)]),
  );

  for (const event of events) {
    byId.set(event.id, event);
    if (!participantIds.has(event.actorId)) continue;
    const actorStats = stats.get(event.actorId)!;

    if (event.kind === "challenge") {
      actorStats.challengesSent += 1;
      addTargetEventEdge(edges, participantIds, byId, event, "challenge");
      continue;
    }
    if (event.kind === "support") {
      actorStats.supportsSent += 1;
      addTargetEventEdge(edges, participantIds, byId, event, "support");
      continue;
    }
    if (event.kind === "defense") {
      addTargetEventEdge(edges, participantIds, byId, event, "defense");
      continue;
    }
    if (event.kind === "concede") {
      addTargetEventEdge(edges, participantIds, byId, event, "concede");
      continue;
    }
    if (event.kind === "question" && event.targetActorId && participantIds.has(event.targetActorId)) {
      addEdge(edges, {
        kind: "question",
        fromActorId: event.actorId,
        toActorId: event.targetActorId,
        eventId: event.id,
        round: event.round,
      });
      continue;
    }
    if (event.kind === "evidence") {
      actorStats.evidenceSubmitted += 1;
      if (event.targetEventId) {
        const target = byId.get(event.targetEventId);
        if (target && participantIds.has(target.actorId) && target.actorId !== event.actorId) {
          addEdge(edges, {
            kind: "evidence",
            fromActorId: event.actorId,
            toActorId: target.actorId,
            eventId: event.id,
            round: event.round,
          });
        }
      }
      continue;
    }
    if (event.kind === "revision") {
      actorStats.revisionsMade += 1;
      for (const causeId of event.causedBy ?? []) {
        const cause = byId.get(causeId);
        if (!cause || !participantIds.has(cause.actorId) || cause.actorId === event.actorId) continue;
        const kind: RelationshipKind = cause.kind === "evidence" ? "evidence_influence" : "influence";
        addEdge(edges, {
          kind,
          fromActorId: cause.actorId,
          toActorId: event.actorId,
          eventId: event.id,
          extraEventId: cause.id,
          round: event.round,
        });
        stats.get(event.actorId)!.influenceReceived += 1;
      }
    }
  }

  return {
    edges: [...edges.values()].sort((a, b) => b.latestRound - a.latestRound || b.count - a.count),
    nodes: [...stats.values()],
  };
}

function addTargetEventEdge(
  edges: Map<string, RelationshipEdge>,
  participantIds: ReadonlySet<string>,
  byId: ReadonlyMap<string, CouncilEvent>,
  event: Extract<CouncilEvent, { kind: "challenge" | "support" | "defense" | "concede" }>,
  kind: RelationshipKind,
): void {
  const target = byId.get(event.targetEventId);
  if (!target || !participantIds.has(target.actorId) || target.actorId === event.actorId) return;
  addEdge(edges, {
    kind,
    fromActorId: event.actorId,
    toActorId: target.actorId,
    eventId: event.id,
    round: event.round,
  });
}

function addEdge(
  edges: Map<string, RelationshipEdge>,
  input: {
    kind: RelationshipKind;
    fromActorId: string;
    toActorId: string;
    eventId: string;
    round: number;
    extraEventId?: string;
  },
): void {
  const key = `${input.kind}:${input.fromActorId}:${input.toActorId}`;
  const existing = edges.get(key);
  const eventIds = [
    ...(existing?.eventIds ?? []),
    ...(input.extraEventId ? [input.extraEventId] : []),
    input.eventId,
  ];
  edges.set(key, {
    id: key,
    kind: input.kind,
    fromActorId: input.fromActorId,
    toActorId: input.toActorId,
    eventIds: [...new Set(eventIds)],
    count: (existing?.count ?? 0) + 1,
    latestRound: Math.max(existing?.latestRound ?? 0, input.round),
  });
}

function emptyStats(participantId: string): RelationshipNodeStats {
  return {
    participantId,
    challengesSent: 0,
    supportsSent: 0,
    evidenceSubmitted: 0,
    revisionsMade: 0,
    influenceReceived: 0,
  };
}
