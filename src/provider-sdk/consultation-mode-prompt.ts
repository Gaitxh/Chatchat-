import type { CouncilContext } from "../core/types.js";
import { consultationModeDefinition } from "../consultation/modes.js";
import { directPeerInboxPromptBlock } from "../consultation/peer-inbox.js";
import { researchLaneDefinition } from "../consultation/research-lanes.js";
import { buildProviderConsultationPrompt } from "./consultation-protocol.js";

export function buildModeAwareProviderConsultationPrompt(context: CouncilContext): string {
  const mode = consultationModeDefinition(context.mode);
  const lane = context.researchLane ? researchLaneDefinition(context.researchLane) : null;
  const researchLaneBlock = lane
    ? [
        "",
        "CHATCHAT_EQUAL_RESEARCH_LANE",
        `RESEARCH_LANE: ${lane.id}`,
        `RESEARCH_LANE_LABEL: ${lane.en.label}`,
        `RESEARCH_LANE_GOAL_JSON: ${JSON.stringify(lane.en.goal)}`,
        "This lane changes what you should investigate, not your authority, speaking priority, vote weight, or required conclusion. Every participant remains an equal peer.",
        "Use any source-retrieval, browsing, search, memory, analysis, or tool capability only if it is genuinely available in your current environment. Never claim you searched, browsed, opened, verified, or observed a source when you did not.",
        "Do not keep consequential evidence private. If information from this lane could change the meeting, publish it as a structured evidence contribution with a source when one is actually available, or state uncertainty when it is not.",
        "Evidence becomes shared meeting material only after it is published to the Blackboard. Other participants must get a later shared snapshot before that evidence can legitimately be treated as having influenced them.",
        "Never fabricate a source, quotation, date, event id, tool result, or research action.",
        "END_CHATCHAT_EQUAL_RESEARCH_LANE",
      ]
    : [];
  const peerInboxBlock = directPeerInboxPromptBlock(context);

  return [
    "CHATCHAT_SHARED_MEETING_OBJECTIVE",
    `CONSULTATION_MODE: ${mode.id}`,
    `MODE_LABEL: ${mode.en.label}`,
    `MODE_GOAL: ${mode.en.goal}`,
    "The same meeting objective is given to every AI participant. It does not assign a side, hierarchy, preferred conclusion, or special authority to you or anyone else.",
    "Write substantive consultation contributions in the same working language as USER_PROPOSAL_JSON unless a source name, short source quotation, or indispensable technical term requires another language.",
    context.mode === "stress_test"
      ? "Stress Test means seek serious counterexamples and failure conditions, not perform disagreement for entertainment. Explicitly acknowledge positions that survive strong testing."
      : "Follow the meeting objective while remaining willing to agree, revise, concede, or remain uncertain when warranted.",
    "END_CHATCHAT_SHARED_MEETING_OBJECTIVE",
    ...researchLaneBlock,
    ...peerInboxBlock,
    "",
    buildProviderConsultationPrompt(context),
  ].join("\n");
}
