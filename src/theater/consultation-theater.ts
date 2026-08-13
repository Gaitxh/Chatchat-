import type {
  CouncilEvent,
  CouncilEventKind,
  CouncilParticipant,
  CouncilReport,
} from "../core/types.js";
import type { Locale } from "../i18n/index.js";
import {
  buildCouncilInfluenceGraph,
  deriveCouncilAwards,
  type CouncilAwardKind,
  type CouncilInfluenceGraph,
  type InfluenceEdge,
  type InfluenceKind,
} from "./influence.js";

export type ConsultationReplayStage =
  | "independent"
  | "consultation"
  | "final"
  | "complete";

export interface ConsultationReplayFrame {
  cursor: number;
  stage: ConsultationReplayStage;
  event: CouncilEvent | null;
  visibleEventIds: string[];
  influenceEdgeIds: string[];
  changedMind: ConsultationChangedMindTrail | null;
}

export interface ConsultationChangedMindTrail {
  revisionEventId: string;
  participantId: string;
  participantName: string;
  fromStance: string | null;
  toStance: string;
  causedBy: Array<{
    eventId: string;
    participantId: string;
    participantName: string;
    kind: CouncilEventKind;
  }>;
  round: number;
}

export interface ConsultationHighlight {
  kind: CouncilAwardKind;
  participantId: string;
  participantName: string;
  icon: string;
  title: string;
  detail: string;
  score: number;
  provenanceEventIds: string[];
}

export interface ConsultationTheaterModel {
  graph: CouncilInfluenceGraph;
  changedMinds: ConsultationChangedMindTrail[];
  highlights: ConsultationHighlight[];
  replay: ConsultationReplayFrame[];
  summary: {
    interactionLinks: number;
    strongInfluenceLinks: number;
    changedMindCount: number;
    concessionCount: number;
    unresolvedReferenceCount: number;
  };
}

const COPY = {
  en: {
    influential: "Most Influential",
    influentialDetail: (score: number) => `${score} explicit changed-mind / concession link${score === 1 ? "" : "s"}`,
    open: "Most Open-Minded",
    openDetail: (score: number) => `${score} explicit revision / concession event${score === 1 ? "" : "s"}`,
    challenged: "Most Challenged",
    challengedDetail: (score: number) => `${score} incoming challenge${score === 1 ? "" : "s"}`,
    dissenter: "Strongest Dissenter",
    dissenterDetail: (score: number) => score > 0
      ? `${score} traceable interaction${score === 1 ? "" : "s"} while keeping a different final position`
      : "Different final position preserved",
    evidence: "Evidence Contributor",
    evidenceDetail: (score: number) => `${score} structured evidence event${score === 1 ? "" : "s"}`,
  },
  "zh-CN": {
    influential: "最具影响力",
    influentialDetail: (score: number) => `${score} 条明确促成改口 / 让步的影响关系`,
    open: "最开放的参与者",
    openDetail: (score: number) => `${score} 次明确修正 / 让步`,
    challenged: "最受质疑",
    challengedDetail: (score: number) => `${score} 次来自其他参与者的质疑`,
    dissenter: "坚定异议者",
    dissenterDetail: (score: number) => score > 0
      ? `在保持不同最终立场的同时参与了 ${score} 次可追溯互动`
      : "最终不同立场被完整保留",
    evidence: "证据贡献者",
    evidenceDetail: (score: number) => `${score} 条结构化证据事件`,
  },
} as const;

export function buildConsultationTheaterModel(
  participants: readonly CouncilParticipant[],
  events: readonly CouncilEvent[],
  report: CouncilReport | null,
  locale: Locale,
): ConsultationTheaterModel {
  const graph = buildCouncilInfluenceGraph(participants, events);
  const changedMinds = buildChangedMindTrails(participants, events, graph.edges);
  const highlights = localizeHighlights(
    deriveCouncilAwards(graph, events, report),
    participants,
    locale,
  );
  const replay = buildConsultationReplay(participants, events);

  return {
    graph,
    changedMinds,
    highlights,
    replay,
    summary: {
      interactionLinks: graph.edges.filter((edge) => edge.strength === "interaction").length,
      strongInfluenceLinks: graph.edges.filter((edge) => edge.strength === "strong").length,
      changedMindCount: changedMinds.length,
      concessionCount: events.filter((event) => event.kind === "concede").length,
      unresolvedReferenceCount: graph.unresolvedReferences.length,
    },
  };
}

export function buildChangedMindTrails(
  participants: readonly CouncilParticipant[],
  events: readonly CouncilEvent[],
  influenceEdges?: readonly InfluenceEdge[],
): ConsultationChangedMindTrail[] {
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const eventById = new Map(events.map((event) => [event.id, event]));
  const strongRevisionEdges = (influenceEdges ?? buildCouncilInfluenceGraph(participants, events).edges)
    .filter((edge) => edge.kind === "revision" && edge.strength === "strong");
  const byRevision = new Map<string, InfluenceEdge[]>();

  for (const edge of strongRevisionEdges) {
    const current = byRevision.get(edge.sourceEventId) ?? [];
    current.push(edge);
    byRevision.set(edge.sourceEventId, current);
  }

  const trails: ConsultationChangedMindTrail[] = [];
  for (const event of events) {
    if (event.kind !== "revision") continue;
    const edges = byRevision.get(event.id) ?? [];
    if (!edges.length) continue;
    const previous = eventById.get(event.previousEventId);
    const participant = participantById.get(event.actorId);
    trails.push({
      revisionEventId: event.id,
      participantId: event.actorId,
      participantName: participant?.name ?? event.actorId,
      fromStance: stanceOf(previous),
      toStance: event.stance,
      causedBy: edges.map((edge) => {
        const causeId = edge.causedByEventId ?? edge.sourceEventId;
        const cause = eventById.get(causeId);
        const causeParticipant = cause ? participantById.get(cause.actorId) : undefined;
        return {
          eventId: causeId,
          participantId: cause?.actorId ?? edge.sourceActorId,
          participantName: causeParticipant?.name ?? edge.sourceActorId,
          kind: cause?.kind ?? "uncertain",
        };
      }),
      round: event.round,
    });
  }
  return trails;
}

export function buildConsultationReplay(
  participants: readonly CouncilParticipant[],
  events: readonly CouncilEvent[],
): ConsultationReplayFrame[] {
  const frames: ConsultationReplayFrame[] = [
    {
      cursor: 0,
      stage: "independent",
      event: null,
      visibleEventIds: [],
      influenceEdgeIds: [],
      changedMind: null,
    },
  ];

  for (let index = 0; index < events.length; index += 1) {
    const visible = events.slice(0, index + 1);
    const event = events[index]!;
    const graph = buildCouncilInfluenceGraph(participants, visible);
    const changedMind = event.kind === "revision"
      ? buildChangedMindTrails(participants, visible, graph.edges)
          .find((trail) => trail.revisionEventId === event.id) ?? null
      : null;
    frames.push({
      cursor: index + 1,
      stage: replayStage(event, index === events.length - 1),
      event,
      visibleEventIds: visible.map((item) => item.id),
      influenceEdgeIds: graph.edges.map((edge) => edge.id),
      changedMind,
    });
  }

  return frames;
}

export function influenceKindLabel(kind: InfluenceKind, locale: Locale): string {
  const labels: Record<InfluenceKind, [string, string]> = {
    challenge: ["Challenge", "质疑"],
    support: ["Support", "支持"],
    defense: ["Defense", "答辩"],
    evidence: ["Evidence", "证据"],
    revision: ["Changed mind", "促成改口"],
    concede: ["Concession", "促成让步"],
  };
  const pair = labels[kind];
  return locale === "zh-CN" ? pair[1] : pair[0];
}

function localizeHighlights(
  awards: ReturnType<typeof deriveCouncilAwards>,
  participants: readonly CouncilParticipant[],
  locale: Locale,
): ConsultationHighlight[] {
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const copy = COPY[locale];
  return awards.map((award) => {
    const participantName = participantById.get(award.participantId)?.name ?? award.participantId;
    if (award.kind === "most_influential") {
      return { ...award, participantName, title: copy.influential, detail: copy.influentialDetail(award.score) };
    }
    if (award.kind === "most_open_minded") {
      return { ...award, participantName, title: copy.open, detail: copy.openDetail(award.score) };
    }
    if (award.kind === "most_challenged") {
      return { ...award, participantName, title: copy.challenged, detail: copy.challengedDetail(award.score) };
    }
    if (award.kind === "strongest_dissenter") {
      return { ...award, participantName, title: copy.dissenter, detail: copy.dissenterDetail(award.score) };
    }
    return { ...award, participantName, title: copy.evidence, detail: copy.evidenceDetail(award.score) };
  });
}

function replayStage(event: CouncilEvent, last: boolean): ConsultationReplayStage {
  if (last && event.kind === "final_position") return "complete";
  if (event.kind === "final_position") return "final";
  if (event.round <= 1) return "independent";
  return "consultation";
}

function stanceOf(event: CouncilEvent | undefined): string | null {
  if (!event) return null;
  if (event.kind === "argument" || event.kind === "revision" || event.kind === "final_position") {
    return event.stance;
  }
  return null;
}
