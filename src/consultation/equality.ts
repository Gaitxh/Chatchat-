import type { CouncilEvent, CouncilPosition, CouncilReport } from "../core/types.js";

export const MAX_CONSULTATION_PARTICIPANTS = 8;

export interface ConsultationParticipantIdentity {
  participantId: string;
  providerId: string;
  providerName: string;
  origin: string;
  tabId: number;
}

export interface ConsultationOutcomeSummary {
  participantCount: number;
  consensusStance: string | null;
  consensusRatio: number;
  confidence: number;
  changedMindCount: number;
  minorityCount: number;
  finalPositions: CouncilPosition[];
  stanceCounts: Record<string, number>;
}

export function consultationParticipantKey(
  participant: Pick<ConsultationParticipantIdentity, "origin">,
): string {
  return normalizeOrigin(participant.origin);
}

export function canJoinConsultation(
  current: readonly ConsultationParticipantIdentity[],
  candidate: ConsultationParticipantIdentity,
): { ok: true } | { ok: false; reason: "duplicate-origin" | "capacity" } {
  if (current.length >= MAX_CONSULTATION_PARTICIPANTS) {
    return { ok: false, reason: "capacity" };
  }
  const key = consultationParticipantKey(candidate);
  if (current.some((item) => consultationParticipantKey(item) === key)) {
    return { ok: false, reason: "duplicate-origin" };
  }
  return { ok: true };
}

export function deriveConsultationOutcome(
  report: CouncilReport,
  events: readonly CouncilEvent[],
): ConsultationOutcomeSummary {
  const stanceCounts = new Map<string, { label: string; count: number }>();
  for (const position of report.positions) {
    const key = normalizeStance(position.stance);
    const current = stanceCounts.get(key);
    stanceCounts.set(key, {
      label: current?.label ?? position.stance,
      count: (current?.count ?? 0) + 1,
    });
  }

  return {
    participantCount: report.positions.length,
    consensusStance: report.consensusStance,
    consensusRatio: report.consensusRatio,
    confidence: report.confidence,
    changedMindCount: events.filter((event) => event.kind === "revision").length,
    minorityCount: report.disagreements.length,
    finalPositions: [...report.positions],
    stanceCounts: Object.fromEntries(
      [...stanceCounts.values()]
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .map((item) => [item.label, item.count]),
    ),
  };
}

export function equalParticipantDisplayName(
  providerName: string,
): string {
  return providerName.trim() || "AI";
}

function normalizeOrigin(origin: string): string {
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.hostname.toLocaleLowerCase()}${url.port ? `:${url.port}` : ""}`;
  } catch {
    return origin.trim().toLocaleLowerCase();
  }
}

function normalizeStance(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}
