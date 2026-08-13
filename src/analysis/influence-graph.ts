import type {
  CouncilEvent,
  CouncilParticipant,
  RevisionEvent,
} from "../core/types.js";

export type InfluenceStrength = "strong" | "interaction";

export type InfluenceEdgeKind =
  | "changed_mind"
  | "conceded"
  | "challenge"
  | "evidence"
  | "support"
  | "defense";

export interface StanceTransition {
  actorId: string;
  fromStance: string | null;
  toStance: string;
  revisionEventId: string;
  causedByEventIds: string[];
}

export interface InfluenceEdge {
  id: string;
  fromActorId: string;
  toActorId: string;
  kind: InfluenceEdgeKind;
  strength: InfluenceStrength;
  count: number;
  triggerEventIds: string[];
  provenanceEventIds: string[];
  rounds: number[];
  transitions: StanceTransition[];
}

export interface InfluenceNode {
  participant: CouncilParticipant;
  outgoingStrong: number;
  incomingStrong: number;
  outgoingInteractions: number;
  incomingInteractions: number;
  revisions: number;
  concessions: number;
  incomingChallenges: number;
  evidenceShared: number;
}

export interface InfluenceAward {
  actorId: string;
  score: number;
  provenanceEventIds: string[];
}

export interface InfluenceAwards {
  mostInfluential: InfluenceAward | null;
  mostOpenMinded: InfluenceAward | null;
  mostChallenged: InfluenceAward | null;
  evidenceBroker: InfluenceAward | null;
}

export interface InfluenceGraph {
  nodes: InfluenceNode[];
  edges: InfluenceEdge[];
  transitions: StanceTransition[];
  brokenReferences: string[];
  awards: InfluenceAwards;
}

interface RawEdge {
  fromActorId: string;
  toActorId: string;
  kind: InfluenceEdgeKind;
  strength: InfluenceStrength;
  triggerEventId: string;
  provenanceEventIds: string[];
  round: number;
  transition?: StanceTransition;
}

const INTERACTION_KINDS = new Set<InfluenceEdgeKind>([
  "challenge",
  "evidence",
  "support",
  "defense",
]);

export function buildInfluenceGraph(
  events: readonly CouncilEvent[],
  participants: readonly CouncilParticipant[],
): InfluenceGraph {
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const rawEdges: RawEdge[] = [];
  const transitions: StanceTransition[] = [];
  const brokenReferences = new Set<string>();

  for (const event of events) {
    switch (event.kind) {
      case "challenge":
      case "support":
      case "defense": {
        const target = eventsById.get(event.targetEventId);
        if (!target) {
          brokenReferences.add(event.targetEventId);
          break;
        }
        pushInteraction(rawEdges, event, target.actorId, event.kind);
        break;
      }
      case "evidence": {
        if (!event.targetEventId) break;
        const target = eventsById.get(event.targetEventId);
        if (!target) {
          brokenReferences.add(event.targetEventId);
          break;
        }
        pushInteraction(rawEdges, event, target.actorId, "evidence");
        break;
      }
      case "concede": {
        const target = eventsById.get(event.targetEventId);
        if (!target) {
          brokenReferences.add(event.targetEventId);
          break;
        }
        if (target.actorId === event.actorId) break;
        rawEdges.push({
          fromActorId: target.actorId,
          toActorId: event.actorId,
          kind: "conceded",
          strength: "strong",
          triggerEventId: event.id,
          provenanceEventIds: unique([event.targetEventId, event.id]),
          round: event.round,
        });
        break;
      }
      case "revision": {
        const transition = stanceTransition(event, eventsById, brokenReferences);
        transitions.push(transition);
        for (const causeId of event.causedBy ?? []) {
          const cause = eventsById.get(causeId);
          if (!cause) {
            brokenReferences.add(causeId);
            continue;
          }
          if (cause.actorId === event.actorId) continue;
          rawEdges.push({
            fromActorId: cause.actorId,
            toActorId: event.actorId,
            kind: "changed_mind",
            strength: "strong",
            triggerEventId: event.id,
            provenanceEventIds: unique([
              causeId,
              event.previousEventId,
              event.id,
            ]),
            round: event.round,
            transition,
          });
        }
        break;
      }
    }
  }

  const edges = aggregateEdges(rawEdges);
  const participantMap = new Map(
    participants.map((participant) => [participant.id, participant]),
  );
  for (const event of events) {
    if (!participantMap.has(event.actorId)) {
      participantMap.set(event.actorId, {
        id: event.actorId,
        name: event.actorId,
        provider: "unknown",
      });
    }
  }

  const nodes = [...participantMap.values()].map((participant) =>
    summarizeNode(participant, events, edges),
  );

  return {
    nodes,
    edges,
    transitions,
    brokenReferences: [...brokenReferences].sort(),
    awards: buildAwards(nodes, edges, events),
  };
}

function pushInteraction(
  rawEdges: RawEdge[],
  event: Extract<CouncilEvent, { kind: "challenge" | "support" | "defense" }> | Extract<CouncilEvent, { kind: "evidence" }>,
  targetActorId: string,
  kind: "challenge" | "support" | "defense" | "evidence",
): void {
  if (targetActorId === event.actorId) return;
  const targetEventId = "targetEventId" in event ? event.targetEventId : undefined;
  rawEdges.push({
    fromActorId: event.actorId,
    toActorId: targetActorId,
    kind,
    strength: "interaction",
    triggerEventId: event.id,
    provenanceEventIds: unique([
      ...(targetEventId ? [targetEventId] : []),
      event.id,
    ]),
    round: event.round,
  });
}

function stanceTransition(
  event: RevisionEvent,
  eventsById: ReadonlyMap<string, CouncilEvent>,
  brokenReferences: Set<string>,
): StanceTransition {
  const previous = eventsById.get(event.previousEventId);
  if (!previous) brokenReferences.add(event.previousEventId);
  const fromStance =
    previous && "stance" in previous && typeof previous.stance === "string"
      ? previous.stance
      : null;
  return {
    actorId: event.actorId,
    fromStance,
    toStance: event.stance,
    revisionEventId: event.id,
    causedByEventIds: [...(event.causedBy ?? [])],
  };
}

function aggregateEdges(rawEdges: readonly RawEdge[]): InfluenceEdge[] {
  const grouped = new Map<string, InfluenceEdge>();
  for (const raw of rawEdges) {
    const key = [
      raw.fromActorId,
      raw.toActorId,
      raw.kind,
      raw.strength,
    ].join("::");
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        id: `influence:${key}`,
        fromActorId: raw.fromActorId,
        toActorId: raw.toActorId,
        kind: raw.kind,
        strength: raw.strength,
        count: 1,
        triggerEventIds: [raw.triggerEventId],
        provenanceEventIds: [...raw.provenanceEventIds],
        rounds: [raw.round],
        transitions: raw.transition ? [raw.transition] : [],
      });
      continue;
    }
    current.count += 1;
    current.triggerEventIds = unique([
      ...current.triggerEventIds,
      raw.triggerEventId,
    ]);
    current.provenanceEventIds = unique([
      ...current.provenanceEventIds,
      ...raw.provenanceEventIds,
    ]);
    current.rounds = uniqueNumbers([...current.rounds, raw.round]);
    if (raw.transition) {
      current.transitions = uniqueTransitions([
        ...current.transitions,
        raw.transition,
      ]);
    }
  }
  return [...grouped.values()].sort((a, b) =>
    edgeSortKey(a).localeCompare(edgeSortKey(b)),
  );
}

function summarizeNode(
  participant: CouncilParticipant,
  events: readonly CouncilEvent[],
  edges: readonly InfluenceEdge[],
): InfluenceNode {
  const ownEvents = events.filter((event) => event.actorId === participant.id);
  const outgoing = edges.filter((edge) => edge.fromActorId === participant.id);
  const incoming = edges.filter((edge) => edge.toActorId === participant.id);
  return {
    participant,
    outgoingStrong: sumCounts(
      outgoing.filter((edge) => edge.strength === "strong"),
    ),
    incomingStrong: sumCounts(
      incoming.filter((edge) => edge.strength === "strong"),
    ),
    outgoingInteractions: sumCounts(
      outgoing.filter((edge) => edge.strength === "interaction"),
    ),
    incomingInteractions: sumCounts(
      incoming.filter((edge) => edge.strength === "interaction"),
    ),
    revisions: ownEvents.filter((event) => event.kind === "revision").length,
    concessions: ownEvents.filter((event) => event.kind === "concede").length,
    incomingChallenges: sumCounts(
      incoming.filter((edge) => edge.kind === "challenge"),
    ),
    evidenceShared: sumCounts(
      outgoing.filter((edge) => edge.kind === "evidence"),
    ),
  };
}

function buildAwards(
  nodes: readonly InfluenceNode[],
  edges: readonly InfluenceEdge[],
  events: readonly CouncilEvent[],
): InfluenceAwards {
  return {
    mostInfluential: awardFromScores(
      nodes.map((node) => ({
        actorId: node.participant.id,
        score: node.outgoingStrong,
        provenanceEventIds: edges
          .filter(
            (edge) =>
              edge.fromActorId === node.participant.id &&
              edge.strength === "strong",
          )
          .flatMap((edge) => edge.triggerEventIds),
      })),
    ),
    mostOpenMinded: awardFromScores(
      nodes.map((node) => ({
        actorId: node.participant.id,
        score: node.revisions + node.concessions,
        provenanceEventIds: events
          .filter(
            (event) =>
              event.actorId === node.participant.id &&
              (event.kind === "revision" || event.kind === "concede"),
          )
          .map((event) => event.id),
      })),
    ),
    mostChallenged: awardFromScores(
      nodes.map((node) => ({
        actorId: node.participant.id,
        score: node.incomingChallenges,
        provenanceEventIds: edges
          .filter(
            (edge) =>
              edge.toActorId === node.participant.id &&
              edge.kind === "challenge",
          )
          .flatMap((edge) => edge.triggerEventIds),
      })),
    ),
    evidenceBroker: awardFromScores(
      nodes.map((node) => ({
        actorId: node.participant.id,
        score: node.evidenceShared,
        provenanceEventIds: edges
          .filter(
            (edge) =>
              edge.fromActorId === node.participant.id &&
              edge.kind === "evidence",
          )
          .flatMap((edge) => edge.triggerEventIds),
      })),
    ),
  };
}

function awardFromScores(candidates: readonly InfluenceAward[]): InfluenceAward | null {
  const bestScore = Math.max(0, ...candidates.map((candidate) => candidate.score));
  if (bestScore <= 0) return null;
  const winners = candidates
    .filter((candidate) => candidate.score === bestScore)
    .sort((a, b) => a.actorId.localeCompare(b.actorId));
  if (winners.length !== 1) return null;
  const winner = winners[0]!;
  return {
    actorId: winner.actorId,
    score: winner.score,
    provenanceEventIds: unique(winner.provenanceEventIds),
  };
}

function sumCounts(edges: readonly InfluenceEdge[]): number {
  return edges.reduce((sum, edge) => sum + edge.count, 0);
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function uniqueNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function uniqueTransitions(values: readonly StanceTransition[]): StanceTransition[] {
  const seen = new Set<string>();
  return values.filter((transition) => {
    if (seen.has(transition.revisionEventId)) return false;
    seen.add(transition.revisionEventId);
    return true;
  });
}

function edgeSortKey(edge: InfluenceEdge): string {
  return [
    edge.strength === "strong" ? "0" : "1",
    edge.fromActorId,
    edge.toActorId,
    edge.kind,
  ].join("::");
}

export function influenceEdgeLabel(edge: InfluenceEdge): string {
  switch (edge.kind) {
    case "changed_mind":
      return "changed mind";
    case "conceded":
      return "conceded";
    case "challenge":
      return "challenged";
    case "evidence":
      return "evidence";
    case "support":
      return "supported";
    case "defense":
      return "defended";
  }
}

export function isStrongInfluence(edge: InfluenceEdge): boolean {
  return edge.strength === "strong";
}

export function isInteractionInfluence(edge: InfluenceEdge): boolean {
  return INTERACTION_KINDS.has(edge.kind);
}
