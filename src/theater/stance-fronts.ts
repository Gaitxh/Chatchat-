import type { CouncilEvent } from "../core/types.js";
import type { ConflictThread } from "./conflict-board.js";

export interface ExplicitStanceMember {
  actorId: string;
  actorName: string;
  stance: string;
  eventId: string;
  round: number;
  confidence: number;
}

export interface ExplicitStanceFront {
  id: string;
  stance: string;
  state: "current" | "vacated";
  currentMembers: ExplicitStanceMember[];
  formerMembers: ExplicitStanceMember[];
  supportEventIds: string[];
  challengeEventIds: string[];
  evidenceEventIds: string[];
  unresolvedTargetEventIds: string[];
}

export interface ExplicitStanceMovement {
  actorId: string;
  actorName: string;
  fromStance: string;
  toStance: string;
  previousEventId: string;
  revisionEventId: string;
  round: number;
  causedByEventIds: string[];
}

export interface ConflictStanceFronts {
  threadId: string;
  fronts: ExplicitStanceFront[];
  movements: ExplicitStanceMovement[];
  uncommittedActorIds: string[];
  uncommittedActorNames: string[];
}

/**
 * Deterministic stance-front view for one Conflict Board thread.
 *
 * A front exists only because a participant published an explicit stance-bearing
 * event inside the thread. We normalize case and repeated whitespace only; we do
 * not semantically merge similar labels, infer a stance from challenge/evidence,
 * or ask an LLM to decide which camp somebody belongs to.
 */
export function deriveConflictStanceFronts(
  thread: ConflictThread,
  events: readonly CouncilEvent[],
): ConflictStanceFronts {
  const threadEventIds = new Set(thread.eventIds);
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const order = new Map(events.map((event, index) => [event.id, index] as const));
  const names = new Map<string, string>();
  names.set(thread.anchorActorId, thread.anchorActorName);
  for (const activity of thread.activities) names.set(activity.actorId, activity.actorName);

  const stanceEvents = events.filter((event) => threadEventIds.has(event.id) && hasStance(event));
  const latestByActor = new Map<string, CouncilEvent & { stance: string; confidence: number }>();
  const historyByActor = new Map<string, Array<CouncilEvent & { stance: string; confidence: number }>>();
  for (const event of stanceEvents) {
    if (!hasStance(event)) continue;
    const history = historyByActor.get(event.actorId) ?? [];
    history.push(event);
    historyByActor.set(event.actorId, history);
    const current = latestByActor.get(event.actorId);
    if (!current || compareEventOrder(current, event, order) < 0) latestByActor.set(event.actorId, event);
  }

  const frontLabels = new Map<string, string>();
  for (const event of stanceEvents) {
    if (!hasStance(event)) continue;
    const key = stanceKey(event.stance);
    if (!frontLabels.has(key)) frontLabels.set(key, event.stance.trim());
  }

  const fronts: ExplicitStanceFront[] = [];
  for (const [key, label] of frontLabels) {
    const currentMembers: ExplicitStanceMember[] = [];
    const formerMembers: ExplicitStanceMember[] = [];
    for (const [actorId, history] of historyByActor) {
      const latest = latestByActor.get(actorId);
      const matching = history.filter((event) => stanceKey(event.stance) === key);
      if (!matching.length) continue;
      const lastMatching = matching.sort((a, b) => compareEventOrder(a, b, order)).at(-1)!;
      const member = stanceMember(lastMatching, names);
      if (latest && stanceKey(latest.stance) === key) currentMembers.push(member);
      else formerMembers.push(member);
    }

    const supportEventIds: string[] = [];
    const challengeEventIds: string[] = [];
    const evidenceEventIds: string[] = [];
    for (const event of events) {
      if (!threadEventIds.has(event.id)) continue;
      const targetId = directTargetEventId(event);
      if (!targetId) continue;
      const target = eventById.get(targetId);
      if (!target || !hasStance(target) || stanceKey(target.stance) !== key) continue;
      if (event.kind === "support") supportEventIds.push(event.id);
      else if (event.kind === "challenge") challengeEventIds.push(event.id);
      else if (event.kind === "evidence") evidenceEventIds.push(event.id);
    }

    const unresolvedTargetEventIds = thread.openIssueEventIds.filter((eventId) => {
      const source = eventById.get(eventId);
      const targetActorId = source ? directTargetActorId(source, eventById) : undefined;
      if (!targetActorId) return false;
      const latest = latestByActor.get(targetActorId);
      return Boolean(latest && stanceKey(latest.stance) === key);
    });

    fronts.push({
      id: `${thread.id}:stance:${key}`,
      stance: label,
      state: currentMembers.length ? "current" : "vacated",
      currentMembers: sortMembers(currentMembers),
      formerMembers: sortMembers(formerMembers),
      supportEventIds,
      challengeEventIds,
      evidenceEventIds,
      unresolvedTargetEventIds,
    });
  }

  const movements = stanceEvents
    .filter((event): event is CouncilEvent & { kind: "revision"; stance: string; confidence: number } => event.kind === "revision")
    .flatMap((event) => {
      const previous = eventById.get(event.previousEventId);
      if (!previous || !hasStance(previous) || stanceKey(previous.stance) === stanceKey(event.stance)) return [];
      return [{
        actorId: event.actorId,
        actorName: names.get(event.actorId) ?? event.actorId,
        fromStance: previous.stance,
        toStance: event.stance,
        previousEventId: previous.id,
        revisionEventId: event.id,
        round: event.round,
        causedByEventIds: [...(event.causedBy ?? [])],
      } satisfies ExplicitStanceMovement];
    })
    .sort((a, b) => a.round - b.round || (order.get(a.revisionEventId) ?? 0) - (order.get(b.revisionEventId) ?? 0));

  fronts.sort((a, b) =>
    frontStateRank(a.state) - frontStateRank(b.state)
      || b.currentMembers.length - a.currentMembers.length
      || a.stance.localeCompare(b.stance),
  );

  const committed = new Set(latestByActor.keys());
  const uncommittedActorIds = thread.participantIds.filter((actorId) => !committed.has(actorId));

  return {
    threadId: thread.id,
    fronts,
    movements,
    uncommittedActorIds,
    uncommittedActorNames: uncommittedActorIds.map((actorId) => names.get(actorId) ?? actorId),
  };
}

function hasStance(event: CouncilEvent): event is CouncilEvent & { stance: string; confidence: number } {
  return event.kind === "argument" || event.kind === "revision" || event.kind === "final_position";
}

function stanceMember(
  event: CouncilEvent & { stance: string; confidence: number },
  names: ReadonlyMap<string, string>,
): ExplicitStanceMember {
  return {
    actorId: event.actorId,
    actorName: names.get(event.actorId) ?? event.actorId,
    stance: event.stance,
    eventId: event.id,
    round: event.round,
    confidence: event.confidence,
  };
}

function directTargetEventId(event: CouncilEvent): string | undefined {
  if (event.kind === "challenge" || event.kind === "support" || event.kind === "defense" || event.kind === "concede") {
    return event.targetEventId;
  }
  if (event.kind === "evidence") return event.targetEventId;
  return undefined;
}

function directTargetActorId(
  event: CouncilEvent,
  eventById: ReadonlyMap<string, CouncilEvent>,
): string | undefined {
  if (event.kind === "question") return event.targetActorId;
  const targetId = directTargetEventId(event);
  if (!targetId) return undefined;
  const target = eventById.get(targetId);
  return target?.actorId;
}

function stanceKey(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en-US");
}

function compareEventOrder(
  a: CouncilEvent,
  b: CouncilEvent,
  order: ReadonlyMap<string, number>,
): number {
  return a.round - b.round || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0);
}

function sortMembers(values: ExplicitStanceMember[]): ExplicitStanceMember[] {
  return [...values].sort((a, b) => a.actorName.localeCompare(b.actorName) || a.actorId.localeCompare(b.actorId));
}

function frontStateRank(state: ExplicitStanceFront["state"]): number {
  return state === "current" ? 0 : 1;
}
