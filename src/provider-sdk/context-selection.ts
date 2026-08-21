import type { CouncilContext, CouncilEvent } from "../core/types.js";
import {
  deriveOpenMeetingIssueProvenance,
  type OpenMeetingIssueProvenance,
} from "../consultation/open-issues.js";

export const DEFAULT_PROVIDER_CONTEXT_EVENTS = 12;
export const DEFAULT_PROVIDER_PINNED_ISSUE_EVENTS = 6;
const MAX_EVENTS_PER_ISSUE_GROUP = 3;

export interface ProviderContextSelection {
  events: CouncilEvent[];
  pinnedEventIds: string[];
  pinnedIssueSourceEventIds: string[];
  recentEventIds: string[];
  latestRoundEventIds: string[];
}

export interface ProviderContextSelectionOptions {
  maxEvents?: number;
  maxPinnedIssueEvents?: number;
}

export interface ProviderVisibleConsultationContext {
  context: CouncilContext;
  selection: ProviderContextSelection;
}

/**
 * Keep structurally unresolved obligations visible without growing the Provider
 * prompt. The newest published round is protected first; old unresolved issue
 * events may then displace older generic recency events. The final selected
 * slice is always restored to Blackboard chronology.
 *
 * This selector never scores prose, stance popularity, model identity or
 * confidence. Pinned events gain memory priority only — never authority.
 *
 * Bounded-memory procedural fairness has three independent layers:
 * 1) an overflowing newest round is balanced across active source actors;
 * 2) equal-priority / equal-round pin candidates are round-robin allocated by
 *    source actor while preserving structural issue priority and older-round
 *    anti-starvation;
 * 3) ordinary recency keeps whole newer rounds first and only balances the one
 *    older boundary round that cannot fit completely.
 *
 * Deterministic rotation resolves only mathematically unavoidable remainders.
 * No Provider brand, stance, confidence, speed, majority membership, evidence
 * popularity or Blackboard publication position receives preference.
 */
export function selectProviderContextEvents(
  publicEvents: readonly CouncilEvent[],
  options: ProviderContextSelectionOptions = {},
): ProviderContextSelection {
  const maxEvents = positiveInteger(options.maxEvents, DEFAULT_PROVIDER_CONTEXT_EVENTS);
  const requestedPinned = nonNegativeInteger(
    options.maxPinnedIssueEvents,
    DEFAULT_PROVIDER_PINNED_ISSUE_EVENTS,
  );
  const indexById = new Map(publicEvents.map((event, index) => [event.id, index] as const));
  const eventById = new Map(publicEvents.map((event) => [event.id, event] as const));

  if (publicEvents.length <= maxEvents) {
    const allIds = publicEvents.map((event) => event.id);
    return {
      events: publicEvents.map(cloneEvent),
      pinnedEventIds: [],
      pinnedIssueSourceEventIds: [],
      recentEventIds: allIds,
      latestRoundEventIds: latestRoundIds(publicEvents, maxEvents),
    };
  }

  const latestRoundEventIds = latestRoundIds(publicEvents, maxEvents);
  const protectedLatest = new Set(latestRoundEventIds);
  const maxPinnedIssueEvents = Math.min(
    requestedPinned,
    Math.max(0, maxEvents - protectedLatest.size),
  );
  const issues = deriveOpenMeetingIssueProvenance(publicEvents);
  const { pinned, pinnedIssueSourceEventIds } = selectPinnedIssueMemory(
    issues,
    publicEvents,
    eventById,
    indexById,
    protectedLatest,
    maxPinnedIssueEvents,
  );

  const remaining = Math.max(0, maxEvents - protectedLatest.size - pinned.size);
  const ordinaryCandidates = publicEvents.filter((event) => !pinned.has(event.id) && !protectedLatest.has(event.id));
  const ordinaryRecent = selectOrdinaryRecentIds(ordinaryCandidates, remaining);
  const recent = [...ordinaryRecent, ...latestRoundEventIds]
    .sort((a, b) => (indexById.get(a) ?? 0) - (indexById.get(b) ?? 0));
  const selectedIds = new Set([...pinned, ...recent]);
  const selected = publicEvents.filter((event) => selectedIds.has(event.id)).map(cloneEvent);

  return {
    events: selected,
    pinnedEventIds: [...pinned].sort((a, b) => (indexById.get(a) ?? 0) - (indexById.get(b) ?? 0)),
    pinnedIssueSourceEventIds: unique(pinnedIssueSourceEventIds),
    recentEventIds: recent,
    latestRoundEventIds,
  };
}

/**
 * Reuses the exact selector for parser/reply/inbox visibility. This prevents a
 * Provider response from successfully referencing an old public event that was
 * not actually present in that turn's bounded prompt snapshot.
 */
export function providerVisibleConsultationContext(
  context: CouncilContext,
  options: ProviderContextSelectionOptions = {},
): ProviderVisibleConsultationContext {
  const selection = selectProviderContextEvents(context.publicEvents, options);
  return {
    selection,
    context: {
      ...context,
      publicEvents: selection.events,
    },
  };
}

function selectPinnedIssueMemory(
  issues: readonly OpenMeetingIssueProvenance[],
  publicEvents: readonly CouncilEvent[],
  eventById: ReadonlyMap<string, CouncilEvent>,
  indexById: ReadonlyMap<string, number>,
  protectedLatest: ReadonlySet<string>,
  maxPinnedIssueEvents: number,
): { pinned: Set<string>; pinnedIssueSourceEventIds: string[] } {
  const pinned = new Set<string>();
  const pinnedIssueSourceEventIds: string[] = [];
  if (maxPinnedIssueEvents <= 0 || !issues.length) return { pinned, pinnedIssueSourceEventIds };

  const cohorts = new Map<string, OpenMeetingIssueProvenance[]>();
  for (const issue of issues) {
    const key = `${issueMemoryRank(issue)}|${issue.round}`;
    const group = cohorts.get(key) ?? [];
    group.push(issue);
    cohorts.set(key, group);
  }
  const orderedCohorts = [...cohorts.entries()].sort(([a], [b]) => {
    const [rankA, roundA] = a.split("|").map(Number);
    const [rankB, roundB] = b.split("|").map(Number);
    return (rankA ?? 0) - (rankB ?? 0) || (roundA ?? 0) - (roundB ?? 0);
  });
  const sessionId = publicEvents[0]?.sessionId ?? "";

  for (const [cohortKey, cohort] of orderedCohorts) {
    if (pinned.size >= maxPinnedIssueEvents) break;
    const byActor = new Map<string, OpenMeetingIssueProvenance[]>();
    for (const issue of [...cohort].sort((a, b) =>
      (indexById.get(a.sourceEventId) ?? Number.MAX_SAFE_INTEGER)
        - (indexById.get(b.sourceEventId) ?? Number.MAX_SAFE_INTEGER),
    )) {
      const bucket = byActor.get(issue.actorId) ?? [];
      bucket.push(issue);
      byActor.set(issue.actorId, bucket);
    }
    const actorIds = [...byActor.keys()].sort((a, b) => a.localeCompare(b));
    const actorCycle = rotate(actorIds, stableRotation(`${sessionId}|pin|${cohortKey}`, actorIds.length));
    const cursor = new Map<string, number>(actorIds.map((actorId) => [actorId, 0]));

    while (pinned.size < maxPinnedIssueEvents) {
      let addedThisPass = false;
      let inspectedThisPass = false;
      for (const actorId of actorCycle) {
        const bucket = byActor.get(actorId) ?? [];
        let index = cursor.get(actorId) ?? 0;
        while (index < bucket.length) {
          inspectedThisPass = true;
          const issue = bucket[index]!;
          index += 1;
          cursor.set(actorId, index);
          const issueGroup = issueContextGroup(issue, eventById, indexById);
          const additions = issueGroup.filter((eventId) => !pinned.has(eventId) && !protectedLatest.has(eventId));
          if (!additions.length) continue;
          // Issue context groups are indivisible. A challenge/question must not
          // be pinned without the bounded structural context that makes it
          // intelligible merely to fill the final one or two slots.
          if (pinned.size + additions.length > maxPinnedIssueEvents) continue;
          for (const eventId of additions) pinned.add(eventId);
          pinnedIssueSourceEventIds.push(issue.sourceEventId);
          addedThisPass = true;
          break;
        }
        if (pinned.size >= maxPinnedIssueEvents) break;
      }
      if (!addedThisPass && !inspectedThisPass) break;
      if (!addedThisPass && actorIds.every((actorId) => (cursor.get(actorId) ?? 0) >= (byActor.get(actorId)?.length ?? 0))) break;
    }
  }

  return { pinned, pinnedIssueSourceEventIds };
}

function selectOrdinaryRecentIds(
  ordinaryCandidates: readonly CouncilEvent[],
  capacity: number,
): string[] {
  if (capacity <= 0 || !ordinaryCandidates.length) return [];
  if (ordinaryCandidates.length <= capacity) return ordinaryCandidates.map((event) => event.id);

  const rounds = unique(ordinaryCandidates.map((event) => event.round)).sort((a, b) => b - a);
  const selected = new Set<string>();
  const sessionId = ordinaryCandidates[0]?.sessionId ?? "";
  for (const round of rounds) {
    const remaining = capacity - selected.size;
    if (remaining <= 0) break;
    const roundEvents = ordinaryCandidates.filter((event) => event.round === round);
    if (roundEvents.length <= remaining) {
      for (const event of roundEvents) selected.add(event.id);
      continue;
    }
    // Only the oldest boundary round that cannot fit is truncated. Balance that
    // unavoidable truncation across active actors, then stop: older rounds must
    // never displace a newer complete round in the name of seat equality.
    for (const eventId of balancedRoundIds(roundEvents, remaining, `${sessionId}|ordinary|${round}`)) {
      selected.add(eventId);
    }
    break;
  }
  return ordinaryCandidates.filter((event) => selected.has(event.id)).map((event) => event.id);
}

function issueContextGroup(
  issue: OpenMeetingIssueProvenance,
  eventById: ReadonlyMap<string, CouncilEvent>,
  indexById: ReadonlyMap<string, number>,
): string[] {
  const ids = new Set<string>();
  addIfPresent(ids, issue.sourceEventId, eventById);
  for (const relatedEventId of issue.relatedEventIds) addIfPresent(ids, relatedEventId, eventById);

  // Preserve one bounded structural parent when the open event itself is a
  // reply/continuation. This keeps the pinned item intelligible without
  // recursively pulling an unbounded thread into the prompt.
  const source = eventById.get(issue.sourceEventId);
  const parent = source ? structuralParent(source) : undefined;
  if (parent) addIfPresent(ids, parent, eventById);

  return [...ids]
    .sort((a, b) => (indexById.get(a) ?? 0) - (indexById.get(b) ?? 0))
    .slice(-MAX_EVENTS_PER_ISSUE_GROUP);
}

function structuralParent(event: CouncilEvent): string | undefined {
  switch (event.kind) {
    case "challenge":
    case "support":
    case "defense":
    case "concede":
      return event.targetEventId;
    case "evidence":
      return event.targetEventId ?? event.replyToEventId;
    case "argument":
    case "question":
    case "uncertain":
      return event.replyToEventId;
    case "revision":
      return event.previousEventId;
    case "final_position":
      return undefined;
  }
}

function latestRoundIds(events: readonly CouncilEvent[], maxEvents: number): string[] {
  if (!events.length) return [];
  const latestRound = Math.max(...events.map((event) => event.round));
  const latest = events.filter((event) => event.round === latestRound);
  if (latest.length <= maxEvents) return latest.map((event) => event.id);
  const sessionId = latest[0]?.sessionId ?? "";
  return balancedRoundIds(latest, maxEvents, `${sessionId}|${latestRound}`);
}

function balancedRoundIds(
  events: readonly CouncilEvent[],
  capacity: number,
  seed: string,
): string[] {
  if (capacity <= 0 || !events.length) return [];
  if (events.length <= capacity) return events.map((event) => event.id);
  const byActor = new Map<string, CouncilEvent[]>();
  for (const event of events) {
    const bucket = byActor.get(event.actorId) ?? [];
    bucket.push(event);
    byActor.set(event.actorId, bucket);
  }
  const actorIds = [...byActor.keys()].sort((a, b) => a.localeCompare(b));
  if (!actorIds.length) return [];
  const actorCycle = rotate(actorIds, stableRotation(seed, actorIds.length));
  const cursor = new Map(actorIds.map((actorId) => [actorId, (byActor.get(actorId)?.length ?? 0) - 1] as const));
  const selected = new Set<string>();

  while (selected.size < capacity) {
    let addedThisPass = false;
    for (const actorId of actorCycle) {
      const bucket = byActor.get(actorId) ?? [];
      const index = cursor.get(actorId) ?? -1;
      if (index < 0) continue;
      selected.add(bucket[index]!.id);
      cursor.set(actorId, index - 1);
      addedThisPass = true;
      if (selected.size >= capacity) break;
    }
    if (!addedThisPass) break;
  }
  return events.filter((event) => selected.has(event.id)).map((event) => event.id);
}

function stableRotation(seed: string, size: number): number {
  if (size <= 1) return 0;
  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % size;
}

function rotate<T>(values: readonly T[], offset: number): T[] {
  if (!values.length) return [];
  const normalized = ((offset % values.length) + values.length) % values.length;
  return [...values.slice(normalized), ...values.slice(0, normalized)];
}

function issueMemoryRank(issue: OpenMeetingIssueProvenance): number {
  if (issue.kind === "open_question" && issue.targetActorId) return 0;
  if (issue.kind === "challenged_claim") return 1;
  if (issue.kind === "evidence_awaiting_response" && issue.targetActorId) return 2;
  if (issue.kind === "open_question") return 3;
  if (issue.kind === "evidence_awaiting_response") return 4;
  return 5;
}

function addIfPresent(
  ids: Set<string>,
  eventId: string,
  eventById: ReadonlyMap<string, CouncilEvent>,
): void {
  if (eventById.has(eventId)) ids.add(eventId);
}

function cloneEvent(event: CouncilEvent): CouncilEvent {
  if (event.kind === "revision") {
    return {
      ...event,
      ...(event.causedBy ? { causedBy: [...event.causedBy] } : {}),
    };
  }
  if (event.kind === "final_position") {
    return {
      ...event,
      ...(event.caveats ? { caveats: [...event.caveats] } : {}),
    };
  }
  return { ...event };
}

function positiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1) throw new Error("maxEvents must be a positive integer.");
  return value;
}

function nonNegativeInteger(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 0) throw new Error("maxPinnedIssueEvents must be a non-negative integer.");
  return value;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
