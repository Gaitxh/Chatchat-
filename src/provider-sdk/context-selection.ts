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

  const issues = [...deriveOpenMeetingIssueProvenance(publicEvents)].sort((a, b) =>
    issueMemoryRank(a) - issueMemoryRank(b)
      || a.round - b.round
      || (indexById.get(a.sourceEventId) ?? Number.MAX_SAFE_INTEGER)
        - (indexById.get(b.sourceEventId) ?? Number.MAX_SAFE_INTEGER),
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
  const ordinaryRecent = publicEvents
    .filter((event) => !pinned.has(event.id) && !protectedLatest.has(event.id))
    .slice(-remaining)
    .map((event) => event.id);
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
  return events
    .filter((event) => event.round === latestRound)
    .slice(-maxEvents)
    .map((event) => event.id);
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

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}
