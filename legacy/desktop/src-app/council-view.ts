import type {
  ArgumentEvent,
  CouncilEvent,
  CouncilParticipant,
  FinalPositionEvent,
  RevisionEvent,
} from "../core/types.js";

export type PositionEvent = ArgumentEvent | RevisionEvent | FinalPositionEvent;

export const eventPresentation: Record<
  CouncilEvent["kind"],
  { icon: string; label: string }
> = {
  argument: { icon: "💬", label: "奏议" },
  challenge: { icon: "⚔️", label: "质询" },
  evidence: { icon: "📎", label: "举证" },
  support: { icon: "🤝", label: "附议" },
  defense: { icon: "🛡️", label: "答辩" },
  revision: { icon: "🔄", label: "改口" },
  concede: { icon: "🏳️", label: "让步" },
  question: { icon: "❓", label: "追问" },
  uncertain: { icon: "⚠️", label: "存疑" },
  final_position: { icon: "📜", label: "最终立场" },
};

export function isPositionEvent(event: CouncilEvent): event is PositionEvent {
  return (
    event.kind === "argument" ||
    event.kind === "revision" ||
    event.kind === "final_position"
  );
}

export function latestPosition(
  events: readonly CouncilEvent[],
  actorId: string,
): PositionEvent | undefined {
  return [...events]
    .reverse()
    .find(
      (event): event is PositionEvent =>
        event.actorId === actorId && isPositionEvent(event),
    );
}

export function eventText(event: CouncilEvent): string {
  if (event.kind === "evidence") {
    return `${event.claim} — ${event.content}`;
  }
  return event.content;
}

export function eventTargetName(
  event: CouncilEvent,
  events: readonly CouncilEvent[],
  participants: readonly CouncilParticipant[],
): string | null {
  if (event.kind === "question" && event.targetActorId) {
    return (
      participants.find((participant) => participant.id === event.targetActorId)
        ?.name ?? event.targetActorId
    );
  }

  if (
    event.kind !== "challenge" &&
    event.kind !== "support" &&
    event.kind !== "defense" &&
    event.kind !== "concede"
  ) {
    return null;
  }

  const targetEvent = events.find(
    (candidate) => candidate.id === event.targetEventId,
  );
  if (!targetEvent) return null;

  return (
    participants.find((participant) => participant.id === targetEvent.actorId)
      ?.name ?? targetEvent.actorId
  );
}

export function confidencePercent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
