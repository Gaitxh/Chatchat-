import { CouncilOrchestrator } from "../src/core/orchestrator.js";
import type {
  CouncilAgent,
  CouncilContext,
  CouncilContribution,
  CouncilEvent,
  CouncilPhaseUpdate,
} from "../src/core/types.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const freshPhases: CouncilPhaseUpdate[] = [];
const freshEvents: CouncilEvent[] = [];
const freshCouncil = new CouncilOrchestrator([
  scriptedAgent("fresh-a", "A", (context) => {
    if (context.phase === "debate" && context.round === 2) {
      return [{
        kind: "evidence",
        claim: "A fresh sourced fact entered after peers received the old snapshot.",
        content: "Peers must get another open turn before this can count as having influenced them.",
        source: "https://example.com/fresh-evidence",
        confidence: 0.9,
      }];
    }
    return [];
  }),
  scriptedAgent("fresh-b", "A"),
  scriptedAgent("fresh-c", "A"),
]);
const freshResult = await freshCouncil.run("fresh signal agenda", {
  maxRounds: 3,
  minDebateRounds: 1,
  convergenceThreshold: 0.75,
  onPhase(update) { freshPhases.push(clonePhase(update)); },
  onEvent(event) { freshEvents.push(event); },
});

assert(freshPhases[0]?.reason === "sealed_start", "Round 1 must explain that sealed independent analysis is starting.");
assert(freshPhases[1]?.phase === "debate" && freshPhases[1]?.reason === "initial_debate", "Round 2 must explain that independent views are entering the first shared debate.");
const evidence = freshEvents.find((event) => event.kind === "evidence" && event.round === 2);
assert(evidence, "Fresh-signal agenda test must publish real round-two evidence.");
const followUp = freshPhases.find((update) => update.phase === "debate" && update.round === 3);
assert(followUp?.reason === "fresh_signal_follow_up", "A fresh evidence batch must explain that peers need another response round.");
assert(followUp.triggerEventIds?.includes(evidence.id), "The follow-up reason must carry the exact evidence event id that forced continuation.");
assert(followUp.alignmentRatio === 1, "Live Agenda metrics must report the pre-round alignment that would otherwise look converged.");
assert(followUp.convergenceThreshold === 0.75, "Live Agenda metrics must expose the configured convergence threshold.");
assert(followUp.debateRoundsCompleted === 1, "Follow-up metrics must count completed open debate rounds before the next round begins.");
const freshFinal = freshPhases.at(-1);
assert(freshFinal?.phase === "final" && freshFinal.reason === "finalizing_stable_alignment", "After peers inspect the fresh evidence and the next batch is calm, final phase must explain stable convergence.");
assert(freshResult.report.stopReason === "stable_alignment_no_new_signal", "Final phase explanation and stored stop reason must agree.");

const minimumPhases: CouncilPhaseUpdate[] = [];
await new CouncilOrchestrator([
  scriptedAgent("min-a", "A"),
  scriptedAgent("min-b", "A"),
  scriptedAgent("min-c", "A"),
]).run("minimum debate agenda", {
  maxRounds: 3,
  minDebateRounds: 2,
  convergenceThreshold: 0.75,
  onPhase(update) { minimumPhases.push(clonePhase(update)); },
});
const minimumRound = minimumPhases.find((update) => update.phase === "debate" && update.round === 3);
assert(minimumRound?.reason === "minimum_debate_rounds", "A quiet aligned meeting must continue when the selected mode still owes a minimum debate round.");
assert(minimumRound.debateRoundsCompleted === 1 && minimumRound.minimumDebateRounds === 2, "Minimum-round explanation must expose completed and required debate counts.");

const alignmentPhases: CouncilPhaseUpdate[] = [];
const alignmentResult = await new CouncilOrchestrator([
  scriptedAgent("align-a", "A"),
  scriptedAgent("align-b", "B"),
  scriptedAgent("align-c", "C"),
]).run("alignment agenda", {
  maxRounds: 3,
  minDebateRounds: 1,
  convergenceThreshold: 0.75,
  onPhase(update) { alignmentPhases.push(clonePhase(update)); },
});
const alignmentRound = alignmentPhases.find((update) => update.phase === "debate" && update.round === 3);
assert(alignmentRound?.reason === "alignment_not_reached", "Once minimum debate is satisfied, low alignment must be the explicit reason another round exists.");
assert(Math.abs((alignmentRound.alignmentRatio ?? 0) - 1 / 3) < 1e-9, "Alignment explanation must expose the actual stance distribution ratio.");
assert(alignmentRound.convergenceThreshold === 0.75, "Alignment explanation must expose the target threshold rather than a UI constant.");
const budgetFinal = alignmentPhases.at(-1);
assert(budgetFinal?.phase === "final" && budgetFinal.reason === "finalizing_round_budget", "When the open-round ceiling is exhausted before stable convergence, Final must say it is a budget boundary.");
assert(alignmentResult.report.stopReason === "round_budget", "Round-budget agenda reason and stored stop provenance must agree.");

console.log("✓ ChatChat Live Agenda continuation-reason tests passed");
console.log("✓ Fresh-signal follow-up carries exact Blackboard event ids and convergence metrics");
console.log("✓ Minimum-round, low-alignment, stable-final and round-budget reasons are engine-owned facts");

function scriptedAgent(
  id: string,
  stance: string,
  debate?: (context: CouncilContext) => readonly CouncilContribution[],
): CouncilAgent {
  return {
    participant: { id, name: id, provider: "test" },
    async respond(context): Promise<readonly CouncilContribution[]> {
      if (context.phase === "sealed") {
        return [{ kind: "argument", stance, content: `${id} independent ${stance}`, confidence: 0.8 }];
      }
      if (context.phase === "debate") return debate?.(context) ?? [];
      return [{ kind: "final_position", stance, content: `${id} final ${stance}`, confidence: 0.82 }];
    },
  };
}

function clonePhase(update: CouncilPhaseUpdate): CouncilPhaseUpdate {
  return {
    ...update,
    ...(update.triggerEventIds ? { triggerEventIds: [...update.triggerEventIds] } : {}),
  };
}
