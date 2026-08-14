import { CouncilOrchestrator } from "../src/core/orchestrator.js";
import type {
  CouncilAgent,
  CouncilContext,
  CouncilConsultationMode,
  CouncilParticipant,
  CouncilParticipantTurnUpdate,
  CouncilResearchLane,
} from "../src/core/types.js";
import { consultationModeRunPolicy } from "../src/consultation/mode-policy.js";
import { applyConsultationModePolicy } from "../src/consultation/mode-options.js";
import {
  CONSULTATION_MODES,
  consultationModeDefinition,
} from "../src/consultation/modes.js";
import {
  consultationResearchLaneAssignments,
  researchLaneDefinition,
} from "../src/consultation/research-lanes.js";
import { buildProviderConsultationPrompt } from "../src/provider-sdk/consultation-agent.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const expected: CouncilConsultationMode[] = ["balanced", "explore", "decide", "verify", "stress_test"];
assert(CONSULTATION_MODES.length === 5, "ChatChat should expose exactly five public Proposal Modes.");
assert(JSON.stringify(CONSULTATION_MODES.map((item) => item.id)) === JSON.stringify(expected), "Proposal Mode order should remain stable and intentional.");
assert(new Set(CONSULTATION_MODES.map((item) => item.id)).size === 5, "Proposal Mode ids must be unique.");

const balanced = consultationModeRunPolicy("balanced");
const explore = consultationModeRunPolicy("explore");
const verify = consultationModeRunPolicy("verify");
const stress = consultationModeRunPolicy("stress_test");
assert(balanced.maxRounds === 3 && balanced.minDebateRounds === 1 && balanced.convergenceThreshold === 0.75, "Balanced mode should keep the normal consultation pace.");
assert(explore.minDebateRounds === 2 && explore.convergenceThreshold === 1, "Explore mode should resist premature convergence.");
assert(verify.minDebateRounds === 2 && verify.convergenceThreshold === 0.9, "Verify mode should demand deeper evidence discussion.");
assert(stress.maxRounds === 4 && stress.minDebateRounds === 2, "Stress Test should allow the deepest public challenge cycle.");

const overridden = applyConsultationModePolicy("stress_test", {
  maxRounds: 3,
  minDebateRounds: 1,
  convergenceThreshold: 0.75,
});
assert(overridden.mode === "stress_test", "Browser mode capability must make the selected mode explicit in CouncilRunOptions.");
assert(overridden.maxRounds === 4, "Stress Test must override the old browser hard-coded maxRounds value.");
assert(overridden.minDebateRounds === 2, "Stress Test must override the old browser hard-coded minimum debate rounds.");
assert(overridden.convergenceThreshold === 0.9, "Stress Test must override the old browser hard-coded convergence threshold.");

const verifyPrompt = buildProviderConsultationPrompt(context("verify", "a"));
assert(verifyPrompt.includes("CONSULTATION_MODE: verify"), "Verify mode must be explicit in every participant prompt.");
assert(verifyPrompt.includes("MODE_GOAL"), "Mode goal must be visible machine-readable consultation context.");
assert(verifyPrompt.includes("source scope") && verifyPrompt.includes("dates"), "Verify mode should actually direct attention to evidence scope and dates.");
assert(verifyPrompt.includes("special authority"), "Mode must explicitly deny special authority to any participant.");
assert(verifyPrompt.includes("same working language as USER_PROPOSAL_JSON"), "Participants should use the user proposal working language for substantive meeting speech.");

const stressPrompt = buildProviderConsultationPrompt(context("stress_test", "a"));
assert(stressPrompt.includes("CONSULTATION_MODE: stress_test"), "Stress Test mode must be explicit in the prompt.");
assert(stressPrompt.includes("strongest counterexamples") || stressPrompt.includes("serious counterexamples"), "Stress Test should seek serious failure conditions.");
assert(stressPrompt.includes("fabricate disagreement or evidence") || stressPrompt.includes("not perform disagreement for entertainment"), "Stress Test must not incentivize theatrical disagreement.");

const aGoal = extractLine(buildProviderConsultationPrompt(context("explore", "a")), "MODE_GOAL:");
const bGoal = extractLine(buildProviderConsultationPrompt(context("explore", "b")), "MODE_GOAL:");
assert(aGoal === bGoal, "Equal participants in the same mode must receive exactly the same facilitation goal.");

const defaultPrompt = buildProviderConsultationPrompt(context(undefined, "a"));
assert(defaultPrompt.includes("CONSULTATION_MODE: balanced"), "Omitted mode must remain backward-compatible with Balanced.");
assert(!defaultPrompt.includes("CHATCHAT_EQUAL_RESEARCH_LANE"), "A prompt may only claim a Research Lane when the orchestrator actually supplies one.");

for (const mode of expected) {
  const definition = consultationModeDefinition(mode);
  assert(Boolean(definition.en.label && definition.zhCN.label), `${mode} must have English and Chinese product labels.`);
  assert(Boolean(definition.en.goal && definition.zhCN.goal), `${mode} must have English and Chinese descriptions.`);
}

const laneParticipants: CouncilParticipant[] = [
  participant("lane-a"),
  participant("lane-b"),
  participant("lane-c"),
  participant("lane-d"),
  participant("lane-e"),
];
const verifyLanes = consultationResearchLaneAssignments("verify", laneParticipants);
const verifyLaneOrder = laneParticipants.map((item) => verifyLanes[item.id]);
assert(
  verifyLaneOrder.join(",") === "primary_sources,strongest_counterexample,implementation_constraints,historical_base_rate,user_failure_modes",
  "Verify mode must deterministically spread five equal participants across five complementary research focuses.",
);
assert(new Set(verifyLaneOrder).size === 5, "Five Verify participants should cover five distinct research focuses before lanes repeat.");

const stressLanes = consultationResearchLaneAssignments("stress_test", laneParticipants);
assert(stressLanes["lane-a"] === "strongest_counterexample", "Stress Test must put strongest-counterexample investigation first without granting it extra authority.");
assert(stressLanes["lane-b"] === "user_failure_modes", "Stress Test should diversify the second seat toward real-user failure modes.");
const balancedLanes = consultationResearchLaneAssignments("balanced", laneParticipants);
assert(Object.keys(balancedLanes).length === laneParticipants.length, "Balanced mode must also diversify research instead of leaving every participant on the same general objective.");
assert(balancedLanes["lane-a"] === "primary_sources", "Balanced research should begin with primary-source verification.");
assert(balancedLanes["lane-b"] === "strongest_counterexample", "Balanced research should include a real counterexample mission.");

const verifyOptions = applyConsultationModePolicy("verify", {}, laneParticipants);
assert(
  Object.keys(verifyOptions.researchLaneAssignments ?? {}).length === 5,
  "The browser mode policy must carry generated Research Lane assignments into CouncilRunOptions.",
);
const balancedOptions = applyConsultationModePolicy("balanced", {}, laneParticipants);
assert(
  Object.keys(balancedOptions.researchLaneAssignments ?? {}).length === 5,
  "The default Balanced browser path must carry equal-authority Research Lanes into CouncilRunOptions.",
);
const customResearchAssignments: Record<string, CouncilResearchLane> = { "lane-a": "user_failure_modes" };
const customOptions = applyConsultationModePolicy("balanced", { researchLaneAssignments: customResearchAssignments }, laneParticipants);
assert(
  customOptions.researchLaneAssignments === customResearchAssignments,
  "Explicit caller-supplied research assignments must override generated defaults instead of being silently rewritten.",
);

const primaryPrompt = buildProviderConsultationPrompt(context("verify", "lane-a", "primary_sources"));
const counterPrompt = buildProviderConsultationPrompt(context("verify", "lane-b", "strongest_counterexample"));
assert(primaryPrompt.includes("CHATCHAT_EQUAL_RESEARCH_LANE"), "A specialized participant prompt must expose a machine-readable Research Lane block.");
assert(primaryPrompt.includes("RESEARCH_LANE: primary_sources"), "Primary-source lane id must be explicit in the provider prompt.");
assert(primaryPrompt.includes("Primary sources"), "The human-readable lane label must be visible to the participant.");
assert(primaryPrompt.includes("not your authority"), "Research focus must explicitly preserve equal authority.");
assert(primaryPrompt.includes("structured evidence contribution"), "Consequential lane findings must be published back to the shared Blackboard as evidence.");
assert(primaryPrompt.includes("Never fabricate a source"), "Research Lane prompt must forbid invented browsing/source claims.");
assert(primaryPrompt.includes("only if it is genuinely available"), "Research Lane prompt must not pretend every provider has browsing or search tools.");
assert(
  extractLine(primaryPrompt, "MODE_GOAL:") === extractLine(counterPrompt, "MODE_GOAL:"),
  "Different research focuses must not change the shared meeting objective.",
);
assert(
  extractLine(primaryPrompt, "RESEARCH_LANE:") !== extractLine(counterPrompt, "RESEARCH_LANE:"),
  "Research Lanes should create information-diversity goals without creating different authority.",
);

for (const lane of verifyLaneOrder as CouncilResearchLane[]) {
  const definition = researchLaneDefinition(lane);
  assert(Boolean(definition.en.label && definition.zhCN.label), `${lane} needs bilingual product labels.`);
  assert(Boolean(definition.en.goal && definition.zhCN.goal), `${lane} needs bilingual investigation goals.`);
}

const observedLanes = new Map<string, Set<CouncilResearchLane>>();
const lifecycleLanes: CouncilParticipantTurnUpdate[] = [];
const researchAgents: CouncilAgent[] = ["research-a", "research-b", "research-c"].map((id) => ({
  participant: participant(id),
  async respond(ctx) {
    if (ctx.researchLane) {
      const seen = observedLanes.get(id) ?? new Set<CouncilResearchLane>();
      seen.add(ctx.researchLane);
      observedLanes.set(id, seen);
    }
    if (ctx.phase === "sealed") return [{ kind: "argument", stance: "A", content: `${id} initial`, confidence: 0.8 }];
    if (ctx.phase === "debate") return [];
    return [{ kind: "final_position", stance: "A", content: `${id} final`, confidence: 0.85 }];
  },
}));
const explicitAssignments: Record<string, CouncilResearchLane> = {
  "research-a": "primary_sources",
  "research-b": "strongest_counterexample",
  "research-c": "implementation_constraints",
};
const researchRun = await new CouncilOrchestrator(researchAgents).run("research lanes remain equal", {
  mode: "verify",
  maxRounds: 2,
  minDebateRounds: 1,
  convergenceThreshold: 1,
  researchLaneAssignments: explicitAssignments,
  onParticipantTurn(update) { lifecycleLanes.push(update); },
});
for (const [participantId, lane] of Object.entries(explicitAssignments) as [string, CouncilResearchLane][]) {
  assert(observedLanes.get(participantId)?.has(lane), `${participantId} must receive its assigned lane in real CouncilContext.`);
  assert(
    lifecycleLanes.some((update) => update.participant.id === participantId && update.researchLane === lane && update.state === "working"),
    `${participantId} live lifecycle must expose its research focus while it is actually working.`,
  );
  assert(
    researchRun.report.researchLaneAssignments?.[participantId] === lane,
    `${participantId} lane assignment must survive into the local report/archive provenance.`,
  );
}

console.log("✓ ChatChat Proposal Mode goal/pacing tests passed");
console.log("✓ Equal-authority Research Lanes diversify every consultation mode without changing the shared meeting objective");
console.log("✓ Research Lane assignments propagate through Council context, live lifecycle and report provenance");

function context(
  mode: CouncilConsultationMode | undefined,
  participantId: string,
  researchLane?: CouncilResearchLane,
): CouncilContext {
  return {
    sessionId: "proposal-mode-test",
    question: "Which architecture is best?",
    ...(mode ? { mode } : {}),
    ...(researchLane ? { researchLane } : {}),
    phase: "debate",
    round: 2,
    participant: participant(participantId),
    publicEvents: [],
    ownEvents: [],
  };
}

function participant(id: string): CouncilParticipant {
  return { id, name: id, provider: id };
}

function extractLine(prompt: string, prefix: string): string {
  return prompt.split("\n").find((line) => line.startsWith(prefix)) ?? "";
}
