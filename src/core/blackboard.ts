import type {
  ArgumentEvent,
  CouncilEvent,
  CouncilParticipant,
  CouncilPosition,
  FinalPositionEvent,
  RevisionEvent,
} from "./types.js";

type PositionLikeEvent = ArgumentEvent | RevisionEvent | FinalPositionEvent;

function isPositionEvent(event: CouncilEvent): event is PositionLikeEvent {
  return (
    event.kind === "argument" ||
    event.kind === "revision" ||
    event.kind === "final_position"
  );
}

export class Blackboard {
  readonly #events: CouncilEvent[] = [];

  get events(): readonly CouncilEvent[] {
    return this.#events;
  }

  publish(event: CouncilEvent): void {
    if (this.#events.some((existing) => existing.id === event.id)) {
      throw new Error(`Duplicate council event id: ${event.id}`);
    }
    this.#events.push(event);
  }

  publishMany(events: readonly CouncilEvent[]): void {
    for (const event of events) this.publish(event);
  }

  forActor(actorId: string): CouncilEvent[] {
    return this.#events.filter((event) => event.actorId === actorId);
  }

  find(eventId: string): CouncilEvent | undefined {
    return this.#events.find((event) => event.id === eventId);
  }

  latestPositionEvent(actorId: string): PositionLikeEvent | undefined {
    return this.#events
      .filter((event) => event.actorId === actorId)
      .filter(isPositionEvent)
      .at(-1);
  }

  finalPositions(
    participants: readonly CouncilParticipant[],
  ): CouncilPosition[] {
    const result: CouncilPosition[] = [];

    for (const participant of participants) {
      const final = this.#events
        .filter(
          (event): event is FinalPositionEvent =>
            event.actorId === participant.id &&
            event.kind === "final_position",
        )
        .at(-1);

      const event = final ?? this.latestPositionEvent(participant.id);
      if (!event) continue;

      result.push({
        participant,
        stance: event.stance,
        content: event.content,
        confidence: event.confidence,
        caveats: event.kind === "final_position" ? (event.caveats ?? []) : [],
      });
    }

    return result;
  }
}
