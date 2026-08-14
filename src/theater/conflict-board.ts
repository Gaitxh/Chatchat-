import type { CouncilEvent, CouncilEventKind, CouncilParticipant } from "../core/types.js";
import {
  deriveOpenMeetingIssues,
  type OpenMeetingIssue,
} from "../consultation/open-issues.js";
import { directPeerRequestTarget } from "../consultation/structured-response.js";

export type ConflictThreadStatus =
  | "open"
  | "position_changed"
  | "conceded"
  | "answered"
  | "active";

export interface ConflictThreadActivity {
  eventId: string;
  kind: CouncilEventKind;
  actorId: string;
  actorName: string;
  round: number;
  excerpt: string;
  targetEventId?: string;
  replyToEventId?: string;
}

export interface ConflictThreadExternalInfluence {
  causeEventId: string;
  causeThreadId: string;
  revisionEventId: string;
  actorId: string;
  actorName: string;
}

export interface ConflictThreadCounts {
  challenge: number;
  support: number;
  evidence: number;
  question: number;
  reply: number;
  defense: number;
  revision: number;
  concede: number;
}

export interface ConflictThread {
  id: string;
  anchorEventId: string;
  anchorKind: CouncilEventKind;
  anchorActorId: string;
  anchorActorName: string;
  anchorRound: number;
  anchorStance?: string;
  anchorExcerpt: string;
  status: ConflictThreadStatus;
  latestRound: number;
  eventIds: string[];
  participantIds: string[];
  participantNames: string[];
  counts: ConflictThreadCounts;
  directRequestCount: number;
  openIssueIds: string[];
  openIssueEventIds: string[];
  movementEventIds: string[];
  externalInfluences: ConflictThreadExternalInfluence[];
  activities: ConflictThreadActivity[];
}

export interface ConflictBoardModel {
  threads: ConflictThread[];
  eventThreadIds: Record<string, string>;
  openIssueCount: number;
}

/**
 * Deterministic event-thread view over the public Blackboard.
 *
 * The board never clusters prose by semantic similarity and never asks an LLM
 * what the "real issue" is. A thread exists because exact protocol references
 * keep events connected to one public anchor event.
 */
export function deriveConflictBoard(
  participants: readonly CouncilParticipant[],
  events: readonly CouncilEvent[],
): ConflictBoardModel {
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const participantNames = new Map(participants.map((participant) => [participant.id, participant.name] as const));
  const anchorCache = new Map<string, string>();

  const anchorOf = (eventId: string, visiting = new Set<string>()): string => {
    const cached = anchorCache.get(eventId);
    if (cached) return cached;
    const event = eventById.get(eventId);
    if (!event || visiting.has(eventId)) return eventId;
    const nextVisiting = new Set(visiting);
    nextVisiting.add(eventId);
    const parent = structuralParent(event);
    const anchor = parent && eventById.has(parent)
      ? anchorOf(parent, nextVisiting)
      : event.id;
    anchorCache.set(eventId, anchor);
    return anchor;
  };

  for (const event of events) anchorOf(event.id);

  const issues = deriveOpenMeetingIssues(participants, events);
  const issuesByAnchor = new Map<string, OpenMeetingIssue[]>();
  for (const issue of issues) {
    const anchorId = anchorOf(issue.sourceEventId);
    const current = issuesByAnchor.get(anchorId) ?? [];
    current.push(issue);
    issuesByAnchor.set(anchorId, current);
  }

  const eventsByAnchor = new Map<string, CouncilEvent[]>();
  for (const event of events) {
    const anchorId = anchorOf(event.id);
    const current = eventsByAnchor.get(anchorId) ?? [];
    current.push(event);
    eventsByAnchor.set(anchorId, current);
  }

  const threads: ConflictThread[] = [];
  for (const [anchorEventId, threadEvents] of eventsByAnchor) {
    const anchor = eventById.get(anchorEventId);
    if (!anchor) continue;
    const threadIssues = issuesByAnchor.get(anchorEventId) ?? [];
    const counts = countActivities(threadEvents);
    const hasInteraction = threadEvents.length > 1
      || threadIssues.length > 0
      || counts.challenge > 0
      || counts.support > 0
      || counts.evidence > 0
      || counts.question > 0
      || counts.reply > 0
      || counts.defense > 0
      || counts.revision > 0
      || counts.concede > 0;
    if (!hasInteraction) continue;

    const participantIds = unique(threadEvents.map((event) => event.actorId));
    const directRequestCount = threadEvents.filter((event) =>
      Boolean(directPeerRequestTarget(event, eventById)),
    ).length;
    const movementEventIds = threadEvents
      .filter((event) => event.kind === "revision" || event.kind === "concede")
      .map((event) => event.id);
    const externalInfluences = deriveExternalInfluences(
      anchorEventId,
      threadEvents,
      anchorOf,
      eventById,
      participantNames,
    );

    threads.push({
      id: `conflict:${anchorEventId}`,
      anchorEventId,
      anchorKind: anchor.kind,
      anchorActorId: anchor.actorId,
      anchorActorName: actorName(participantNames, anchor.actorId),
      anchorRound: anchor.round,
      ...(stanceOf(anchor) ? { anchorStance: stanceOf(anchor)! } : {}),
      anchorExcerpt: compact(eventText(anchor), 220),
      status: threadStatus(threadIssues, counts, directRequestCount),
      latestRound: Math.max(...threadEvents.map((event) => event.round)),
      eventIds: threadEvents.map((event) => event.id),
      participantIds,
      participantNames: participantIds.map((actorId) => actorName(participantNames, actorId)),
      counts,
      directRequestCount,
      openIssueIds: threadIssues.map((issue) => issue.id),
      openIssueEventIds: threadIssues.map((issue) => issue.sourceEventId),
      movementEventIds,
      externalInfluences,
      activities: threadEvents.map((event) => activity(event, participantNames)),
    });
  }

  threads.sort((a, b) =>
    statusRank(a.status) - statusRank(b.status)
      || b.latestRound - a.latestRound
      || b.eventIds.length - a.eventIds.length
      || a.anchorEventId.localeCompare(b.anchorEventId),
  );

  return {
    threads,
    eventThreadIds: Object.fromEntries(events.map((event) => [event.id, `conflict:${anchorOf(event.id)}`])),
    openIssueCount: issues.length,
  };
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

function deriveExternalInfluences(
  threadAnchorId: string,
  threadEvents: readonly CouncilEvent[],
  anchorOf: (eventId: string) => string,
  eventById: ReadonlyMap<string, CouncilEvent>,
  participantNames: ReadonlyMap<string, string>,
): ConflictThreadExternalInfluence[] {
  const result: ConflictThreadExternalInfluence[] = [];
  for (const event of threadEvents) {
    if (event.kind !== "revision") continue;
    for (const causeEventId of event.causedBy ?? []) {
      const cause = eventById.get(causeEventId);
      if (!cause) continue;
      const causeAnchorId = anchorOf(causeEventId);
      if (causeAnchorId === threadAnchorId) continue;
      result.push({
        causeEventId,
        causeThreadId: `conflict:${causeAnchorId}`,
        revisionEventId: event.id,
        actorId: cause.actorId,
        actorName: actorName(participantNames, cause.actorId),
      });
    }
  }
  return uniqueBy(result, (item) => `${item.causeEventId}:${item.revisionEventId}`);
}

function countActivities(events: readonly CouncilEvent[]): ConflictThreadCounts {
  return {
    challenge: events.filter((event) => event.kind === "challenge").length,
    support: events.filter((event) => event.kind === "support").length,
    evidence: events.filter((event) => event.kind === "evidence").length,
    question: events.filter((event) => event.kind === "question").length,
    reply: events.filter((event) => Boolean(replyToEventId(event))).length,
    defense: events.filter((event) => event.kind === "defense").length,
    revision: events.filter((event) => event.kind === "revision").length,
    concede: events.filter((event) => event.kind === "concede").length,
  };
}

function threadStatus(
  issues: readonly OpenMeetingIssue[],
  counts: ConflictThreadCounts,
  directRequestCount: number,
): ConflictThreadStatus {
  if (issues.length) return "open";
  if (counts.revision) return "position_changed";
  if (counts.concede) return "conceded";
  if (directRequestCount) return "answered";
  return "active";
}

function activity(
  event: CouncilEvent,
  participantNames: ReadonlyMap<string, string>,
): ConflictThreadActivity {
  const targetEventId = targetedEventId(event);
  const reply = replyToEventId(event);
  return {
    eventId: event.id,
    kind: event.kind,
    actorId: event.actorId,
    actorName: actorName(participantNames, event.actorId),
    round: event.round,
    excerpt: compact(eventText(event), 180),
    ...(targetEventId ? { targetEventId } : {}),
    ...(reply ? { replyToEventId: reply } : {}),
  };
}

function targetedEventId(event: CouncilEvent): string | undefined {
  if (
    event.kind === "challenge"
    || event.kind === "support"
    || event.kind === "defense"
    || event.kind === "concede"
  ) return event.targetEventId;
  if (event.kind === "evidence") return event.targetEventId;
  if (event.kind === "revision") return event.previousEventId;
  return undefined;
}

function replyToEventId(event: CouncilEvent): string | undefined {
  if (
    event.kind === "argument"
    || event.kind === "evidence"
    || event.kind === "question"
    || event.kind === "uncertain"
  ) return event.replyToEventId;
  return undefined;
}

function eventText(event: CouncilEvent): string {
  if (event.kind === "evidence") return `${event.claim} — ${event.content}`;
  return event.content;
}

function stanceOf(event: CouncilEvent): string | undefined {
  if (event.kind === "argument" || event.kind === "revision" || event.kind === "final_position") {
    return event.stance;
  }
  return undefined;
}

function actorName(names: ReadonlyMap<string, string>, actorId: string): string {
  return names.get(actorId) ?? actorId;
}

function compact(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function uniqueBy<T>(values: readonly T[], key: (value: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const value of values) {
    const id = key(value);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(value);
  }
  return result;
}

function statusRank(status: ConflictThreadStatus): number {
  if (status === "open") return 0;
  if (status === "position_changed") return 1;
  if (status === "conceded") return 2;
  if (status === "answered") return 3;
  return 4;
}
