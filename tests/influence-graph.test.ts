import {
  buildInfluenceGraph,
  influenceEdgeLabel,
} from "../src/analysis/influence-graph.js";
import type {
  CouncilEvent,
  CouncilParticipant,
} from "../src/core/types.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "a", name: "Alpha", provider: "mock" },
  { id: "b", name: "Beta", provider: "mock" },
  { id: "c", name: "Gamma", provider: "mock" },
];

const events: CouncilEvent[] = [
  {
    id: "a-arg",
    sessionId: "s",
    round: 1,
    actorId: "a",
    kind: "argument",
    stance: "Tauri",
    content: "A",
    confidence: 0.7,
    createdAt: "2026-08-13T00:00:00.000Z",
  },
  {
    id: "b-arg",
    sessionId: "s",
    round: 1,
    actorId: "b",
    kind: "argument",
    stance: "Electron",
    content: "B",
    confidence: 0.7,
    createdAt: "2026-08-13T00:00:01.000Z",
  },
  {
    id: "a-challenge",
    sessionId: "s",
    round: 2,
    actorId: "a",
    kind: "challenge",
    targetEventId: "b-arg",
    content: "challenge",
    createdAt: "2026-08-13T00:00:02.000Z",
  },
  {
    id: "c-evidence",
    sessionId: "s",
    round: 2,
    actorId: "c",
    kind: "evidence",
    targetEventId: "b-arg",
    claim: "evidence claim",
    content: "evidence body",
    confidence: 0.9,
    createdAt: "2026-08-13T00:00:03.000Z",
  },
  {
    id: "b-revision",
    sessionId: "s",
    round: 2,
    actorId: "b",
    kind: "revision",
    previousEventId: "b-arg",
    stance: "Tauri",
    content: "changed",
    confidence: 0.8,
    causedBy: ["a-challenge", "c-evidence"],
    createdAt: "2026-08-13T00:00:04.000Z",
  },
  {
    id: "b-concede",
    sessionId: "s",
    round: 2,
    actorId: "b",
    kind: "concede",
    targetEventId: "c-evidence",
    content: "concede",
    createdAt: "2026-08-13T00:00:05.000Z",
  },
  {
    id: "a-support",
    sessionId: "s",
    round: 2,
    actorId: "a",
    kind: "support",
    targetEventId: "c-evidence",
    content: "support",
    createdAt: "2026-08-13T00:00:06.000Z",
  },
  {
    id: "a-self-defense",
    sessionId: "s",
    round: 2,
    actorId: "a",
    kind: "defense",
    targetEventId: "a-arg",
    content: "self defense",
    createdAt: "2026-08-13T00:00:07.000Z",
  },
  {
    id: "c-broken-evidence",
    sessionId: "s",
    round: 2,
    actorId: "c",
    kind: "evidence",
    targetEventId: "missing-event",
    claim: "broken",
    content: "broken",
    confidence: 0.4,
    createdAt: "2026-08-13T00:00:08.000Z",
  },
];

const graph = buildInfluenceGraph(events, participants);

const challenge = graph.edges.find(
  (edge) => edge.kind === "challenge" && edge.fromActorId === "a" && edge.toActorId === "b",
);
assert(challenge?.strength === "interaction", "Challenge must be an attempted interaction, not proof of persuasion.");
assert(challenge.triggerEventIds.includes("a-challenge"), "Challenge edge must preserve the exact Blackboard event id.");

const evidence = graph.edges.find(
  (edge) => edge.kind === "evidence" && edge.fromActorId === "c" && edge.toActorId === "b",
);
assert(evidence?.strength === "interaction", "Evidence submission alone must not be treated as successful persuasion.");

const fromAlpha = graph.edges.find(
  (edge) => edge.kind === "changed_mind" && edge.fromActorId === "a" && edge.toActorId === "b",
);
assert(fromAlpha?.strength === "strong", "revision.causedBy must create a strong changed-mind edge.");
assert(fromAlpha?.transitions[0]?.fromStance === "Electron", "Changed-mind edge should preserve the prior stance.");
assert(fromAlpha?.transitions[0]?.toStance === "Tauri", "Changed-mind edge should preserve the revised stance.");
assert(fromAlpha?.provenanceEventIds.includes("b-revision"), "Strong influence must point back to the revision event.");
assert(fromAlpha?.provenanceEventIds.includes("a-challenge"), "Strong influence must point back to the causal event.");

const fromGamma = graph.edges.find(
  (edge) => edge.kind === "changed_mind" && edge.fromActorId === "c" && edge.toActorId === "b",
);
assert(fromGamma?.strength === "strong", "Evidence explicitly cited by revision.causedBy should become strong influence.");

const concede = graph.edges.find(
  (edge) => edge.kind === "conceded" && edge.fromActorId === "c" && edge.toActorId === "b",
);
assert(concede?.strength === "strong", "Concede must create a strong target-author → conceding-author edge.");
assert(influenceEdgeLabel(concede!) === "conceded", "Strong concede edge should have a stable UI label.");

const support = graph.edges.find(
  (edge) => edge.kind === "support" && edge.fromActorId === "a" && edge.toActorId === "c",
);
assert(Boolean(support), "Support interaction should connect supporter to target actor.");

assert(
  !graph.edges.some((edge) => edge.fromActorId === edge.toActorId),
  "Self-targeted defenses or self-caused revisions should not clutter the influence graph.",
);
assert(
  graph.brokenReferences.includes("missing-event"),
  "Broken archive references should be reported without crashing graph construction.",
);

const beta = graph.nodes.find((node) => node.participant.id === "b");
assert(beta?.revisions === 1 && beta.concessions === 1, "Open-mindedness inputs should be counted from explicit events only.");
assert(beta?.incomingChallenges === 1, "Incoming challenge count should be deterministic.");

assert(graph.awards.mostInfluential?.actorId === "c", "Gamma should win Most Influential from two explicit strong influence events.");
assert(graph.awards.mostOpenMinded?.actorId === "b", "Beta should win Most Open-Minded from revision + concede.");
assert(graph.awards.mostChallenged?.actorId === "b", "Beta should win Most Challenged from the incoming challenge.");
assert(graph.awards.evidenceBroker?.actorId === "c", "Gamma should win Evidence Broker from the targeted evidence event.");

console.log("✓ ChatChat influence-graph tests passed");
