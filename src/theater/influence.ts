import type {
  CouncilEvent,
  CouncilEventKind,
  CouncilParticipant,
  CouncilReport,
} from "../core/types.js";

export type InfluenceStrength = "interaction" | "strong";
export type InfluenceKind =
  | "challenge"
  | "support"
  | "defense"
  | "evidence"
  | "revision"
  | "concede";

export interface StanceTransition {
  from: string | null;
  to: string;
}

export interface InfluenceEdge {
  id: string;
  sourceActorId: string;
  targetActorId: string;
  kind: InfluenceKind;
  strength: InfluenceStrength;
  sourceEventId: string;
  targetEventId: string | null;
  causedByEventId: string | null;
  stanceTransition: StanceTransition | null;
  round: number;
}

export interface AggregatedInfluenceEdge {
  id: string;
  sourceActorId: string;
  targetActorId: string;
  strength: InfluenceStrength;
  kinds: Partial<Record<InfluenceKind, number>>;
  eventIds: string[];
  strongCount: number;
  interactionCount: number;
}

export interface CouncilInfluenceNode {
  participant: CouncilParticipant;
  outgoingStrong: number;
  incomingStrong: number;
  outgoingInteractions: number;
  incomingInteractions: number;
  revisions: number;
  concessions: number;
  incomingChallenges: number;
  evidenceSubmitted: number;
}

export interface CouncilInfluenceGraph {
  edges: InfluenceEdge[];
  aggregatedEdges: AggregatedInfluenceEdge[];
  nodes: CouncilInfluenceNode[];
  unresolvedReferences: string[];
}

export type CouncilAwardKind =
  | "most_influential"
  | "most_open_minded"
  | "most_challenged"
  | "strongest_dissenter"
  | "evidence_keeper";

export interface CouncilAward {
  kind: CouncilAwardKind;
  participantId: string;
  title: string;
  icon: string;
  detail: string;
  score: number;
  provenanceEventIds: string[];
}

const TARGET_EVENT_KINDS = new Set<CouncilEventKind>([
  "challenge",
  "support",
  "defense",
  "evidence",
]);

export function buildCouncilInfluenceGraph(
  participants: readonly CouncilParticipant[],
  events: readonly CouncilEvent[],
): CouncilInfluenceGraph {
  const eventById = new Map(events.map((event) => [event.id, event]));
  const participantById = new Map(
    participants.map((participant) => [participant.id, participant]),
  );
  const edges: InfluenceEdge[] = [];
  const unresolved = new Set<string>();

  for (const event of events) {
    if (TARGET_EVENT_KINDS.has(event.kind)) {
      const targetId = targetEventId(event);
      if (!targetId) continue;
      const target = eventById.get(targetId);
      if (!target) {
        unresolved.add(targetId);
        continue;
      }
      if (target.actorId === event.actorId) continue;
      edges.push({
        id: `influence:${event.id}`,
        sourceActorId: event.actorId,
        targetActorId: target.actorId,
        kind: event.kind as Extract<InfluenceKind, "challenge" | "support" | "defense" | "evidence">,
        strength: "interaction",
        sourceEventId: event.id,
        targetEventId: target.id,
        causedByEventId: null,
        stanceTransition: null,
        round: event.round,
      });
      continue;
    }

    if (event.kind === "revision") {
      const previous = eventById.get(event.previousEventId);
      if (!previous) unresolved.add(event.previousEventId);
      const transition: StanceTransition = {
        from: stanceOf(previous),
        to: event.stance,
      };

      for (const causedById of unique(event.causedBy ?? [])) {
        const cause = eventById.get(causedById);
        if (!cause) {
          unresolved.add(causedById);
          continue;
        }
        if (cause.actorId === event.actorId) continue;
        edges.push({
          id: `influence:${event.id}:${causedById}`,
          sourceActorId: cause.actorId,
          targetActorId: event.actorId,
          kind: "revision",
          strength: "strong",
          sourceEventId: event.id,
          targetEventId: previous?.id ?? event.previousEventId,
          causedByEventId: cause.id,
          stanceTransition: transition,
          round: event.round,
        });
      }
      continue;
    }

    if (event.kind === "concede") {
      const target = eventById.get(event.targetEventId);
      if (!target) {
        unresolved.add(event.targetEventId);
        continue;
      }
      if (target.actorId === event.actorId) continue;
      edges.push({
        id: `influence:${event.id}`,
        sourceActorId: target.actorId,
        targetActorId: event.actorId,
        kind: "concede",
        strength: "strong",
        sourceEventId: event.id,
        targetEventId: target.id,
        causedByEventId: target.id,
        stanceTransition: null,
        round: event.round,
      });
    }
  }

  const knownActorIds = new Set(participants.map((participant) => participant.id));
  const filteredEdges = edges.filter(
    (edge) =>
      knownActorIds.has(edge.sourceActorId) &&
      knownActorIds.has(edge.targetActorId),
  );

  const nodes = participants.map((participant) =>
    buildNode(participant, filteredEdges, events),
  );

  return {
    edges: filteredEdges,
    aggregatedEdges: aggregateInfluenceEdges(filteredEdges),
    nodes,
    unresolvedReferences: [...unresolved],
  };
}

export function deriveCouncilAwards(
  graph: CouncilInfluenceGraph,
  events: readonly CouncilEvent[],
  report: CouncilReport | null,
): CouncilAward[] {
  const awards: CouncilAward[] = [];
  const eventById = new Map(events.map((event) => [event.id, event]));

  const influential = uniqueWinner(
    graph.nodes,
    (node) => node.outgoingStrong,
  );
  if (influential && influential.outgoingStrong > 0) {
    const provenance = graph.edges
      .filter(
        (edge) =>
          edge.sourceActorId === influential.participant.id &&
          edge.strength === "strong",
      )
      .flatMap((edge) => [edge.sourceEventId, edge.causedByEventId])
      .filter((value): value is string => Boolean(value));
    awards.push({
      kind: "most_influential",
      participantId: influential.participant.id,
      title: "Most Influential",
      icon: "🧠",
      detail: `${influential.outgoingStrong} explicit changed-mind / concede link${influential.outgoingStrong === 1 ? "" : "s"}`,
      score: influential.outgoingStrong,
      provenanceEventIds: unique(provenance),
    });
  }

  const openMinded = uniqueWinner(
    graph.nodes,
    (node) => node.revisions + node.concessions,
  );
  const openness = openMinded
    ? openMinded.revisions + openMinded.concessions
    : 0;
  if (openMinded && openness > 0) {
    const provenance = events
      .filter(
        (event) =>
          event.actorId === openMinded.participant.id &&
          (event.kind === "revision" || event.kind === "concede"),
      )
      .map((event) => event.id);
    awards.push({
      kind: "most_open_minded",
      participantId: openMinded.participant.id,
      title: "Most Open-Minded",
      icon: "🔄",
      detail: `${openness} explicit revision / concession event${openness === 1 ? "" : "s"}`,
      score: openness,
      provenanceEventIds: provenance,
    });
  }

  const challenged = uniqueWinner(
    graph.nodes,
    (node) => node.incomingChallenges,
  );
  if (challenged && challenged.incomingChallenges > 0) {
    const provenance = graph.edges
      .filter(
        (edge) =>
          edge.targetActorId === challenged.participant.id &&
          edge.kind === "challenge",
      )
      .map((edge) => edge.sourceEventId);
    awards.push({
      kind: "most_challenged",
      participantId: challenged.participant.id,
      title: "Most Challenged",
      icon: "⚔️",
      detail: `${challenged.incomingChallenges} incoming challenge${challenged.incomingChallenges === 1 ? "" : "s"}`,
      score: challenged.incomingChallenges,
      provenanceEventIds: provenance,
    });
  }

  const evidenceKeeper = uniqueWinner(
    graph.nodes,
    (node) => node.evidenceSubmitted,
  );
  if (evidenceKeeper && evidenceKeeper.evidenceSubmitted > 0) {
    const provenance = events
      .filter(
        (event) =>
          event.actorId === evidenceKeeper.participant.id &&
          event.kind === "evidence",
      )
      .map((event) => event.id);
    awards.push({
      kind: "evidence_keeper",
      participantId: evidenceKeeper.participant.id,
      title: "Evidence Keeper",
      icon: "📎",
      detail: `${evidenceKeeper.evidenceSubmitted} evidence event${evidenceKeeper.evidenceSubmitted === 1 ? "" : "s"} submitted`,
      score: evidenceKeeper.evidenceSubmitted,
      provenanceEventIds: provenance,
    });
  }

  const dissenters = new Set(
    report?.disagreements.map((position) => position.participant.id) ?? [],
  );
  const dissenter = uniqueWinner(
    graph.nodes.filter((node) => dissenters.has(node.participant.id)),
    (node) => node.incomingInteractions + node.outgoingInteractions,
  );
  if (dissenter) {
    const score = dissenter.incomingInteractions + dissenter.outgoingInteractions;
    const provenance = graph.edges
      .filter(
        (edge) =>
          edge.sourceActorId === dissenter.participant.id ||
          edge.targetActorId === dissenter.participant.id,
      )
      .map((edge) => edge.sourceEventId)
      .filter((id) => eventById.has(id));
    awards.push({
      kind: "strongest_dissenter",
      participantId: dissenter.participant.id,
      title: "Strongest Dissenter",
      icon: "🛡️",
      detail: score > 0
        ? `${score} traceable interaction${score === 1 ? "" : "s"} while ending in the minority`
        : "Final minority position preserved",
      score,
      provenanceEventIds: unique(provenance),
    });
  }

  return awards;
}

export function aggregateInfluenceEdges(
  edges: readonly InfluenceEdge[],
): AggregatedInfluenceEdge[] {
  const groups = new Map<string, AggregatedInfluenceEdge>();
  for (const edge of edges) {
    const key = `${edge.sourceActorId}->${edge.targetActorId}:${edge.strength}`;
    const current = groups.get(key) ?? {
      id: `aggregate:${key}`,
      sourceActorId: edge.sourceActorId,
      targetActorId: edge.targetActorId,
      strength: edge.strength,
      kinds: {},
      eventIds: [],
      strongCount: 0,
      interactionCount: 0,
    };
    current.kinds[edge.kind] = (current.kinds[edge.kind] ?? 0) + 1;
    current.eventIds.push(edge.sourceEventId);
    if (edge.causedByEventId) current.eventIds.push(edge.causedByEventId);
    if (edge.strength === "strong") current.strongCount += 1;
    else current.interactionCount += 1;
    groups.set(key, current);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    eventIds: unique(group.eventIds),
  }));
}

function buildNode(
  participant: CouncilParticipant,
  edges: readonly InfluenceEdge[],
  events: readonly CouncilEvent[],
): CouncilInfluenceNode {
  const outgoing = edges.filter(
    (edge) => edge.sourceActorId === participant.id,
  );
  const incoming = edges.filter(
    (edge) => edge.targetActorId === participant.id,
  );
  return {
    participant,
    outgoingStrong: outgoing.filter((edge) => edge.strength === "strong").length,
    incomingStrong: incoming.filter((edge) => edge.strength === "strong").length,
    outgoingInteractions: outgoing.filter(
      (edge) => edge.strength === "interaction",
    ).length,
    incomingInteractions: incoming.filter(
      (edge) => edge.strength === "interaction",
    ).length,
    revisions: events.filter(
      (event) => event.actorId === participant.id && event.kind === "revision",
    ).length,
    concessions: events.filter(
      (event) => event.actorId === participant.id && event.kind === "concede",
    ).length,
    incomingChallenges: incoming.filter((edge) => edge.kind === "challenge").length,
    evidenceSubmitted: events.filter(
      (event) => event.actorId === participant.id && event.kind === "evidence",
    ).length,
  };
}

function targetEventId(event: CouncilEvent): string | null {
  if (
    event.kind === "challenge" ||
    event.kind === "support" ||
    event.kind === "defense"
  ) {
    return event.targetEventId;
  }
  if (event.kind === "evidence") return event.targetEventId ?? null;
  return null;
}

function stanceOf(event: CouncilEvent | undefined): string | null {
  if (!event) return null;
  if (
    event.kind === "argument" ||
    event.kind === "revision" ||
    event.kind === "final_position"
  ) {
    return event.stance;
  }
  return null;
}

function uniqueWinner<T>(
  values: readonly T[],
  score: (value: T) => number,
): T | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => score(b) - score(a));
  const best = sorted[0]!;
  if (score(best) <= 0) return best;
  if (sorted.length > 1 && score(sorted[1]!) === score(best)) return null;
  return best;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
