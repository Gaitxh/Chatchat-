import type { CouncilEvent, CouncilParticipant } from "../core/types.js";

export const EVIDENCE_VERIFICATIONS_STORAGE_KEY = "chatchat.evidence.verifications.v1";

export type EvidenceSourceState =
  | "not_checked"
  | "reachable"
  | "unavailable"
  | "unsupported";

export interface EvidenceVerificationSnapshot {
  state: Exclude<EvidenceSourceState, "not_checked">;
  observedAt: string;
  requestedUrl?: string;
  finalUrl?: string;
  statusCode?: number;
  contentType?: string;
  title?: string;
  description?: string;
  excerpt?: string;
  pageDate?: string;
  pageDateKind?: "published" | "modified" | "page";
  bodyHash?: string;
  textCharacters?: number;
  bytesRead?: number;
  truncated?: boolean;
  error?: string;
}

export interface EvidenceRecord {
  evidenceEventId: string;
  actorId: string;
  actorName: string;
  round: number;
  claim: string;
  content: string;
  confidence: number;
  targetEventId?: string;
  targetActorId?: string;
  sourceUrl?: string;
  sourceHost?: string;
  sourceDate?: string;
  challengeEventIds: string[];
  challengedByActorIds: string[];
  downstreamRevisionEventIds: string[];
  downstreamReviserIds: string[];
}

export function deriveEvidenceLedger(
  participants: readonly CouncilParticipant[],
  events: readonly CouncilEvent[],
): EvidenceRecord[] {
  const participantName = new Map(participants.map((participant) => [participant.id, participant.name]));
  const byId = new Map(events.map((event) => [event.id, event]));
  const records = new Map<string, EvidenceRecord>();

  for (const event of events) {
    if (event.kind !== "evidence") continue;
    const source = safeEvidenceSource(event.source);
    const target = event.targetEventId ? byId.get(event.targetEventId) : undefined;
    records.set(event.id, {
      evidenceEventId: event.id,
      actorId: event.actorId,
      actorName: participantName.get(event.actorId) ?? event.actorId,
      round: event.round,
      claim: event.claim,
      content: event.content,
      confidence: event.confidence,
      ...(event.targetEventId ? { targetEventId: event.targetEventId } : {}),
      ...(target ? { targetActorId: target.actorId } : {}),
      ...(source ? { sourceUrl: source.url, sourceHost: source.host } : {}),
      ...(event.sourceDate ? { sourceDate: event.sourceDate } : {}),
      challengeEventIds: [],
      challengedByActorIds: [],
      downstreamRevisionEventIds: [],
      downstreamReviserIds: [],
    });
  }

  for (const event of events) {
    if (event.kind === "challenge") {
      const record = records.get(event.targetEventId);
      if (!record) continue;
      record.challengeEventIds.push(event.id);
      if (!record.challengedByActorIds.includes(event.actorId)) {
        record.challengedByActorIds.push(event.actorId);
      }
      continue;
    }

    if (event.kind === "revision") {
      for (const causeId of event.causedBy ?? []) {
        const record = records.get(causeId);
        if (!record) continue;
        record.downstreamRevisionEventIds.push(event.id);
        if (!record.downstreamReviserIds.includes(event.actorId)) {
          record.downstreamReviserIds.push(event.actorId);
        }
      }
    }
  }

  return [...records.values()].sort((a, b) => a.round - b.round || a.evidenceEventId.localeCompare(b.evidenceEventId));
}

export function evidenceDisplayState(
  record: EvidenceRecord,
  verification?: EvidenceVerificationSnapshot,
): {
  sourceState: EvidenceSourceState;
  disputed: boolean;
  changedMind: boolean;
} {
  return {
    sourceState: record.sourceUrl ? (verification?.state ?? "not_checked") : "unsupported",
    disputed: record.challengeEventIds.length > 0,
    changedMind: record.downstreamRevisionEventIds.length > 0,
  };
}

export function evidenceVerificationKey(eventId: string): string {
  return `evidence:${eventId}`;
}

export function safeEvidenceSource(value: string | undefined): { url: string; host: string } | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    url.username = "";
    url.password = "";
    return {
      url: url.toString(),
      host: url.hostname.replace(/^www\./i, ""),
    };
  } catch {
    return undefined;
  }
}
