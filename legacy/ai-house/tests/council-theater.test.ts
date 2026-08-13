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
  { id: "c", name: "C", provider: "test" },
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

const traceEvents: CouncilEvent[] = [
  {
    id: "a-argument",
    sessionId: "session-trace",
    round: 1,
    actorId: "a",
    kind: "argument",
    stance: "Alpha",
    content: "Alpha",
    confidence: 0.6,
    createdAt: "2026-08-13T00:01:00.000Z",
  },
  {
    id: "b-argument",
    sessionId: "session-trace",
    round: 1,
    actorId: "b",
    kind: "argument",
    stance: "Beta",
    content: "Beta",
    confidence: 0.6,
    createdAt: "2026-08-13T00:01:01.000Z",
  },
  {
    id: "c-evidence",
    sessionId: "session-trace",
    round: 2,
    actorId: "c",
    kind: "evidence",
    targetEventId: "a-argument",
    claim: "Evidence against Alpha",
    content: "Evidence is an interaction until somebody explicitly revises or concedes.",
    confidence: 0.8,
    createdAt: "2026-08-13T00:01:02.000Z",
  },
  {
    id: "b-challenge",
    sessionId: "session-trace",
    round: 2,
    actorId: "b",
    kind: "challenge",
    targetEventId: "a-argument",
    content: "Challenge Alpha",
    createdAt: "2026-08-13T00:01:03.000Z",
  },
  {
    id: "b-concede",
    sessionId: "session-trace",
    round: 2,
    actorId: "b",
    kind: "concede",
    targetEventId: "a-argument",
    content: "I concede this point to A.",
    createdAt: "2026-08-13T00:01:04.000Z",
  },
];
const traceGraph = buildCouncilInfluenceGraph(tinyParticipants, traceEvents);
const evidenceEdge = traceGraph.edges.find((edge) => edge.sourceEventId === "c-evidence");
assert(evidenceEdge, "Targeted evidence should create a traceable interaction edge.");
assert(evidenceEdge.kind === "evidence" && evidenceEdge.strength === "interaction", "Evidence alone must remain attempted influence, not successful persuasion.");
assert(evidenceEdge.sourceActorId === "c" && evidenceEdge.targetActorId === "a", "Evidence direction should run from submitter to the actor whose event was targeted.");
assert(evidenceEdge.targetEventId === "a-argument", "Evidence edges must retain the exact targeted Blackboard event.");

const concedeEdge = traceGraph.edges.find((edge) => edge.sourceEventId === "b-concede");
assert(concedeEdge, "An explicit concede event should create a strong influence edge.");
assert(concedeEdge.kind === "concede" && concedeEdge.strength === "strong", "Concede is explicit successful influence.");
assert(concedeEdge.sourceActorId === "a" && concedeEdge.targetActorId === "b", "Concede direction should run from the conceded-to actor to the conceding actor.");
assert(concedeEdge.causedByEventId === "a-argument", "Concede provenance must preserve the exact accepted event id.");

const aggregatedEvidence = traceGraph.aggregatedEdges.find(
  (edge) => edge.sourceActorId === "c" && edge.targetActorId === "a" && edge.strength === "interaction",
);
assert(aggregatedEvidence?.kinds.evidence === 1, "Aggregated graph edges must preserve per-kind counts.");
assert(aggregatedEvidence.eventIds.includes("c-evidence"), "Aggregated graph edges must retain source event provenance.");

const tieEvents: CouncilEvent[] = [
  {
    id: "tie-a-argument",
    sessionId: "session-tie",
    round: 1,
    actorId: "a",
    kind: "argument",
    stance: "A",
    content: "A",
    confidence: 0.5,
    createdAt: "2026-08-13T00:02:00.000Z",
  },
  {
    id: "tie-b-argument",
    sessionId: "session-tie",
    round: 1,
    actorId: "b",
    kind: "argument",
    stance: "B",
    content: "B",
    confidence: 0.5,
    createdAt: "2026-08-13T00:02:01.000Z",
  },
  {
    id: "tie-a-evidence",
    sessionId: "session-tie",
    round: 2,
    actorId: "a",
    kind: "evidence",
    targetEventId: "tie-b-argument",
    claim: "A evidence",
    content: "A evidence",
    confidence: 0.6,
    createdAt: "2026-08-13T00:02:02.000Z",
  },
  {
    id: "tie-b-evidence",
    sessionId: "session-tie",
    round: 2,
    actorId: "b",
    kind: "evidence",
    targetEventId: "tie-a-argument",
    claim: "B evidence",
    content: "B evidence",
    confidence: 0.6,
    createdAt: "2026-08-13T00:02:03.000Z",
  },
];
const tieGraph = buildCouncilInfluenceGraph(tinyParticipants.slice(0, 2), tieEvents);
const tieAwards = deriveCouncilAwards(tieGraph, tieEvents, null);
assert(
  !tieAwards.some((award) => award.kind === "evidence_keeper"),
  "A tied evidence count must not invent a single Evidence Keeper winner.",
);
assert(
  !tieAwards.some((award) => award.kind === "most_influential"),
  "Interaction-only evidence must not create a Most Influential winner.",
);

console.log("✓ ChatChat Council Theater influence tests passed");
