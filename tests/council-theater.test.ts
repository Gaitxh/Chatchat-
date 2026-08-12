import { CouncilOrchestrator } from "../src/core/orchestrator.js";
import type { CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import { createMockCouncil } from "../src/providers/mock-council.js";
import {
  buildCouncilInfluenceGraph,
  deriveCouncilAwards,
} from "../src/theater/influence.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const agents = createMockCouncil();
const result = await new CouncilOrchestrator(agents).run(
  "Which shell should ChatChat use?",
  {
    maxRounds: 3,
    minDebateRounds: 1,
    convergenceThreshold: 0.75,
  },
);
const participants = agents.map((agent) => agent.participant);
const graph = buildCouncilInfluenceGraph(
  participants,
  result.blackboard.events,
);

assert(graph.unresolvedReferences.length === 0, "The deterministic demo should produce a fully traceable influence graph.");

const changedMind = graph.edges.find(
  (edge) =>
    edge.kind === "revision" &&
    edge.sourceActorId === "mock-gpt" &&
    edge.targetActorId === "mock-claude",
);
assert(changedMind, "GPT's challenge should be traceably linked to Claude's revision.");
assert(changedMind.strength === "strong", "A revision.causedBy relationship is a strong influence edge.");
assert(changedMind.causedByEventId, "Changed-mind edges must retain the causal Blackboard event id.");
assert(changedMind.sourceEventId, "Changed-mind edges must retain the revision event id.");
assert(changedMind.stanceTransition?.from === "Electron", "The graph should recover Claude's previous stance.");
assert(changedMind.stanceTransition?.to === "Tauri", "The graph should recover Claude's new stance.");

const challengeEdges = graph.edges.filter((edge) => edge.kind === "challenge");
assert(challengeEdges.length >= 3, "Challenge interactions should be represented as traceable attempted-influence edges.");
assert(challengeEdges.every((edge) => edge.strength === "interaction"), "Challenges alone must never be upgraded into successful persuasion.");

const gptNode = graph.nodes.find((node) => node.participant.id === "mock-gpt");
const claudeNode = graph.nodes.find((node) => node.participant.id === "mock-claude");
assert(gptNode?.outgoingStrong === 1, "GPT should have one explicit strong outgoing influence in the scripted demo.");
assert(claudeNode?.revisions === 1, "Claude should have one explicit revision in the scripted demo.");

const awards = deriveCouncilAwards(
  graph,
  result.blackboard.events,
  result.report,
);
assert(
  awards.some(
    (award) =>
      award.kind === "most_influential" &&
      award.participantId === "mock-gpt",
  ),
  "The Most Influential title should come from the strong influence edge, not model self-report.",
);
assert(
  awards.some(
    (award) =>
      award.kind === "most_open_minded" &&
      award.participantId === "mock-claude",
  ),
  "The Most Open-Minded title should come from Claude's explicit revision event.",
);
assert(
  awards.some((award) => award.kind === "evidence_keeper"),
  "The scripted evidence event should support an Evidence Keeper title.",
);
assert(
  awards.every((award) => award.provenanceEventIds.every((id) => result.blackboard.find(id))),
  "Every fun award must link back to real Blackboard events.",
);

const tinyParticipants: CouncilParticipant[] = [
  { id: "a", name: "A", provider: "test" },
  { id: "b", name: "B", provider: "test" },
];
const brokenEvents: CouncilEvent[] = [
  {
    id: "challenge-broken",
    sessionId: "session-broken",
    round: 2,
    actorId: "a",
    kind: "challenge",
    targetEventId: "missing-target",
    content: "This target does not exist.",
    createdAt: "2026-08-13T00:00:00.000Z",
  },
  {
    id: "self-argument",
    sessionId: "session-broken",
    round: 1,
    actorId: "a",
    kind: "argument",
    stance: "X",
    content: "X",
    confidence: 0.5,
    createdAt: "2026-08-13T00:00:00.000Z",
  },
  {
    id: "self-defense",
    sessionId: "session-broken",
    round: 2,
    actorId: "a",
    kind: "defense",
    targetEventId: "self-argument",
    content: "Self defense should not create an A → A influence edge.",
    createdAt: "2026-08-13T00:00:01.000Z",
  },
];
const brokenGraph = buildCouncilInfluenceGraph(
  tinyParticipants,
  brokenEvents,
);
assert(
  brokenGraph.unresolvedReferences.includes("missing-target"),
  "Broken event references should be surfaced rather than silently inventing an edge.",
);
assert(
  brokenGraph.edges.every(
    (edge) => edge.sourceActorId !== edge.targetActorId,
  ),
  "Self interactions should not pollute the inter-advisor persuasion graph.",
);

console.log("✓ ChatChat Council Theater influence tests passed");
