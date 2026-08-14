import type { CouncilEvent } from "../core/types.js";

export type DirectPeerRequestKind = "question" | "challenge" | "evidence";

export interface DirectPeerRequestTarget {
  kind: DirectPeerRequestKind;
  actorId: string;
  targetEventId?: string;
}

/**
 * Resolve who is actually being asked to respond. Questions name an actor
 * directly; targeted challenges/evidence inherit the actor who authored the
 * referenced event. Untargeted events intentionally return null.
 */
export function directPeerRequestTarget(
  event: CouncilEvent,
  eventById: ReadonlyMap<string, CouncilEvent>,
): DirectPeerRequestTarget | null {
  if (event.kind === "question" && event.targetActorId) {
    return { kind: "question", actorId: event.targetActorId };
  }
  if ((event.kind === "challenge" || event.kind === "evidence") && event.targetEventId) {
    const targetEvent = eventById.get(event.targetEventId);
    if (!targetEvent) return null;
    return { kind: event.kind, actorId: targetEvent.actorId, targetEventId: targetEvent.id };
  }
  return null;
}

/**
 * A direct request is answered only by structured provenance to that exact
 * request event. Similar prose is never enough.
 */
export function explicitlyAnswersRequest(event: CouncilEvent, requestEventId: string): boolean {
  if (
    (event.kind === "argument" || event.kind === "evidence" || event.kind === "question" || event.kind === "uncertain")
    && event.replyToEventId === requestEventId
  ) return true;

  if (
    (event.kind === "defense" || event.kind === "concede" || event.kind === "evidence")
    && event.targetEventId === requestEventId
  ) return true;

  return event.kind === "revision" && (event.causedBy ?? []).includes(requestEventId);
}

/** Every explicit event-to-event edge carried by the public protocol. */
export function eventReferences(event: CouncilEvent): string[] {
  const references: string[] = [];
  if (
    (event.kind === "argument" || event.kind === "evidence" || event.kind === "question" || event.kind === "uncertain")
    && event.replyToEventId
  ) references.push(event.replyToEventId);
  if (event.kind === "challenge" || event.kind === "support" || event.kind === "defense" || event.kind === "concede") {
    references.push(event.targetEventId);
  }
  if (event.kind === "evidence" && event.targetEventId) references.push(event.targetEventId);
  if (event.kind === "revision") references.push(event.previousEventId, ...(event.causedBy ?? []));
  return [...new Set(references)];
}
