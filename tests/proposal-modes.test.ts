import type { CouncilContext, CouncilConsultationMode } from "../src/core/types.js";
import { consultationModeRunPolicy } from "../src/consultation/mode-policy.js";
import {
  CONSULTATION_MODES,
  consultationModeDefinition,
} from "../src/consultation/modes.js";
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

const verifyPrompt = buildProviderConsultationPrompt(context("verify", "a"));
assert(verifyPrompt.includes("CONSULTATION_MODE: verify"), "Verify mode must be explicit in every participant prompt.");
assert(verifyPrompt.includes("MODE_GOAL_JSON"), "Mode goal must be visible machine-readable consultation context.");
assert(verifyPrompt.includes("source scope") && verifyPrompt.includes("dates"), "Verify mode should actually direct attention to evidence scope and dates.");
assert(verifyPrompt.includes("not who has authority"), "Mode must never create a privileged participant.");

const stressPrompt = buildProviderConsultationPrompt(context("stress_test", "a"));
assert(stressPrompt.includes("CONSULTATION_MODE: stress_test"), "Stress Test mode must be explicit in the prompt.");
assert(stressPrompt.includes("strongest counterexamples"), "Stress Test should seek serious failure conditions.");
assert(stressPrompt.includes("Never treat the mode as permission to fabricate disagreement or evidence"), "Stress Test must not incentivize theatrical disagreement.");

const aGoal = extractLine(buildProviderConsultationPrompt(context("explore", "a")), "MODE_GOAL_JSON:");
const bGoal = extractLine(buildProviderConsultationPrompt(context("explore", "b")), "MODE_GOAL_JSON:");
assert(aGoal === bGoal, "Equal participants in the same mode must receive exactly the same facilitation goal.");

const defaultPrompt = buildProviderConsultationPrompt(context(undefined, "a"));
assert(defaultPrompt.includes("CONSULTATION_MODE: balanced"), "Omitted mode must remain backward-compatible with Balanced.");

for (const mode of expected) {
  const definition = consultationModeDefinition(mode);
  assert(Boolean(definition.en.label && definition.zhCN.label), `${mode} must have English and Chinese product labels.`);
  assert(Boolean(definition.en.goal && definition.zhCN.goal), `${mode} must have English and Chinese descriptions.`);
}

console.log("✓ ChatChat Proposal Mode goal/pacing tests passed");

function context(mode: CouncilConsultationMode | undefined, participantId: string): CouncilContext {
  return {
    sessionId: "proposal-mode-test",
    question: "Which architecture is best?",
    ...(mode ? { mode } : {}),
    phase: "debate",
    round: 2,
    participant: { id: participantId, name: participantId, provider: participantId },
    publicEvents: [],
    ownEvents: [],
  };
}

function extractLine(prompt: string, prefix: string): string {
  return prompt.split("\n").find((line) => line.startsWith(prefix)) ?? "";
}
