import { consultationResearchLaneAssignments } from "../src/consultation/research-lanes.js";
import type {
  CouncilConsultationMode,
  CouncilEvent,
  CouncilParticipant,
  CouncilParticipantTurnUpdate,
  CouncilResearchLane,
} from "../src/core/types.js";
import { buildResearchActivity } from "../src/theater/research-activity.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "gpt", name: "ChatGPT", provider: "openai" },
  { id: "claude", name: "Claude", provider: "anthropic" },
  { id: "gemini", name: "Gemini", provider: "google" },
  { id: "deepseek", name: "DeepSeek", provider: "deepseek" },
  { id: "qwen", name: "Qwen", provider: "qwen" },
  { id: "sixth", name: "Sixth AI", provider: "other" },
];

const expectedFirstLane: Readonly<Record<CouncilConsultationMode, CouncilResearchLane>> = {
  balanced: "primary_sources",
  verify: "primary_sources",
  stress_test: "strongest_counterexample",
  decide: "implementation_constraints",
  explore: "historical_base_rate",
};

for (const mode of Object.keys(expectedFirstLane) as CouncilConsultationMode[]) {
  const assignments = consultationResearchLaneAssignments(mode, participants);
  assert(Object.keys(assignments).length === participants.length, `${mode} should assign every participant a research mission.`);
  assert(assignments.gpt === expectedFirstLane[mode], `${mode} should use its deterministic research priority.`);
  const firstFive = participants.slice(0, 5).map((participant) => assignments[participant.id]);
  assert(new Set(firstFive).size === 5, `${mode} should diversify the first five research missions.`);
  assert(assignments.sixth === assignments.gpt, `${mode} should rotate deterministically when participants outnumber lane types.`);
}

const balanced = consultationResearchLaneAssignments("balanced", participants.slice(0, 3));
assert(balanced.gpt === "primary_sources", "Balanced should begin with primary-source verification.");
assert(balanced.claude === "strongest_counterexample", "Balanced should assign a real counterexample mission.");
assert(balanced.gemini === "implementation_constraints", "Balanced should assign an implementation mission.");

const events: CouncilEvent[] = [
  {
    id: "gpt-view", sessionId: "research-session", round: 1, actorId: "gpt", kind: "argument",
    stance: "web-first", content: "A web-first room reduces visible setup.", confidence: .7,
    createdAt: "2026-08-14T00:00:01Z",
  },
  {
    id: "gpt-evidence", sessionId: "research-session", round: 2, actorId: "gpt", kind: "evidence",
    targetEventId: "gpt-view", claim: "The official browser platform documents the relevant capability.",
    content: "Primary-source evidence for the browser boundary.", source: "https://developer.chrome.com/docs/extensions/",
    confidence: .86, createdAt: "2026-08-14T00:00:02Z",
  },
  {
    id: "claude-challenge", sessionId: "research-session", round: 2, actorId: "claude", kind: "challenge",
    targetEventId: "gpt-view", content: "What happens when the extension is unavailable?",
    createdAt: "2026-08-14T00:00:03Z",
  },
  {
    id: "claude-revision", sessionId: "research-session", round: 3, actorId: "claude", kind: "revision",
    previousEventId: "claude-challenge", stance: "web-first-with-fallback",
    content: "The fallback resolves my main concern.", confidence: .79,
    causedBy: ["gpt-evidence"], createdAt: "2026-08-14T00:00:04Z",
  },
];

const activities: Record<string, CouncilParticipantTurnUpdate> = {
  gpt: {
    phase: "debate", round: 2, participant: participants[0]!, state: "completed",
    researchLane: "primary_sources", contributionKinds: ["evidence"],
  },
  claude: {
    phase: "debate", round: 3, participant: participants[1]!, state: "working",
    researchLane: "strongest_counterexample",
  },
};

const model = buildResearchActivity(participants.slice(0, 3), events, activities);
assert(model.rows.length === 2, "Only participants with an explicit current research lifecycle update should appear.");
assert(model.activeCount === 1, "Working lifecycle state should drive the active research count.");
assert(model.publishedEvidenceCount === 1, "Published evidence count must come from structured evidence events.");

const gpt = model.rows.find((row) => row.participantId === "gpt");
assert(gpt?.evidenceCount === 1, "Evidence output should be counted from public structured events.");
assert(gpt?.latestEvidence?.eventId === "gpt-evidence", "Latest evidence must keep traceable event provenance.");
assert(gpt?.latestEvidence?.sourceHost === "developer.chrome.com", "Research desk should show only the parsed public source host.");
assert(gpt?.contributionKinds[0] === "evidence", "Lifecycle contribution kinds should be preserved exactly.");

const claude = model.rows.find((row) => row.participantId === "claude");
assert(claude?.challengeCount === 1, "Public challenges should be visible as research output.");
assert(claude?.revisionCount === 1, "Public revisions should be visible as research output.");
assert(claude?.state === "working", "Research desk state must come from the explicit lifecycle update.");

const proseOnly: CouncilEvent[] = [{
  id: "fake-research", sessionId: "research-session-2", round: 1, actorId: "gpt", kind: "argument",
  stance: "maybe", content: "I searched the web and found five studies.", confidence: .5,
  createdAt: "2026-08-14T00:01:00Z",
}];
const proseModel = buildResearchActivity(participants.slice(0, 1), proseOnly, {
  gpt: {
    phase: "sealed", round: 1, participant: participants[0]!, state: "completed",
    researchLane: "primary_sources", contributionKinds: ["argument"],
  },
});
assert(proseModel.publishedEvidenceCount === 0, "Claims of browsing in prose must never fabricate evidence activity.");
assert(!proseModel.rows[0]?.latestEvidence, "Ordinary prose must never fabricate a source or evidence card.");

console.log("✓ ChatChat universal research missions and live public research activity tests passed");
