import type { CouncilContext } from "../core/types.js";
import { consultationModeDefinition } from "../consultation/modes.js";
import { buildProviderConsultationPrompt } from "./consultation-protocol.js";

export function buildModeAwareProviderConsultationPrompt(context: CouncilContext): string {
  const mode = consultationModeDefinition(context.mode);
  return [
    "CHATCHAT_SHARED_MEETING_OBJECTIVE",
    `CONSULTATION_MODE: ${mode.id}`,
    `MODE_LABEL: ${mode.en.label}`,
    `MODE_GOAL: ${mode.en.goal}`,
    "The same meeting objective is given to every AI participant. It does not assign a side, hierarchy, preferred conclusion, or special authority to you or anyone else.",
    context.mode === "stress_test"
      ? "Stress Test means seek serious counterexamples and failure conditions, not perform disagreement for entertainment. Explicitly acknowledge positions that survive strong testing."
      : "Follow the meeting objective while remaining willing to agree, revise, concede, or remain uncertain when warranted.",
    "END_CHATCHAT_SHARED_MEETING_OBJECTIVE",
    "",
    buildProviderConsultationPrompt(context),
  ].join("\n");
}
