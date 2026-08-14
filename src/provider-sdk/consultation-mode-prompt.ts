import type { CouncilContext } from "../core/types.js";
import { consultationModeDefinition } from "../consultation/modes.js";
import { directPeerInboxPromptBlock } from "../consultation/peer-inbox.js";
import { explicitReplyPromptBlock } from "../consultation/reply-provenance.js";
import { researchLaneDefinition } from "../consultation/research-lanes.js";
import { providerVisibleConsultationContext } from "./context-selection.js";
import { buildProviderConsultationPrompt } from "./consultation-protocol.js";

export function buildModeAwareProviderConsultationPrompt(context: CouncilContext): string {
  const mode = consultationModeDefinition(context.mode);
  const lane = context.researchLane ? researchLaneDefinition(context.researchLane) : null;
  const visible = providerVisibleConsultationContext(context);
  const visibleContext = visible.context;
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
  const pinnedIssueBlock = visible.selection.pinnedIssueSourceEventIds.length
    ? [
        "",
        "CHATCHAT_PINNED_OPEN_ISSUES",
        `PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON: ${JSON.stringify(visible.selection.pinnedIssueSourceEventIds)}`,
        "These source events were brought back into the bounded public snapshot because their explicit protocol obligations remain unresolved. They are already present in CONSULTATION_EVENTS_JSON; this block adds attention, not new evidence.",
        "If a pinned source event explicitly targets you or one of your visible prior events, address it when reasonably possible before adding unrelated new points. Defend, answer, concede, revise, provide counter-evidence, or state uncertainty according to the merits.",
        "Pinned issue status gives no event extra authority, truth status, vote weight, speaking priority, or right to force agreement. Never manufacture a response relationship unless the exact event id is visible in CONSULTATION_EVENTS_JSON.",
        "END_CHATCHAT_PINNED_OPEN_ISSUES",
      ]
    : [];
  const peerInboxBlock = directPeerInboxPromptBlock(visibleContext);
  const explicitReplyBlock = explicitReplyPromptBlock(visibleContext);

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
    ...pinnedIssueBlock,
    ...peerInboxBlock,
    ...explicitReplyBlock,
    "",
    // Pass the original full context here so the base prompt can expose which
    // events were conflict-pinned; it deterministically recomputes the same
    // visible snapshot used by inbox and explicit-reply blocks above.
    buildProviderConsultationPrompt(context),
  ].join("\n");
}
