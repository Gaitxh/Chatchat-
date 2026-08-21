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
  latestRoundActorIds: string[];
  latestRoundSelectedActorIds: string[];
  latestRoundOmittedActorIds: string[];
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
 * When the newest round itself exceeds the hard budget, selection is balanced
 * across equal actors instead of using Blackboard publication order. Every
 * latest-round actor receives one slot before any actor receives a second slot
 * whenever the budget can represent every actor. Remaining slots rotate by a
 * stable session+round hash so configured Provider order cannot become a hidden
 * memory advantage. Within an actor's quota, canonical-open source events are
 * protected before ordinary same-round recency.
 *
 * This selector never scores prose, stance popularity, provider identity or
 * confidence. Pinned/protected events gain memory coverage only — never authority.
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
  const issues = [...deriveOpenMeetingIssueProvenance(publicEvents)].sort((a, b) =>
    issueMemoryRank(a) - issueMemoryRank(b)
      || a.round - b.round
      || (indexById.get(a.sourceEventId) ?? Number.MAX_SAFE_INTEGER)
        - (indexById.get(b.sourceEventId) ?? Number.MAX_SAFE_INTEGER),
  );
  const latest = selectLatestRoundFairly(publicEvents, maxEvents, issues, indexById);

  if (publicEvents.length <= maxEvents) {
    const allIds = publicEvents.map((event) => event.id);
    return {
      events: publicEvents.map(cloneEvent),
      pinnedEventIds: [],
      pinnedIssueSourceEventIds: [],
      recentEventIds: allIds,
      latestRoundEventIds: latest.eventIds,
      latestRoundActorIds: latest.actorIds,
      latestRoundSelectedActorIds: latest.selectedActorIds,
      latestRoundOmittedActorIds: latest.omittedActorIds,
    };
  }

  const latestRoundEventIds = latest.eventIds;
  const protectedLatest = new Set(latestRoundEventIds);
  const maxPinnedIssueEvents = Math.min(
    requestedPinned,
    Math.max(0, maxEvents - protectedLatest.size),
  );

  const pinned = new Set<string>();
  const pinnedIssueSourceEventIds: string[] = [];
  for (const issue of issues) {
    if (pinned.size >= maxPinnedIssueEvents) break;
    const group = issueContextGroup(issue, eventById, indexById);
    const additions = group.filter((eventId) => !pinned.has(eventId) && !protectedLatest.has(eventId));
    if (!additions.length) continue;
    if (pinned.size + additions.length > maxPinnedIssueEvents) continue;
    for (const eventId of additions) pinned.add(eventId);
    pinnedIssueSourceEventIds.push(issue.sourceEventId);
  }

  const remaining = Math.max(0, maxEvents - protectedLatest.size - pinned.size);
  const ordinaryCandidates = publicEvents.filter((event) => !pinned.has(event.id) && !protectedLatest.has(event.id));
  const ordinaryRecent = remaining > 0
    ? ordinaryCandidates.slice(-remaining).map((event) => event.id)
    : [];
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
    latestRoundActorIds: latest.actorIds,
    latestRoundSelectedActorIds: latest.selectedActorIds,
    latestRoundOmittedActorIds: latest.omittedActorIds,
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

interface LatestRoundSelection {
  eventIds: string[];
  actorIds: string[];
  selectedActorIds: string[];
  omittedActorIds: string[];
}

function selectLatestRoundFairly(
  events: readonly CouncilEvent[],
  maxEvents: number,
  issues: readonly OpenMeetingIssueProvenance[],
  indexById: ReadonlyMap<string, number>,
): LatestRoundSelection {
  if (!events.length) return { eventIds: [], actorIds: [], selectedActorIds: [], omittedActorIds: [] };
  const latestRound = Math.max(...events.map((event) => event.round));
  const latestEvents = events.filter((event) => event.round === latestRound);
  const actorIds = unique(latestEvents.map((event) => event.actorId));
  if (latestEvents.length <= maxEvents) {
    return {
      eventIds: latestEvents.map((event) => event.id),
      actorIds,
      selectedActorIds: actorIds,
      omittedActorIds: [],
    };
  }

  const byActor = new Map<string, CouncilEvent[]>();
  for (const event of latestEvents) {
    const group = byActor.get(event.actorId) ?? [];
    group.push(event);
    byActor.set(event.actorId, group);
  }
  const sessionId = latestEvents[0]?.sessionId ?? "";
  const fairActorOrder = [...actorIds].sort((a, b) =>
    stableActorRank(sessionId, latestRound, a) - stableActorRank(sessionId, latestRound, b)
      || a.localeCompare(b),
  );

  const quota = new Map<string, number>(fairActorOrder.map((actorId) => [actorId, 0]));
  let slots = maxEvents;
  // One seat before seconds. If actor count itself exceeds the hard cap, the
  // omitted actor ids remain explicit so Memory Integrity can report that the
  // bounded deck could not represent every latest-round participant.
  for (const actorId of fairActorOrder) {
    if (slots <= 0) break;
    if (!(byActor.get(actorId)?.length)) continue;
    quota.set(actorId, 1);
    slots -= 1;
  }
  while (slots > 0) {
    let progressed = false;
    for (const actorId of fairActorOrder) {
      if (slots <= 0) break;
      const groupLength = byActor.get(actorId)?.length ?? 0;
      const current = quota.get(actorId) ?? 0;
      if (current >= groupLength) continue;
      quota.set(actorId, current + 1);
      slots -= 1;
      progressed = true;
    }
    if (!progressed) break;
  }

  const issueBySource = new Map(
    issues
      .filter((issue) => issue.round === latestRound)
      .map((issue) => [issue.sourceEventId, issue] as const),
  );
  const chosen = new Set<string>();
  for (const actorId of fairActorOrder) {
    const actorQuota = quota.get(actorId) ?? 0;
    if (!actorQuota) continue;
    const group = byActor.get(actorId) ?? [];
    const openSources = group
      .filter((event) => issueBySource.has(event.id))
      .sort((a, b) => {
        const ai = issueBySource.get(a.id)!;
        const bi = issueBySource.get(b.id)!;
        return issueMemoryRank(ai) - issueMemoryRank(bi)
          || (indexById.get(a.id) ?? 0) - (indexById.get(b.id) ?? 0);
      });
    const actorChosen = openSources.slice(0, actorQuota);
    if (actorChosen.length < actorQuota) {
      const already = new Set(actorChosen.map((event) => event.id));
      const ordinaryNewest = [...group]
        .reverse()
        .filter((event) => !already.has(event.id))
        .slice(0, actorQuota - actorChosen.length);
      actorChosen.push(...ordinaryNewest);
    }
    for (const event of actorChosen) chosen.add(event.id);
  }

  const eventIds = latestEvents
    .filter((event) => chosen.has(event.id))
    .map((event) => event.id);
  const selectedActorIds = unique(latestEvents.filter((event) => chosen.has(event.id)).map((event) => event.actorId));
  return {
    eventIds,
    actorIds,
    selectedActorIds,
    omittedActorIds: actorIds.filter((actorId) => !selectedActorIds.includes(actorId)),
  };
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

function stableActorRank(sessionId: string, round: number, actorId: string): number {
  const value = `${sessionId}|${round}|${actorId}`;
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
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

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
