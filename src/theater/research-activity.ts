import { researchLaneDefinition } from "../consultation/research-lanes.js";
import type {
  CouncilEvent,
  CouncilEventKind,
  CouncilParticipant,
  CouncilParticipantTurnUpdate,
  CouncilResearchLane,
} from "../core/types.js";

export interface ResearchEvidencePreview {
  eventId: string;
  claim: string;
  sourceHost?: string;
}

export interface ResearchActivityRow {
  participantId: string;
  participantName: string;
  lane: CouncilResearchLane;
  laneIcon: string;
  laneLabelEn: string;
  laneLabelZhCN: string;
  laneGoalEn: string;
  laneGoalZhCN: string;
  state: CouncilParticipantTurnUpdate["state"];
  phase: CouncilParticipantTurnUpdate["phase"];
  round: number;
  contributionKinds: readonly CouncilEventKind[];
  publicEventCount: number;
  evidenceCount: number;
  challengeCount: number;
  revisionCount: number;
  latestEvidence?: ResearchEvidencePreview;
}

export interface ResearchActivityModel {
  rows: ResearchActivityRow[];
  activeCount: number;
  publishedEvidenceCount: number;
}

/**
 * Builds a live research desk from public Council events and explicit turn
 * lifecycle updates. It deliberately does not expose or infer private reasoning.
 */
export function buildResearchActivity(
  participants: readonly CouncilParticipant[],
  events: readonly CouncilEvent[],
  activities: Readonly<Record<string, CouncilParticipantTurnUpdate>>,
): ResearchActivityModel {
  const rows = participants.flatMap((participant): ResearchActivityRow[] => {
    const activity = activities[participant.id];
    if (!activity?.researchLane) return [];

    const lane = researchLaneDefinition(activity.researchLane);
    const ownEvents = events.filter((event) => event.actorId === participant.id);
    const evidence = ownEvents.filter((event) => event.kind === "evidence");
    const latestEvidenceEvent = evidence.at(-1);
    const latestEvidence = latestEvidenceEvent?.kind === "evidence"
      ? evidencePreview(latestEvidenceEvent)
      : undefined;

    return [{
      participantId: participant.id,
      participantName: participant.name,
      lane: activity.researchLane,
      laneIcon: lane.icon,
      laneLabelEn: lane.en.label,
      laneLabelZhCN: lane.zhCN.label,
      laneGoalEn: lane.en.goal,
      laneGoalZhCN: lane.zhCN.goal,
      state: activity.state,
      phase: activity.phase,
      round: activity.round,
      contributionKinds: [...(activity.contributionKinds ?? [])],
      publicEventCount: ownEvents.length,
      evidenceCount: evidence.length,
      challengeCount: ownEvents.filter((event) => event.kind === "challenge").length,
      revisionCount: ownEvents.filter((event) => event.kind === "revision").length,
      ...(latestEvidence ? { latestEvidence } : {}),
    }];
  });

  return {
    rows,
    activeCount: rows.filter((row) => row.state === "working").length,
    publishedEvidenceCount: rows.reduce((sum, row) => sum + row.evidenceCount, 0),
  };
}

function evidencePreview(event: Extract<CouncilEvent, { kind: "evidence" }>): ResearchEvidencePreview {
  const sourceHost = event.source ? safeSourceHost(event.source) : undefined;
  return {
    eventId: event.id,
    claim: event.claim,
    ...(sourceHost ? { sourceHost } : {}),
  };
}

function safeSourceHost(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.hostname || undefined;
  } catch {
    return undefined;
  }
}
