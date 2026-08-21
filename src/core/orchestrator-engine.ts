import { pendingDirectRequestEventIds } from "../consultation/direct-response-receipts.js";
import { Blackboard } from "./blackboard.js";
import { createId } from "./ids.js";
import type {
  CouncilAgent,
  CouncilConsultationMode,
  CouncilContext,
  CouncilContribution,
  CouncilEvent,
  CouncilParticipant,
  CouncilPhaseReason,
  CouncilReport,
  CouncilResearchLane,
  CouncilRunOptions,
  CouncilStopReason,
  CouncilToolFact,
} from "./types.js";

const DEFAULT_MODE: CouncilConsultationMode = "balanced";
const FIRST_PUBLIC_DEBATE_ROUND = 2;

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
    const researchLaneAssignments = { ...(options.researchLaneAssignments ?? {}) };
    if (convergenceThreshold <= 0 || convergenceThreshold > 1) {
      throw new Error("convergenceThreshold must be in the interval (0, 1].");
    }

    const sessionId = createId("session");
    const blackboard = new Blackboard();

    await options.onPhase?.({
      phase: "sealed",
      round: 1,
      reason: "sealed_start",
      convergenceThreshold,
      debateRoundsCompleted: 0,
      minimumDebateRounds: minDebateRounds,
    });
    const sealedFacts = await this.#facts(options, "sealed", 1, []);
    const sealed = await Promise.all(this.#agents.map(async (agent) => ({
      agent,
      contributions: await this.#respond(
        agent,
        this.#context(
          agent,
          blackboard,
          sessionId,
          question,
          mode,
          "sealed",
          1,
          [],
          sealedFacts,
          researchLaneAssignments[agent.participant.id],
        ),
        options,
      ),
    })));
    await this.#publish(blackboard, sealed.flatMap(({ agent, contributions }) =>
      contributions.map((item) => this.#materialize(sessionId, 1, agent.participant.id, item))), options);

    let lastRound = 1;
    let stopReason: CouncilStopReason = "round_budget";
    let previousDebateEvents: CouncilEvent[] = [];
    for (let round = 2; round <= maxRounds; round += 1) {
      const alignmentRatio = this.#consensusRatio(blackboard);
      const debateRoundsCompleted = round - 2;
      const unansweredDirectRequestEventIds = this.#unansweredDirectRequestEventIds(blackboard.events);
      const triggerEventIds = unique([
        ...this.#peerFollowUpEventIds(previousDebateEvents),
        ...unansweredDirectRequestEventIds,
      ]);
      const reason = this.#debateReason(
        round,
        debateRoundsCompleted,
        minDebateRounds,
        alignmentRatio,
        convergenceThreshold,
        triggerEventIds,
      );
      await options.onPhase?.({
        phase: "debate",
        round,
        reason,
        ...(reason === "fresh_signal_follow_up" ? { triggerEventIds } : {}),
        alignmentRatio,
        convergenceThreshold,
        debateRoundsCompleted,
        minimumDebateRounds: minDebateRounds,
      });
      const snapshot = [...blackboard.events];
      const facts = await this.#facts(options, "debate", round, snapshot);
      const turns = await Promise.all(this.#agents.map(async (agent) => ({
        agent,
        contributions: await this.#respond(
          agent,
          this.#context(
            agent,
            blackboard,
            sessionId,
            question,
            mode,
            "debate",
            round,
            snapshot,
            facts,
            researchLaneAssignments[agent.participant.id],
          ),
          options,
        ),
      })));
      const roundEvents = turns.flatMap(({ agent, contributions }) =>
        contributions.map((item) => this.#materialize(sessionId, round, agent.participant.id, item)));
      await this.#publish(blackboard, roundEvents, options);
      lastRound = round;
      previousDebateEvents = roundEvents;

      const convergenceReached = this.#consensusRatio(blackboard) >= convergenceThreshold;
      const minimumReached = round - 1 >= minDebateRounds;
      const unansweredAfterRound = this.#unansweredDirectRequestEventIds(blackboard.events);
      const needsPeerFollowUp = this.#roundNeedsPeerFollowUp(roundEvents) || unansweredAfterRound.length > 0;
      if (minimumReached && convergenceReached && !needsPeerFollowUp) {
        stopReason = "stable_alignment_no_new_signal";
        break;
      }
    }

    const finalRound = lastRound + 1;
    await options.onPhase?.({
      phase: "final",
      round: finalRound,
      reason: stopReason === "stable_alignment_no_new_signal"
        ? "finalizing_stable_alignment"
        : "finalizing_round_budget",
      alignmentRatio: this.#consensusRatio(blackboard),
      convergenceThreshold,
      debateRoundsCompleted: Math.max(0, lastRound - 1),
      minimumDebateRounds: minDebateRounds,
    });
    const finalSnapshot = [...blackboard.events];
    const finalFacts = await this.#facts(options, "final", finalRound, finalSnapshot);
    const finalTurns = await Promise.all(this.#agents.map(async (agent) => ({
      agent,
      contributions: await this.#respond(
        agent,
        this.#context(
          agent,
          blackboard,
          sessionId,
          question,
          mode,
          "final",
          finalRound,
          finalSnapshot,
          finalFacts,
          researchLaneAssignments[agent.participant.id],
        ),
        options,
      ),
    })));
    await this.#publish(blackboard, finalTurns.flatMap(({ agent, contributions }) =>
      contributions.map((item) => this.#materialize(sessionId, finalRound, agent.participant.id, item))), options);

    return {
      report: this.#report(
        sessionId,
        question,
        mode,
        stopReason,
        researchLaneAssignments,
        finalRound,
        blackboard,
      ),
      blackboard,
    };
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
    researchLane?: CouncilResearchLane,
  ): CouncilContext {
    return {
      sessionId,
      question,
      mode,
      phase,
      round,
      ...(researchLane ? { researchLane } : {}),
      participant: agent.participant,
      publicEvents,
      ownEvents: blackboard.forActor(agent.participant.id),
      ...(toolFacts.length ? { toolFacts } : {}),
    };
  }

  async #respond(
    agent: CouncilAgent,
    context: CouncilContext,
    options: CouncilRunOptions,
  ): Promise<readonly CouncilContribution[]> {
    await options.onParticipantTurn?.({
      phase: context.phase,
      round: context.round,
      participant: agent.participant,
      state: "working",
      ...(context.researchLane ? { researchLane: context.researchLane } : {}),
    });
    try {
      const contributions = await agent.respond(context);
      await options.onParticipantTurn?.({
        phase: context.phase,
        round: context.round,
        participant: agent.participant,
        state: "completed",
        ...(context.researchLane ? { researchLane: context.researchLane } : {}),
        contributionKinds: contributions.map((item) => item.kind),
      });
      return contributions;
    } catch (error) {
      await options.onParticipantTurn?.({
        phase: context.phase,
        round: context.round,
        participant: agent.participant,
        state: "failed",
        ...(context.researchLane ? { researchLane: context.researchLane } : {}),
      });
      throw error;
    }
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

  #debateReason(
    round: number,
    debateRoundsCompleted: number,
    minimumDebateRounds: number,
    alignmentRatio: number,
    convergenceThreshold: number,
    triggerEventIds: readonly string[],
  ): CouncilPhaseReason {
    if (round === 2) return "initial_debate";
    if (triggerEventIds.length) return "fresh_signal_follow_up";
    if (debateRoundsCompleted < minimumDebateRounds) return "minimum_debate_rounds";
    if (alignmentRatio < convergenceThreshold) return "alignment_not_reached";
    return "alignment_not_reached";
  }

  #peerFollowUpEventIds(events: readonly CouncilEvent[]): string[] {
    return events.filter((event) => this.#eventNeedsPeerFollowUp(event)).map((event) => event.id);
  }

  #roundNeedsPeerFollowUp(events: readonly CouncilEvent[]): boolean {
    return events.some((event) => this.#eventNeedsPeerFollowUp(event));
  }

  #eventNeedsPeerFollowUp(event: CouncilEvent): boolean {
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
  }

  #unansweredDirectRequestEventIds(events: readonly CouncilEvent[]): string[] {
    const pending = new Set(pendingDirectRequestEventIds(events));
    return events
      .filter((event) => event.round >= FIRST_PUBLIC_DEBATE_ROUND && pending.has(event.id))
      .map((event) => event.id);
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
    stopReason: CouncilStopReason,
    researchLaneAssignments: Readonly<Record<string, CouncilResearchLane>>,
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
    const laneRecord = Object.keys(researchLaneAssignments).length
      ? { researchLaneAssignments: { ...researchLaneAssignments } }
      : {};
    const unansweredDirectRequestEventIds = this.#unansweredDirectRequestEventIds(blackboard.events);
    const directResponseRecord = unansweredDirectRequestEventIds.length
      ? { unansweredDirectRequestEventIds }
      : {};
    const winner = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    if (!winner) {
      return {
        sessionId,
        question,
        mode,
        stopReason,
        ...laneRecord,
        ...directResponseRecord,
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
    return {
      sessionId,
      question,
      mode,
      stopReason,
      ...laneRecord,
      ...directResponseRecord,
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

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
