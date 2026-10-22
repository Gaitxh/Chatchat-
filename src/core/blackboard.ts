import type {
  ArgumentEvent,
  CouncilContribution,
  CouncilEvent,
  CouncilParticipant,
  CouncilPosition,
  FinalPositionEvent,
  RevisionEvent,
} from "./types.js";

type PositionLikeEvent = ArgumentEvent | RevisionEvent | FinalPositionEvent;

// Only trusted runtime code can mark a contribution. A JSON field, including
// a forged provenance object, cannot enter this identity registry.
const runtimeFallbacks = new WeakSet<CouncilContribution>();

export function runtimeFallbackContribution(contribution: CouncilContribution): CouncilContribution {
  const snapshot = immutableCopy(contribution);
  runtimeFallbacks.add(snapshot);
  return snapshot;
}

export function isRuntimeFallbackContribution(contribution: CouncilContribution): boolean {
  return runtimeFallbacks.has(contribution);
}

/** Protocol records contain structured data only; detach inputs before freezing. */
export function immutableCopy<T>(value: T): T {
  return freezeDeep(structuredClone(value));
}

function freezeDeep<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freezeDeep(child);
  }
  return value;
}

function isPositionEvent(event: CouncilEvent): event is PositionLikeEvent {
  return (
    event.provenance?.source !== "runtime_fallback" && (
      event.kind === "argument" ||
      event.kind === "revision" ||
      event.kind === "final_position"
    )
  );
}

export class Blackboard {
  #events: readonly CouncilEvent[] = Object.freeze([]);

  get events(): readonly CouncilEvent[] {
    return this.#events;
  }

  publish(event: CouncilEvent): CouncilEvent {
    if (this.#events.some((existing) => existing.id === event.id)) {
      throw new Error(`Duplicate council event id: ${event.id}`);
    }
    const published = immutableCopy(event);
    this.#events = Object.freeze([...this.#events, published]);
    return published;
  }

  publishMany(events: readonly CouncilEvent[]): void {
    for (const event of events) this.publish(event);
  }

  forActor(actorId: string): readonly CouncilEvent[] {
    return Object.freeze(this.#events.filter((event) => event.actorId === actorId));
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
        participant: { ...participant },
        stance: event.stance,
        content: event.content,
        confidence: event.confidence,
        caveats: event.kind === "final_position" ? [...(event.caveats ?? [])] : [],
        ...(event.provenance ? { provenance: { ...event.provenance } } : {}),
      });
    }

    return result;
  }
}
