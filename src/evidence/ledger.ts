import type {
  CouncilEvent,
  CouncilParticipant,
} from "../core/types.js";

export type EvidenceLedgerStatus =
  | "unsupported"
  | "sourced"
  | "source-date-missing"
  | "challenged"
  | "supported"
  | "defended"
  | "changed-a-mind";

export interface SafeEvidenceSource {
  raw: string;
  openable: boolean;
  href: string | null;
  host: string | null;
}

export interface EvidenceRecord {
  eventId: string;
  actorId: string;
  targetEventId: string | null;
  claim: string;
  content: string;
  confidence: number;
  source: SafeEvidenceSource | null;
  sourceDate: string | null;
  changedMindActorIds: string[];
}

export interface ClaimLedgerEntry {
  eventId: string;
  actorId: string;
  kind: "argument" | "evidence";
  stance: string | null;
  claim: string;
  round: number;
  evidenceEventIds: string[];
  challengeEventIds: string[];
  supportEventIds: string[];
  defenseEventIds: string[];
  revisionEventIds: string[];
  concedeEventIds: string[];
  statuses: EvidenceLedgerStatus[];
}

export interface EvidenceCourtLedger {
  claims: ClaimLedgerEntry[];
  evidence: EvidenceRecord[];
  unresolvedReferences: Array<{
    eventId: string;
    referencedEventId: string;
    relation: "evidence" | "challenge" | "support" | "defense" | "revision" | "concede";
  }>;
  participants: CouncilParticipant[];
}

export interface EvidenceCourtSummary {
  claimCount: number;
  evidenceCount: number;
  sourcedEvidenceCount: number;
  unsupportedClaimCount: number;
  challengedClaimCount: number;
  changedMindEvidenceCount: number;
  unresolvedReferenceCount: number;
}

export function buildEvidenceCourtLedger(
  participants: readonly CouncilParticipant[],
  events: readonly CouncilEvent[],
): EvidenceCourtLedger {
  const eventById = new Map(events.map((event) => [event.id, event]));
  const claims = new Map<string, ClaimLedgerEntry>();
  const unresolvedReferences: EvidenceCourtLedger["unresolvedReferences"] = [];

  for (const event of events) {
    if (event.kind === "argument") {
      claims.set(event.id, {
        eventId: event.id,
        actorId: event.actorId,
        kind: "argument",
        stance: event.stance,
        claim: event.content,
        round: event.round,
        evidenceEventIds: [],
        challengeEventIds: [],
        supportEventIds: [],
        defenseEventIds: [],
        revisionEventIds: [],
        concedeEventIds: [],
        statuses: [],
      });
    }
    if (event.kind === "evidence") {
      claims.set(event.id, {
        eventId: event.id,
        actorId: event.actorId,
        kind: "evidence",
        stance: null,
        claim: event.claim,
        round: event.round,
        evidenceEventIds: [],
        challengeEventIds: [],
        supportEventIds: [],
        defenseEventIds: [],
        revisionEventIds: [],
        concedeEventIds: [],
        statuses: [],
      });
    }
  }

  const evidenceRecords: EvidenceRecord[] = events
    .filter((event): event is Extract<CouncilEvent, { kind: "evidence" }> => event.kind === "evidence")
    .map((event) => ({
      eventId: event.id,
      actorId: event.actorId,
      targetEventId: event.targetEventId ?? null,
      claim: event.claim,
      content: event.content,
      confidence: clamp01(event.confidence),
      source: event.source ? safeEvidenceSource(event.source) : null,
      sourceDate: normalizeSourceDate(event.sourceDate),
      changedMindActorIds: changedMindActorsForEvidence(event.id, events),
    }));

  for (const event of events) {
    if (event.kind === "evidence" && event.targetEventId) {
      link(
        claims,
        eventById,
        unresolvedReferences,
        event.id,
        event.targetEventId,
        "evidence",
        "evidenceEventIds",
      );
      continue;
    }
    if (event.kind === "challenge") {
      link(claims, eventById, unresolvedReferences, event.id, event.targetEventId, "challenge", "challengeEventIds");
      continue;
    }
    if (event.kind === "support") {
      link(claims, eventById, unresolvedReferences, event.id, event.targetEventId, "support", "supportEventIds");
      continue;
    }
    if (event.kind === "defense") {
      link(claims, eventById, unresolvedReferences, event.id, event.targetEventId, "defense", "defenseEventIds");
      continue;
    }
    if (event.kind === "revision") {
      const explicitCauses = event.causedBy ?? [];
      for (const causeId of explicitCauses) {
        link(claims, eventById, unresolvedReferences, event.id, causeId, "revision", "revisionEventIds");
      }
      // previousEventId identifies what was revised, not what caused it.
      continue;
    }
    if (event.kind === "concede") {
      link(claims, eventById, unresolvedReferences, event.id, event.targetEventId, "concede", "concedeEventIds");
    }
  }

  for (const claim of claims.values()) {
    claim.statuses = deriveStatuses(claim, evidenceRecords);
  }

  return {
    claims: [...claims.values()].sort(byRoundThenId),
    evidence: evidenceRecords.sort((a, b) => a.eventId.localeCompare(b.eventId)),
    unresolvedReferences,
    participants: uniqueParticipants(participants),
  };
}

export function summarizeEvidenceCourt(
  ledger: EvidenceCourtLedger,
): EvidenceCourtSummary {
  return {
    claimCount: ledger.claims.length,
    evidenceCount: ledger.evidence.length,
    sourcedEvidenceCount: ledger.evidence.filter((item) => item.source?.openable).length,
    unsupportedClaimCount: ledger.claims.filter((claim) => claim.statuses.includes("unsupported")).length,
    challengedClaimCount: ledger.claims.filter((claim) => claim.statuses.includes("challenged")).length,
    changedMindEvidenceCount: ledger.evidence.filter((item) => item.changedMindActorIds.length > 0).length,
    unresolvedReferenceCount: ledger.unresolvedReferences.length,
  };
}

export function safeEvidenceSource(rawValue: string): SafeEvidenceSource {
  const raw = rawValue.trim().slice(0, 2048);
  if (!raw) return { raw: "", openable: false, href: null, host: null };
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { raw, openable: false, href: null, host: null };
    }
    return {
      raw,
      openable: true,
      href: url.href,
      host: url.hostname.toLocaleLowerCase(),
    };
  } catch {
    return { raw, openable: false, href: null, host: null };
  }
}

export function claimHasExplicitEvidence(
  claim: ClaimLedgerEntry,
): boolean {
  return claim.evidenceEventIds.length > 0 || claim.kind === "evidence";
}

function deriveStatuses(
  claim: ClaimLedgerEntry,
  evidence: readonly EvidenceRecord[],
): EvidenceLedgerStatus[] {
  const statuses = new Set<EvidenceLedgerStatus>();
  const attachedIds = new Set(claim.evidenceEventIds);
  if (claim.kind === "evidence") attachedIds.add(claim.eventId);
  const attached = evidence.filter((item) => attachedIds.has(item.eventId));

  if (!claimHasExplicitEvidence(claim)) statuses.add("unsupported");
  if (attached.some((item) => item.source?.openable)) statuses.add("sourced");
  if (attached.some((item) => item.source?.openable && !item.sourceDate)) {
    statuses.add("source-date-missing");
  }
  if (claim.challengeEventIds.length) statuses.add("challenged");
  if (claim.supportEventIds.length) statuses.add("supported");
  if (claim.defenseEventIds.length) statuses.add("defended");
  if (claim.revisionEventIds.length || claim.concedeEventIds.length) statuses.add("changed-a-mind");

  return [...statuses];
}

function changedMindActorsForEvidence(
  evidenceEventId: string,
  events: readonly CouncilEvent[],
): string[] {
  const actors = new Set<string>();
  for (const event of events) {
    if (event.kind === "revision" && (event.causedBy ?? []).includes(evidenceEventId)) {
      actors.add(event.actorId);
    }
    if (event.kind === "concede" && event.targetEventId === evidenceEventId) {
      actors.add(event.actorId);
    }
  }
  return [...actors].sort();
}

function link(
  claims: Map<string, ClaimLedgerEntry>,
  eventById: ReadonlyMap<string, CouncilEvent>,
  unresolved: EvidenceCourtLedger["unresolvedReferences"],
  sourceEventId: string,
  targetEventId: string,
  relation: EvidenceCourtLedger["unresolvedReferences"][number]["relation"],
  field: keyof Pick<
    ClaimLedgerEntry,
    | "evidenceEventIds"
    | "challengeEventIds"
    | "supportEventIds"
    | "defenseEventIds"
    | "revisionEventIds"
    | "concedeEventIds"
  >,
) {
  const targetEvent = eventById.get(targetEventId);
  if (!targetEvent) {
    unresolved.push({
      eventId: sourceEventId,
      referencedEventId: targetEventId,
      relation,
    });
    return;
  }
  const targetClaim = claims.get(targetEventId);
  if (!targetClaim) {
    // A valid explicit reference may point at challenge/revision/etc. That is
    // real provenance, but it is outside this v1 claim-ledger node set. Do not
    // mislabel it as a broken reference and do not invent a claim node for it.
    return;
  }
  targetClaim[field].push(sourceEventId);
}

function normalizeSourceDate(value: string | undefined): string | null {
  if (!value) return null;
  const compact = value.replace(/\s+/g, " ").trim().slice(0, 80);
  return compact || null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function uniqueParticipants(
  participants: readonly CouncilParticipant[],
): CouncilParticipant[] {
  const seen = new Set<string>();
  const result: CouncilParticipant[] = [];
  for (const participant of participants) {
    if (seen.has(participant.id)) continue;
    seen.add(participant.id);
    result.push({ ...participant });
  }
  return result;
}

function byRoundThenId(a: ClaimLedgerEntry, b: ClaimLedgerEntry): number {
  return a.round - b.round || a.eventId.localeCompare(b.eventId);
}
