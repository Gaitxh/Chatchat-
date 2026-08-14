import type { CouncilEvent, CouncilParticipant } from "../core/types.js";
import {
  deriveEvidenceLedger,
  safeEvidenceSource,
  type EvidenceVerificationSnapshot,
} from "./evidence-ledger.js";

export type EvidenceGapKind =
  | "challenged_without_evidence"
  | "evidence_without_source"
  | "source_date_missing"
  | "source_not_observed"
  | "disputed_source"
  | "evidence_changed_view";

export type EvidenceGapTone = "attention" | "open" | "resolved";

export interface EvidenceGapItem {
  id: string;
  kind: EvidenceGapKind;
  tone: EvidenceGapTone;
  actorId: string;
  actorName: string;
  round: number;
  title: string;
  detail: string;
  targetEventId?: string;
  evidenceEventId?: string;
  provenanceEventIds: string[];
}

export interface EvidenceGapRadar {
  items: EvidenceGapItem[];
  counts: {
    attention: number;
    open: number;
    resolved: number;
  };
}

export function deriveEvidenceGapRadar(
  participants: readonly CouncilParticipant[],
  events: readonly CouncilEvent[],
  verifications: Readonly<Record<string, EvidenceVerificationSnapshot>> = {},
): EvidenceGapRadar {
  const byId = new Map(events.map((event) => [event.id, event]));
  const nameById = new Map(participants.map((participant) => [participant.id, participant.name]));
  const evidenceRecords = deriveEvidenceLedger(participants, events);
  const evidenceByTarget = new Map<string, string[]>();

  for (const record of evidenceRecords) {
    if (!record.targetEventId) continue;
    const current = evidenceByTarget.get(record.targetEventId) ?? [];
    current.push(record.evidenceEventId);
    evidenceByTarget.set(record.targetEventId, current);
  }

  const items: EvidenceGapItem[] = [];

  for (const event of events) {
    if (event.kind !== "challenge") continue;
    const target = byId.get(event.targetEventId);
    if (!target || target.kind === "evidence") continue;
    if ((evidenceByTarget.get(event.targetEventId) ?? []).length) continue;
    items.push({
      id: `gap:challenge:${event.id}`,
      kind: "challenged_without_evidence",
      tone: "attention",
      actorId: event.actorId,
      actorName: nameById.get(event.actorId) ?? event.actorId,
      round: event.round,
      title: "Challenged, still unsupported",
      detail: "A participant challenged this explicit event, but no structured evidence event currently targets it.",
      targetEventId: event.targetEventId,
      provenanceEventIds: [event.id, event.targetEventId],
    });
  }

  for (const record of evidenceRecords) {
    const sourceUrl = safeEvidenceSource(record.source);
    const verification = verifications[record.evidenceEventId];

    if (!sourceUrl) {
      items.push({
        id: `gap:no-source:${record.evidenceEventId}`,
        kind: "evidence_without_source",
        tone: "attention",
        actorId: record.actorId,
        actorName: record.actorName,
        round: record.round,
        title: "Evidence has no safe source URL",
        detail: "The evidence event exists, but ChatChat has no safe http(s) source it can inspect.",
        evidenceEventId: record.evidenceEventId,
        provenanceEventIds: [record.evidenceEventId],
      });
    } else if (!verification) {
      items.push({
        id: `gap:not-observed:${record.evidenceEventId}`,
        kind: "source_not_observed",
        tone: "open",
        actorId: record.actorId,
        actorName: record.actorName,
        round: record.round,
        title: "Source has not been observed yet",
        detail: "A public source URL was supplied, but there is no bounded ChatChat source observation for this event yet.",
        evidenceEventId: record.evidenceEventId,
        provenanceEventIds: [record.evidenceEventId],
      });
    }

    if (!record.sourceDate && !verification?.pageDate) {
      items.push({
        id: `gap:no-date:${record.evidenceEventId}`,
        kind: "source_date_missing",
        tone: "open",
        actorId: record.actorId,
        actorName: record.actorName,
        round: record.round,
        title: "Source date is missing",
        detail: "Neither the participant nor the bounded page observation supplied a usable page/source date signal.",
        evidenceEventId: record.evidenceEventId,
        provenanceEventIds: [record.evidenceEventId],
      });
    }

    if (record.challengeEventIds.length) {
      items.push({
        id: `gap:disputed:${record.evidenceEventId}`,
        kind: "disputed_source",
        tone: "attention",
        actorId: record.actorId,
        actorName: record.actorName,
        round: record.round,
        title: "Evidence remains disputed",
        detail: "One or more participants explicitly challenged this evidence event. Reachability does not settle the dispute.",
        evidenceEventId: record.evidenceEventId,
        provenanceEventIds: [record.evidenceEventId, ...record.challengeEventIds],
      });
    }

    if (record.downstreamRevisionEventIds.length) {
      items.push({
        id: `gap:influential:${record.evidenceEventId}`,
        kind: "evidence_changed_view",
        tone: "resolved",
        actorId: record.actorId,
        actorName: record.actorName,
        round: record.round,
        title: "Evidence changed a view",
        detail: "A later revision explicitly cites this evidence event in its structured causedBy provenance.",
        evidenceEventId: record.evidenceEventId,
        provenanceEventIds: [record.evidenceEventId, ...record.downstreamRevisionEventIds],
      });
    }
  }

  const order: Record<EvidenceGapTone, number> = { attention: 0, open: 1, resolved: 2 };
  items.sort((a, b) => order[a.tone] - order[b.tone] || b.round - a.round || a.id.localeCompare(b.id));

  return {
    items,
    counts: {
      attention: items.filter((item) => item.tone === "attention").length,
      open: items.filter((item) => item.tone === "open").length,
      resolved: items.filter((item) => item.tone === "resolved").length,
    },
  };
}
