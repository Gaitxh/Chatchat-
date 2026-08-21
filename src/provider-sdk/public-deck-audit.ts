import type { CouncilPhase } from "../core/types.js";

export interface ProviderPublicDeckObservation {
  sessionId: string;
  actorId: string;
  phase: CouncilPhase | "consultation";
  round: number;
  repairAttempt: boolean;
  /** Exact serialized CONSULTATION_EVENTS_JSON value from the outgoing RUN_SPEECH Prompt. */
  publicSnapshotPayload: string;
  /** Diagnostic only. Exact equality is always decided from publicSnapshotPayload itself. */
  fingerprint: string;
  payloadCharacters: number;
  observedAt: string;
}

export interface ProviderPublicDeckGroup {
  fingerprint: string;
  actorIds: string[];
}

export interface ProviderPublicDeckAudit {
  sessionId: string;
  phase: CouncilPhase | "consultation";
  round: number;
  firstAttemptActors: string[];
  repairAttemptActors: string[];
  peerDeckGroups: ProviderPublicDeckGroup[];
  /** null means fewer than two first-attempt payloads were observed. */
  peerDecksExactlyEqual: boolean | null;
  /** null means no repair Prompt was observed. */
  repairDecksExactlyPreserved: boolean | null;
  repairMismatchActorIds: string[];
  unpairedRepairActorIds: string[];
}

const MAX_OBSERVATIONS = 320;
const observations = new Map<string, ProviderPublicDeckObservation>();

/**
 * Observe only explicit ChatChat protocol fields in the exact outgoing Prompt.
 * The exact public payload is kept in this bounded in-memory buffer so equality
 * can be checked byte-for-byte without persisting another transcript copy.
 */
export function rememberProviderPublicDeck(prompt: string): ProviderPublicDeckObservation | null {
  const observation = parseProviderPublicDeck(prompt);
  if (!observation) return null;
  observations.set(observationKey(observation), { ...observation });
  trimObservations();
  return { ...observation };
}

export function parseProviderPublicDeck(prompt: string): ProviderPublicDeckObservation | null {
  const phaseText = prompt.match(/PHASE:\s*(sealed|debate|final)/i)?.[1]?.toLowerCase() ?? "consultation";
  const phase = isPhase(phaseText) ? phaseText : "consultation";
  const round = Number(prompt.match(/ROUND:\s*(\d+)/i)?.[1] ?? "0");
  const sessionId = prompt.match(/SESSION_ID:\s*([^\n]+)/)?.[1]?.trim() ?? "";
  const actorId = prompt.match(/YOUR_ACTOR_ID:\s*([^\n]+)/)?.[1]?.trim() ?? "";
  const publicSnapshotPayload = parsePayloadLine(prompt, "CONSULTATION_EVENTS_JSON");
  if (!sessionId || !actorId || !Number.isFinite(round) || publicSnapshotPayload === null) return null;

  // The field must actually be valid JSON. We retain the exact source string,
  // rather than re-stringifying parsed data, because this layer audits the bytes
  // that were sent to Provider tabs.
  try {
    const parsed = JSON.parse(publicSnapshotPayload);
    if (!Array.isArray(parsed)) return null;
  } catch {
    return null;
  }

  return {
    sessionId,
    actorId,
    phase,
    round,
    repairAttempt: /\nREPAIR ATTEMPT:\s*/i.test(prompt),
    publicSnapshotPayload,
    fingerprint: payloadFingerprint(publicSnapshotPayload),
    payloadCharacters: publicSnapshotPayload.length,
    observedAt: new Date().toISOString(),
  };
}

export function providerPublicDeckObservationFor(
  value: Pick<ProviderPublicDeckObservation, "sessionId" | "actorId" | "phase" | "round" | "repairAttempt">,
): ProviderPublicDeckObservation | null {
  const found = observations.get(observationKey(value));
  return found ? { ...found } : null;
}

/**
 * Audit one public meeting deck across equal Provider seats and any parser repair.
 * Peer parity and repair continuity are deliberately separate properties.
 */
export function providerPublicDeckAuditForRound(
  value: Pick<ProviderPublicDeckObservation, "sessionId" | "phase" | "round">,
): ProviderPublicDeckAudit {
  const observed = [...observations.values()]
    .filter((item) => item.sessionId === value.sessionId && item.phase === value.phase && item.round === value.round)
    .sort((left, right) => left.actorId.localeCompare(right.actorId));
  const firstAttempts = observed.filter((item) => !item.repairAttempt);
  const repairs = observed.filter((item) => item.repairAttempt);
  const firstByActor = new Map(firstAttempts.map((item) => [item.actorId, item] as const));
  const payloadGroups = new Map<string, string[]>();

  for (const item of firstAttempts) {
    const actors = payloadGroups.get(item.publicSnapshotPayload) ?? [];
    actors.push(item.actorId);
    payloadGroups.set(item.publicSnapshotPayload, actors);
  }

  const peerDeckGroups = [...payloadGroups.entries()]
    .map(([payload, actorIds]) => ({
      fingerprint: payloadFingerprint(payload),
      actorIds: [...actorIds].sort(),
    }))
    .sort((left, right) => left.fingerprint.localeCompare(right.fingerprint));

  const repairMismatchActorIds: string[] = [];
  const unpairedRepairActorIds: string[] = [];
  for (const repair of repairs) {
    const first = firstByActor.get(repair.actorId);
    if (!first) {
      unpairedRepairActorIds.push(repair.actorId);
      continue;
    }
    if (repair.publicSnapshotPayload !== first.publicSnapshotPayload) {
      repairMismatchActorIds.push(repair.actorId);
    }
  }

  return {
    sessionId: value.sessionId,
    phase: value.phase,
    round: value.round,
    firstAttemptActors: firstAttempts.map((item) => item.actorId),
    repairAttemptActors: repairs.map((item) => item.actorId),
    peerDeckGroups,
    peerDecksExactlyEqual: firstAttempts.length >= 2 ? peerDeckGroups.length === 1 : null,
    repairDecksExactlyPreserved: repairs.length
      ? repairMismatchActorIds.length === 0 && unpairedRepairActorIds.length === 0
      : null,
    repairMismatchActorIds: [...new Set(repairMismatchActorIds)].sort(),
    unpairedRepairActorIds: [...new Set(unpairedRepairActorIds)].sort(),
  };
}

function parsePayloadLine(prompt: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const raw = prompt.match(new RegExp(`${escaped}:\\s*([^\\n\\r]+)`))?.[1];
  return raw === undefined ? null : raw;
}

/**
 * Compact diagnostic fingerprint for UI/receipts. This is not a cryptographic
 * claim and is never used to decide exact equality.
 */
function payloadFingerprint(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
    second ^= second >>> 13;
  }
  return `v1:${value.length}:${hex(first)}${hex(second)}`;
}

function hex(value: number): string {
  return (value >>> 0).toString(16).padStart(8, "0");
}

function observationKey(
  value: Pick<ProviderPublicDeckObservation, "sessionId" | "actorId" | "phase" | "round" | "repairAttempt">,
): string {
  return `${value.sessionId}|${value.actorId}|${value.phase}|${value.round}|${value.repairAttempt ? "repair" : "first"}`;
}

function trimObservations(): void {
  while (observations.size > MAX_OBSERVATIONS) {
    const first = observations.keys().next().value as string | undefined;
    if (!first) return;
    observations.delete(first);
  }
}

function isPhase(value: string): value is CouncilPhase {
  return value === "sealed" || value === "debate" || value === "final";
}
