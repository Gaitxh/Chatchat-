import { Blackboard } from "./blackboard.js";
import { createId } from "./ids.js";
import type {
  CouncilAgent,
  CouncilConsultationMode,
  CouncilContext,
  CouncilContribution,
  CouncilEvent,
  CouncilParticipant,
  CouncilReport,
  CouncilRunOptions,
  CouncilToolFact,
} from "./types.js";

const DEFAULT_MODE: CouncilConsultationMode = "balanced";

export class CouncilOrchestrator {
  readonly #agents: readonly CouncilAgent[];

  constructor(agents: readonly CouncilAgent[]) {
    if (agents.length < 2) throw new Error("A council requires at least two agents.");
    if (new Set(agents.map((agent) => agent.participant.id)).size !== agents.length) {
      throw new Error("Council participant ids must be unique.");
    }
    this.#agents = agents;
  }

  get participants(): readonly CouncilParticipant[] {
    return this.#agents.map((agent) => agent.participant);
  }

  async run(question: string, options: CouncilRunOptions = {}) {
    const mode = options.mode ?? DEFAULT_MODE;
    const maxRounds = Math.max(2, options.maxRounds ?? 3);
    const minDebateRounds = Math.max(1, options.minDebateRounds ?? 1);
    const convergenceThreshold = options.convergenceThreshold ?? 0.75;
    if (convergenceThreshold <= 0 || convergenceThreshold > 1) {
      throw new Error("convergenceThreshold must be in the interval (0, 1].");
    }

    const sessionId = createId("session");
    const blackboard = new Blackboard();

    await options.onPhase?.({ phase: "sealed", round: 1 });
    const sealedFacts = await this.#facts(options, "sealed", 1, []);
    const sealed = await Promise.all(this.#agents.map(async (agent) => ({
      agent,
      contributions: await agent.respond(this.#context(agent, blackboard, sessionId, question, mode, "sealed", 1, [], sealedFacts)),
    })));
    await this.#publish(blackboard, sealed.flatMap(({ agent, contributions }) =>
      contributions.map((item) => this.#materialize(sessionId, 1, agent.participant.id, item))), options);

    let lastRound = 1;
    for (let round = 2; round <= maxRounds; round += 1) {
      await options.onPhase?.({ phase: "debate", round });
      const snapshot = [...blackboard.events];
      const facts = await this.#facts(options, "debate", round, snapshot);
      const turns = await Promise.all(this.#agents.map(async (agent) => ({
        agent,
        contributions: await agent.respond(this.#context(agent, blackboard, sessionId, question, mode, "debate", round, snapshot, facts)),
      })));
      const roundEvents = turns.flatMap(({ agent, contributions }) =>
        contributions.map((item) => this.#materialize(sessionId, round, agent.participant.id, item)));
      await this.#publish(blackboard, roundEvents, options);
      lastRound = round;

      const convergenceReached = this.#consensusRatio(blackboard) >= convergenceThreshold;
      const minimumReached = round - 1 >= minDebateRounds;
      // Every participant in this batch responded to the same immutable pre-round
      // snapshot. If the batch itself introduces a new claim, challenge, evidence,
      // revision, question, or uncertainty, peers have not seen that information yet.
      // A numerical majority must not gain the power to end deliberation before one
      // follow-up batch can inspect the new signal.
      const needsPeerFollowUp = this.#roundNeedsPeerFollowUp(roundEvents);
      if (minimumReached && convergenceReached && !needsPeerFollowUp) break;
    }

    const finalRound = lastRound + 1;
    await options.onPhase?.({ phase: "final", round: finalRound });
    const finalSnapshot = [...blackboard.events];
    const finalFacts = await this.#facts(options, "final", finalRound, finalSnapshot);
    const finalTurns = await Promise.all(this.#agents.map(async (agent) => ({
      agent,
      contributions: await agent.respond(this.#context(agent, blackboard, sessionId, question, mode, "final", finalRound, finalSnapshot, finalFacts)),
    })));
    await this.#publish(blackboard, finalTurns.flatMap(({ agent, contributions }) =>
      contributions.map((item) => this.#materialize(sessionId, finalRound, agent.participant.id, item))), options);

    return { report: this.#report(sessionId, question, mode, finalRound, blackboard), blackboard };
  }

  #context(
    agent: CouncilAgent,
    blackboard: Blackboard,
    sessionId: string,
    question: string,
    mode: CouncilConsultationMode,
    phase: CouncilContext["phase"],
    round: number,
    publicEvents: readonly CouncilEvent[],
    toolFacts: readonly CouncilToolFact[],
  ): CouncilContext {
    return {
      sessionId,
      question,
      mode,
      phase,
      round,
      participant: agent.participant,
      publicEvents,
      ownEvents: blackboard.forActor(agent.participant.id),
      ...(toolFacts.length ? { toolFacts } : {}),
    };
  }

  async #facts(
    options: CouncilRunOptions,
    phase: CouncilContext["phase"],
    round: number,
    publicEvents: readonly CouncilEvent[],
  ): Promise<readonly CouncilToolFact[]> {
    if (!options.toolFactsProvider) return [];
    try {
      return [...await options.toolFactsProvider({ phase, round, publicEvents })];
    } catch (error) {
      await options.onToolError?.(error);
      return [];
    }
  }

  #materialize(sessionId: string, round: number, actorId: string, contribution: CouncilContribution): CouncilEvent {
    return { ...contribution, id: createId("event"), sessionId, round, actorId, createdAt: new Date().toISOString() } as CouncilEvent;
  }

  async #publish(blackboard: Blackboard, events: readonly CouncilEvent[], options: CouncilRunOptions) {
    for (const event of events) {
      blackboard.publish(event);
      await options.onEvent?.(event);
    }
  }

  #roundNeedsPeerFollowUp(events: readonly CouncilEvent[]): boolean {
    return events.some((event) => {
      switch (event.kind) {
        case "argument":
        case "challenge":
        case "evidence":
        case "revision":
        case "question":
        case "uncertain":
          return true;
        default:
          return false;
      }
    });
  }

  #consensusRatio(blackboard: Blackboard) {
    const positions = this.#agents
      .map((agent) => blackboard.latestPositionEvent(agent.participant.id))
      .filter((event) => event !== undefined);
    if (!positions.length) return 0;
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
    mode: CouncilConsultationMode,
    rounds: number,
    blackboard: Blackboard,
  ): CouncilReport {
    const positions = blackboard.finalPositions(this.#agents.map((agent) => agent.participant));
    const groups = new Map<string, typeof positions>();
    for (const position of positions) {
      const key = normalizeStance(position.stance);
      const current = groups.get(key) ?? [];
      current.push(position);
      groups.set(key, current);
    }
    const winner = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    if (!winner) {
      return { sessionId, question, mode, consensusStance: null, consensusRatio: 0, confidence: 0, rounds, positions, disagreements: [], eventCount: blackboard.events.length };
    }
    const [winnerKey, winnerPositions] = winner;
    return {
      sessionId,
      question,
      mode,
      consensusStance: winnerPositions[0]?.stance ?? null,
      consensusRatio: winnerPositions.length / this.#agents.length,
      confidence: winnerPositions.reduce((sum, position) => sum + position.confidence, 0) / winnerPositions.length,
      rounds,
      positions,
      disagreements: positions.filter((position) => normalizeStance(position.stance) !== winnerKey),
      eventCount: blackboard.events.length,
    };
  }
}

function normalizeStance(stance: string): string {
  return stance.trim().toLocaleLowerCase();
}
