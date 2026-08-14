import { deriveOpenMeetingIssues } from "./consultation/open-issues.js";
import {
  consultationResearchLaneAssignments,
  researchLaneDefinition,
} from "./consultation/research-lanes.js";
import { CouncilOrchestrator } from "./core/orchestrator.js";
import { formatEvent, formatReport } from "./core/format.js";
import type { CouncilEvent, CouncilPhaseReason, CouncilPhaseUpdate } from "./core/types.js";
import { createMockCouncil } from "./providers/mock-council.js";

const proposal =
  "For ChatChat's next public UX, should the Full Room be the primary Web Room while the browser extension becomes an invisible zero-config bridge for logged-in AI sessions?";

const agents = createMockCouncil();
const participants = agents.map((agent) => agent.participant);
const names = new Map(participants.map((participant) => [participant.id, participant.name]));
const researchAssignments = consultationResearchLaneAssignments("balanced", participants);
const liveEvents: CouncilEvent[] = [];

console.log("🗳️  PROPOSAL SUBMITTED");
console.log(proposal);
console.log("\nNo chair. No privileged model. Every participant has equal authority.\n");

console.log("🔬 LIVE RESEARCH DESK");
for (const participant of participants) {
  const lane = researchAssignments[participant.id];
  if (!lane) continue;
  const definition = researchLaneDefinition(lane);
  console.log(`- ${participant.name}: ${definition.en.label}`);
}
console.log("Different research mission, equal authority.\n");

const orchestrator = new CouncilOrchestrator(agents);
const { report, blackboard } = await orchestrator.run(proposal, {
  mode: "balanced",
  maxRounds: 3,
  minDebateRounds: 1,
  convergenceThreshold: 0.75,
  researchLaneAssignments: researchAssignments,
  onPhase(update) {
    printAgenda(update, liveEvents, names);
    const open = deriveOpenMeetingIssues(participants, liveEvents);
    if (open.length) {
      console.log("\n📌 OPEN ISSUES BEFORE THIS PHASE");
      for (const issue of open.slice(0, 4)) {
        console.log(`- ${issueLabel(issue.kind)} · ${issue.actorName}${issue.targetActorName ? ` → ${issue.targetActorName}` : ""}`);
        console.log(`  ${issue.content}`);
        console.log(`  sourceEventId: ${issue.sourceEventId}`);
      }
    }
  },
  onParticipantTurn(update) {
    if (update.state !== "working") return;
    const lane = update.researchLane ? researchLaneDefinition(update.researchLane).en.label : "shared meeting record";
    console.log(`\n… ${update.participant.name} is working · ${update.phase} R${update.round} · ${lane}`);
  },
  onEvent(event) {
    liveEvents.push(event);
    console.log("\n" + formatEvent(event, names.get(event.actorId) ?? event.actorId));
  },
});

console.log("\n" + "=".repeat(84) + "\n");
console.log(formatReport(report));

const finalOpenIssues = deriveOpenMeetingIssues(participants, blackboard.events);
console.log("\n📌 OPEN ISSUES AT CLOSE");
if (!finalOpenIssues.length) {
  console.log("None — every tracked structured issue received an explicit resolution under the current rules.");
} else {
  for (const issue of finalOpenIssues) {
    console.log(`- ${issueLabel(issue.kind)} · ${issue.actorName}${issue.targetActorName ? ` → ${issue.targetActorName}` : ""}`);
    console.log(`  ${issue.content}`);
    console.log(`  sourceEventId: ${issue.sourceEventId}`);
  }
}

console.log("\nThe meeting may end while issues remain open. That is a product fact, not a formatting failure.");
console.log("Public structured actions are shown; private model chain-of-thought is not exposed or invented.");

function printAgenda(
  update: CouncilPhaseUpdate,
  events: readonly CouncilEvent[],
  participantNames: ReadonlyMap<string, string>,
): void {
  const phase = update.phase === "sealed"
    ? "SEALED INDEPENDENT ANALYSIS"
    : update.phase === "debate"
      ? "OPEN CONSULTATION"
      : "FINAL POSITIONS";
  console.log(`\n\n🧭 LIVE AGENDA · ${phase} · R${update.round}`);
  console.log(`Why this phase exists: ${agendaReason(update.reason)}`);
  if (typeof update.alignmentRatio === "number") {
    console.log(`Alignment: ${Math.round(update.alignmentRatio * 100)}% · descriptive only, never authority`);
  }
  if (update.triggerEventIds?.length) {
    console.log("Trigger events:");
    for (const eventId of update.triggerEventIds) {
      const event = events.find((item) => item.id === eventId);
      console.log(`- ${eventId}${event ? ` · ${participantNames.get(event.actorId) ?? event.actorId} · ${event.kind}` : ""}`);
    }
  }
}

function agendaReason(reason: CouncilPhaseReason | undefined): string {
  switch (reason) {
    case "sealed_start":
      return "independent first positions are being formed without peer answers";
    case "initial_debate":
      return "sealed positions are now visible in one shared public snapshot";
    case "fresh_signal_follow_up":
      return "the prior parallel batch introduced fresh questions/evidence/revisions that peers deserve a chance to answer";
    case "minimum_debate_rounds":
      return "the selected consultation mode requires more public debate";
    case "alignment_not_reached":
      return "descriptive stance alignment remains below the configured threshold";
    case "finalizing_stable_alignment":
      return "alignment is stable and the prior batch introduced no fresh peer-response signal";
    case "finalizing_round_budget":
      return "the hard round boundary was reached; remaining disagreement and Open Issues are preserved";
    default:
      return "protocol phase transition";
  }
}

function issueLabel(kind: ReturnType<typeof deriveOpenMeetingIssues>[number]["kind"]): string {
  if (kind === "open_question") return "OPEN QUESTION";
  if (kind === "challenged_claim") return "CHALLENGED CLAIM";
  if (kind === "evidence_awaiting_response") return "EVIDENCE AWAITING RESPONSE";
  return "EXPLICIT UNCERTAINTY";
}
