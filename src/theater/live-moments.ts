import type {
  CouncilEvent,
  CouncilParticipant,
} from "../core/types.js";

export type LiveMomentKind =
  | "clash"
  | "evidence_drop"
  | "evidence_challenged"
  | "alliance"
  | "plot_twist"
  | "evidence_turn"
  | "concession"
  | "lone_dissenter"
  | "split_room"
  | "alignment_surge"
  | "full_alignment";

export interface LiveMoment {
  id: string;
  kind: LiveMomentKind;
  round: number;
  provenanceEventIds: string[];
  actorId?: string;
  targetActorId?: string;
  participantIds?: string[];
  stance?: string;
  fromStance?: string;
  toStance?: string;
  sourceHost?: string;
  alignmentBefore?: number;
  alignmentAfter?: number;
}

export interface LiveRoomDynamics {
  moments: LiveMoment[];
  heat: number;
  alignment: number;
  knownPositionCount: number;
  distinctPositionCount: number;
}

export function deriveLiveRoomDynamics(
  participants: readonly CouncilParticipant[],
  events: readonly CouncilEvent[],
): LiveRoomDynamics {
  const participantIds = new Set(participants.map((participant) => participant.id));
  const byId = new Map<string, CouncilEvent>();
  const positions = new Map<string, string>();
  const moments: LiveMoment[] = [];
  let patternSignature = "";

  for (const event of events) {
    byId.set(event.id, event);
    if (!participantIds.has(event.actorId)) continue;

    if (event.kind === "challenge") {
      const target = byId.get(event.targetEventId);
      if (target && participantIds.has(target.actorId)) {
        moments.push({
          id: `moment:${event.id}:challenge`,
          kind: target.kind === "evidence" ? "evidence_challenged" : "clash",
          round: event.round,
          actorId: event.actorId,
          targetActorId: target.actorId,
          provenanceEventIds: [event.targetEventId, event.id],
        });
      }
    } else if (event.kind === "evidence") {
      const sourceHost = publicSourceHost(event.source);
      moments.push({
        id: `moment:${event.id}:evidence`,
        kind: "evidence_drop",
        round: event.round,
        actorId: event.actorId,
        provenanceEventIds: [event.id],
        ...(sourceHost ? { sourceHost } : {}),
      });
    } else if (event.kind === "support") {
      const target = byId.get(event.targetEventId);
      if (target && participantIds.has(target.actorId) && target.actorId !== event.actorId) {
        moments.push({
          id: `moment:${event.id}:support`,
          kind: "alliance",
          round: event.round,
          actorId: event.actorId,
          targetActorId: target.actorId,
          provenanceEventIds: [event.targetEventId, event.id],
        });
      }
    } else if (event.kind === "concede") {
      const target = byId.get(event.targetEventId);
      moments.push({
        id: `moment:${event.id}:concede`,
        kind: "concession",
        round: event.round,
        actorId: event.actorId,
        provenanceEventIds: target ? [event.targetEventId, event.id] : [event.id],
        ...(target && participantIds.has(target.actorId)
          ? { targetActorId: target.actorId }
          : {}),
      });
    } else if (event.kind === "revision") {
      const prior = positions.get(event.actorId);
      const causes = (event.causedBy ?? [])
        .map((id) => byId.get(id))
        .filter((item): item is CouncilEvent => Boolean(item));
      const evidenceCause = causes.find((item) => item.kind === "evidence");
      moments.push({
        id: `moment:${event.id}:revision`,
        kind: evidenceCause ? "evidence_turn" : "plot_twist",
        round: event.round,
        actorId: event.actorId,
        provenanceEventIds: [...(event.causedBy ?? []), event.id],
        ...(prior ? { fromStance: prior } : {}),
        toStance: event.stance,
        ...(evidenceCause && participantIds.has(evidenceCause.actorId)
          ? { targetActorId: evidenceCause.actorId }
          : {}),
      });
    }

    if (hasStance(event)) {
      const before = alignmentPercent(positions);
      positions.set(event.actorId, event.stance);
      const after = alignmentPercent(positions);

      if (positions.size >= 3 && after - before >= 25) {
        moments.push({
          id: `moment:${event.id}:alignment-surge`,
          kind: "alignment_surge",
          round: event.round,
          actorId: event.actorId,
          provenanceEventIds: [event.id],
          alignmentBefore: before,
          alignmentAfter: after,
          stance: event.stance,
        });
      }

      if (positions.size >= 2 && after === 100 && before < 100) {
        moments.push({
          id: `moment:${event.id}:full-alignment`,
          kind: "full_alignment",
          round: event.round,
          actorId: event.actorId,
          provenanceEventIds: [event.id],
          alignmentBefore: before,
          alignmentAfter: after,
          stance: event.stance,
          participantIds: [...positions.keys()],
        });
      }

      const pattern = stancePattern(positions);
      if (positions.size >= 3 && pattern.signature !== patternSignature) {
        patternSignature = pattern.signature;
        if (pattern.loneDissenter) {
          moments.push({
            id: `moment:${event.id}:lone-dissenter`,
            kind: "lone_dissenter",
            round: event.round,
            actorId: pattern.loneDissenter.actorId,
            provenanceEventIds: [event.id],
            stance: pattern.loneDissenter.stance,
          });
        } else if (pattern.splitParticipantIds) {
          moments.push({
            id: `moment:${event.id}:split-room`,
            kind: "split_room",
            round: event.round,
            provenanceEventIds: [event.id],
            participantIds: pattern.splitParticipantIds,
          });
        }
      }
    }
  }

  return {
    moments,
    heat: deriveRoomHeat(events, positions),
    alignment: alignmentPercent(positions),
    knownPositionCount: positions.size,
    distinctPositionCount: new Set([...positions.values()].map(normalizeStance)).size,
  };
}

export function deriveRoomHeat(
  events: readonly CouncilEvent[],
  positions: ReadonlyMap<string, string> = new Map(),
): number {
  const weights: Record<CouncilEvent["kind"], number> = {
    argument: 3,
    challenge: 18,
    evidence: 10,
    support: 7,
    defense: 13,
    revision: 22,
    concede: 16,
    question: 8,
    uncertain: 6,
    final_position: 2,
  };
  const recent = events.slice(-8);
  const eventHeat = recent.reduce((sum, event) => sum + weights[event.kind], 0);
  const distinct = new Set([...positions.values()].map(normalizeStance)).size;
  const diversityHeat = distinct > 1 ? Math.min(24, (distinct - 1) * 12) : 0;
  return Math.min(100, eventHeat + diversityHeat);
}

function hasStance(
  event: CouncilEvent,
): event is Extract<CouncilEvent, { kind: "argument" | "revision" | "final_position" }> {
  return event.kind === "argument" || event.kind === "revision" || event.kind === "final_position";
}

function alignmentPercent(positions: ReadonlyMap<string, string>): number {
  if (!positions.size) return 0;
  const counts = new Map<string, number>();
  for (const stance of positions.values()) {
    const key = normalizeStance(stance);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Math.round((Math.max(...counts.values()) / positions.size) * 100);
}

function stancePattern(positions: ReadonlyMap<string, string>): {
  signature: string;
  loneDissenter?: { actorId: string; stance: string };
  splitParticipantIds?: string[];
} {
  const groups = new Map<string, { stance: string; actorIds: string[] }>();
  for (const [actorId, stance] of positions) {
    const key = normalizeStance(stance);
    const group = groups.get(key) ?? { stance, actorIds: [] };
    group.actorIds.push(actorId);
    groups.set(key, group);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  const signature = ordered.map(([key, group]) => `${key}:${group.actorIds.sort().join(",")}`).join("|");
  const sizes = ordered.map(([, group]) => group.actorIds.length).sort((a, b) => a - b);

  if (ordered.length === 2 && sizes[0] === 1 && sizes[1] === positions.size - 1) {
    const group = ordered.find(([, value]) => value.actorIds.length === 1)?.[1];
    if (group?.actorIds[0]) {
      return {
        signature,
        loneDissenter: { actorId: group.actorIds[0], stance: group.stance },
      };
    }
  }

  if (
    ordered.length === 2 &&
    positions.size >= 4 &&
    ordered[0]?.[1].actorIds.length === ordered[1]?.[1].actorIds.length
  ) {
    return { signature, splitParticipantIds: [...positions.keys()] };
  }

  return { signature };
}

function normalizeStance(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function publicSourceHost(source: string | undefined): string | undefined {
  if (!source) return undefined;
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    return url.hostname.replace(/^www\./i, "");
  } catch {
    return undefined;
  }
}
