import { CouncilOrchestrator } from "../src/core/orchestrator.js";
import type { CouncilAgent, CouncilContext, CouncilContribution, CouncilEvent, CouncilPhaseUpdate } from "../src/core/types.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const freshPhases: CouncilPhaseUpdate[] = [];
const freshEvents: CouncilEvent[] = [];
const freshCouncil = new CouncilOrchestrator([
  scriptedAgent("fresh-a", "A", (context) => context.phase === "debate" && context.round === 2 ? [{ kind: "evidence", claim: "Fresh evidence", content: "Peers have not seen this yet.", source: "https://example.com/evidence", confidence: 0.9 }] : []),
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

assert(freshPhases[0]?.reason === "sealed_start", "Round 1 must explain sealed independent analysis.");
assert(freshPhases[1]?.reason === "initial_debate", "First public round must explain shared debate is beginning.");
const evidence = freshEvents.find((event) => event.kind === "evidence" && event.round === 2);
assert(evidence, "Fresh-signal test must publish real evidence.");
const followUp = freshPhases.find((update) => update.phase === "debate" && update.round === 3);
assert(followUp?.reason === "fresh_signal_follow_up", "Fresh evidence must force a peer-visible follow-up reason.");
assert(followUp.triggerEventIds?.includes(evidence.id), "Follow-up reason must carry the exact triggering event id.");
assert(followUp.alignmentRatio === 1 && followUp.convergenceThreshold === 0.75, "Agenda metrics must expose actual alignment and threshold.");
assert(freshPhases.at(-1)?.reason === "finalizing_stable_alignment", "Calm follow-up after fresh evidence should explain stable finalization.");
assert(freshResult.report.stopReason === "stable_alignment_no_new_signal", "Stored stop reason must agree with final agenda reason.");

const minimumPhases: CouncilPhaseUpdate[] = [];
await new CouncilOrchestrator([scriptedAgent("min-a", "A"), scriptedAgent("min-b", "A"), scriptedAgent("min-c", "A")]).run("minimum debate", {
  maxRounds: 3,
  minDebateRounds: 2,
  convergenceThreshold: 0.75,
  onPhase(update) { minimumPhases.push(clonePhase(update)); },
});
assert(minimumPhases.find((update) => update.round === 3)?.reason === "minimum_debate_rounds", "Selected mode minimum debate must be an explicit continuation reason.");

const alignmentPhases: CouncilPhaseUpdate[] = [];
const alignmentResult = await new CouncilOrchestrator([scriptedAgent("align-a", "A"), scriptedAgent("align-b", "B"), scriptedAgent("align-c", "C")]).run("alignment", {
  maxRounds: 3,
  minDebateRounds: 1,
  convergenceThreshold: 0.75,
  onPhase(update) { alignmentPhases.push(clonePhase(update)); },
});
const alignmentRound = alignmentPhases.find((update) => update.phase === "debate" && update.round === 3);
assert(alignmentRound?.reason === "alignment_not_reached", "Low alignment must be the explicit reason another round exists.");
assert(Math.abs((alignmentRound.alignmentRatio ?? 0) - 1 / 3) < 1e-9, "Agenda must expose real stance alignment.");
assert(alignmentPhases.at(-1)?.reason === "finalizing_round_budget", "Budget-limited Final must say it is a round boundary.");
assert(alignmentResult.report.stopReason === "round_budget", "Stored stop provenance must agree with budget finalization.");

console.log("✓ ChatChat Live Agenda continuation-reason tests passed");

function scriptedAgent(id: string, stance: string, debate?: (context: CouncilContext) => readonly CouncilContribution[]): CouncilAgent {
  return {
    participant: { id, name: id, provider: "test" },
    async respond(context): Promise<readonly CouncilContribution[]> {
      if (context.phase === "sealed") return [{ kind: "argument", stance, content: `${id} independent ${stance}`, confidence: 0.8 }];
      if (context.phase === "debate") return debate?.(context) ?? [];
      return [{ kind: "final_position", stance, content: `${id} final ${stance}`, confidence: 0.82 }];
    },
  };
}

function clonePhase(update: CouncilPhaseUpdate): CouncilPhaseUpdate {
  return { ...update, ...(update.triggerEventIds ? { triggerEventIds: [...update.triggerEventIds] } : {}) };
}
