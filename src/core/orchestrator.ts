import { Blackboard } from "./blackboard.js";
import { createId } from "./ids.js";
import type {
  CouncilAgent,
  CouncilContext,
  CouncilContribution,
  CouncilEvent,
  CouncilReport,
  CouncilRunOptions,
} from "./types.js";

const DEFAULT_MAX_ROUNDS = 3;
const DEFAULT_MIN_DEBATE_ROUNDS = 1;
const DEFAULT_CONVERGENCE_THRESHOLD = 0.75;

export class CouncilOrchestrator {
  readonly #agents: readonly CouncilAgent[];

  constructor(agents: readonly CouncilAgent[]) {
    if (agents.length < 2) {
      throw new Error("A council requires at least two agents.");
    }
    const ids = new Set(agents.map((agent) => agent.participant.id));
    if (ids.size !== agents.length) {
      throw new Error("Council participant ids must be unique.");
    }
    this.#agents = agents;
  }

  async run(
    question: string,
    options: CouncilRunOptions = {},
  ): Promise<{ report: CouncilReport; blackboard: Blackboard }> {
    const maxRounds = Math.max(2, options.maxRounds ?? DEFAULT_MAX_ROUNDS);
    const minDebateRounds = Math.max(
      1,
      options.minDebateRounds ?? DEFAULT_MIN_DEBATE_ROUNDS,
    );
    const convergenceThreshold =
      options.convergenceThreshold ?? DEFAULT_CONVERGENCE_THRESHOLD;

    if (convergenceThreshold <= 0 || convergenceThreshold > 1) {
      throw new Error("convergenceThreshold must be in the interval (0, 1].");
    }

    const sessionId = createId("session");
    const blackboard = new Blackboard();

    await options.onPhase?.({ phase: "sealed", round: 1 });

    const sealed = await Promise.all(
      this.#agents.map(async (agent) => ({
        agent,
        contributions: await agent.respond(
          this.#contextFor(
            agent,
            blackboard,
            sessionId,
            question,
            "sealed",
            1,
            [],
          ),
        ),
      })),
    );

    await this.#publishBatch(
      blackboard,
      sealed.flatMap(({ agent, contributions }) =>
        contributions.map((contribution) =>
          this.#materialize(sessionId, 1, agent.participant.id, contribution),
        ),
      ),
      options,
    );

    let lastRound = 1;

    for (let round = 2; round <= maxRounds; round += 1) {
      await options.onPhase?.({ phase: "debate", round });
      const snapshot = [...blackboard.events];
      const turns = await Promise.all(
        this.#agents.map(async (agent) => ({
          agent,
          contributions: await agent.respond(
            this.#contextFor(
              agent,
              blackboard,
              sessionId,
              question,
              "debate",
              round,
              snapshot,
            ),
          ),
        })),
      );

      await this.#publishBatch(
        blackboard,
        turns.flatMap(({ agent, contributions }) =>
          contributions.map((contribution) =>
            this.#materialize(
              sessionId,
              round,
              agent.participant.id,
              contribution,
            ),
          ),
        ),
        options,
      );

      lastRound = round;
      if (
        round - 1 >= minDebateRounds &&
        this.#consensusRatio(blackboard) >= convergenceThreshold
      ) {
        break;
      }
    }

    const finalRound = lastRound + 1;
    await options.onPhase?.({ phase: "final", round: finalRound });

    const finalSnapshot = [...blackboard.events];
    const finalTurns = await Promise.all(
      this.#agents.map(async (agent) => ({
        agent,
        contributions: await agent.respond(
          this.#contextFor(
            agent,
            blackboard,
            sessionId,
            question,
            "final",
            finalRound,
            finalSnapshot,
          ),
        ),
      })),
    );

    await this.#publishBatch(
      blackboard,
      finalTurns.flatMap(({ agent, contributions }) =>
        contributions.map((contribution) =>
          this.#materialize(
            sessionId,
            finalRound,
            agent.participant.id,
            contribution,
          ),
        ),
      ),
      options,
    );

    return {
      report: this.#report(sessionId, question, finalRound, blackboard),
      blackboard,
    };
  }

  #contextFor(
    agent: CouncilAgent,
    blackboard: Blackboard,
    sessionId: string,
    question: string,
    phase: CouncilContext["phase"],
    round: number,
    publicEvents: readonly CouncilEvent[],
  ): CouncilContext {
    return {
      sessionId,
      question,
      phase,
      round,
      participant: agent.participant,
      publicEvents,
      ownEvents: blackboard.forActor(agent.participant.id),
    };
  }

  #materialize(
    sessionId: string,
    round: number,
    actorId: string,
    contribution: CouncilContribution,
  ): CouncilEvent {
    return {
      ...contribution,
      id: createId("event"),
      sessionId,
      round,
      actorId,
      createdAt: new Date().toISOString(),
    } as CouncilEvent;
  }

  async #publishBatch(
    blackboard: Blackboard,
    events: readonly CouncilEvent[],
    options: CouncilRunOptions,
  ): Promise<void> {
    for (const event of events) {
      blackboard.publish(event);
      await options.onEvent?.(event);
    }
  }

  #consensusRatio(blackboard: Blackboard): number {
    const positions = this.#agents
      .map((agent) => blackboard.latestPositionEvent(agent.participant.id))
      .filter((event) => event !== undefined);

    if (positions.length === 0) return 0;

    const counts = new Map<string, number>();
    for (const position of positions) {
      const key = normalizeStance(position.stance);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return Math.max(...counts.values()) / this.#agents.length;
  }

  #report(
    sessionId: string,
    question: string,
    rounds: number,
    blackboard: Blackboard,
  ): CouncilReport {
    const positions = blackboard.finalPositions(
      this.#agents.map((agent) => agent.participant),
    );

    const groups = new Map<string, typeof positions>();
    for (const position of positions) {
      const key = normalizeStance(position.stance);
      const current = groups.get(key) ?? [];
      current.push(position);
      groups.set(key, current);
    }

    const winner = [...groups.entries()].sort(
      (a, b) => b[1].length - a[1].length,
    )[0];

    if (!winner) {
      return {
        sessionId,
        question,
        consensusStance: null,
        consensusRatio: 0,
        confidence: 0,
        rounds,
        positions,
        disagreements: [],
        eventCount: blackboard.events.length,
      };
    }

    const [winnerKey, winnerPositions] = winner;
    const consensusStance = winnerPositions[0]?.stance ?? null;
    const confidence =
      winnerPositions.reduce((sum, position) => sum + position.confidence, 0) /
      winnerPositions.length;

    return {
      sessionId,
      question,
      consensusStance,
      consensusRatio: winnerPositions.length / this.#agents.length,
      confidence,
      rounds,
      positions,
      disagreements: positions.filter(
        (position) => normalizeStance(position.stance) !== winnerKey,
      ),
      eventCount: blackboard.events.length,
    };
  }
}

function normalizeStance(stance: string): string {
  return stance.trim().toLocaleLowerCase();
}
