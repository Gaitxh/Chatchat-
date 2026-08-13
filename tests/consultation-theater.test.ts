import type { CouncilEvent, CouncilParticipant, CouncilReport } from "../src/core/types.js";
import {
  buildChangedMindTrails,
  buildConsultationReplay,
  buildConsultationTheaterModel,
  influenceKindLabel,
} from "../src/theater/consultation-theater.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "a", name: "ChatGPT", provider: "openai-chatgpt", role: "Independent AI Participant" },
  { id: "b", name: "Claude", provider: "anthropic-claude", role: "Independent AI Participant" },
  { id: "c", name: "Gemini", provider: "google-gemini", role: "Independent AI Participant" },
];

const events: CouncilEvent[] = [
  {
    id: "a-arg",
    sessionId: "session",
    round: 1,
    actorId: "a",
    kind: "argument",
    stance: "Extension",
    content: "A initial",
    confidence: 0.72,
    createdAt: "2026-08-13T00:00:00.000Z",
  },
  {
    id: "b-arg",
    sessionId: "session",
    round: 1,
    actorId: "b",
    kind: "argument",
    stance: "Web First",
    content: "B initial",
    confidence: 0.67,
    createdAt: "2026-08-13T00:00:01.000Z",
  },
  {
    id: "c-evidence",
    sessionId: "session",
    round: 2,
    actorId: "c",
    kind: "evidence",
    targetEventId: "b-arg",
    claim: "A browser extension can use the user's existing authenticated AI tabs directly.",
    source: "public test evidence",
    content: "Evidence against B assumption",
    confidence: 0.8,
    createdAt: "2026-08-13T00:00:02.000Z",
  },
  {
    id: "a-challenge",
    sessionId: "session",
    round: 2,
    actorId: "a",
    kind: "challenge",
    targetEventId: "b-arg",
    content: "Challenge B",
    createdAt: "2026-08-13T00:00:03.000Z",
  },
  {
    id: "b-revision",
    sessionId: "session",
    round: 2,
    actorId: "b",
    kind: "revision",
    previousEventId: "b-arg",
    stance: "Extension",
    content: "B changed mind",
    confidence: 0.82,
    causedBy: ["c-evidence", "a-challenge"],
    createdAt: "2026-08-13T00:00:04.000Z",
  },
  {
    id: "a-final",
    sessionId: "session",
    round: 3,
    actorId: "a",
    kind: "final_position",
    stance: "Extension",
    content: "A final",
    confidence: 0.84,
    caveats: [],
    createdAt: "2026-08-13T00:00:05.000Z",
  },
  {
    id: "b-final",
    sessionId: "session",
    round: 3,
    actorId: "b",
    kind: "final_position",
    stance: "Extension",
    content: "B final",
    confidence: 0.82,
    caveats: [],
    createdAt: "2026-08-13T00:00:06.000Z",
  },
  {
    id: "c-final",
    sessionId: "session",
    round: 3,
    actorId: "c",
    kind: "final_position",
    stance: "Extension",
    content: "C final",
    confidence: 0.86,
    caveats: [],
    createdAt: "2026-08-13T00:00:07.000Z",
  },
];

const report: CouncilReport = {
  sessionId: "session",
  question: "private proposal",
  consensusStance: "Extension",
  consensusRatio: 1,
  confidence: 0.84,
  rounds: 3,
  eventCount: events.length,
  positions: participants.map((participant, index) => ({
    participant,
    stance: "Extension",
    content: `final ${index}`,
    confidence: 0.82,
    caveats: [],
  })),
  disagreements: [],
};

const trails = buildChangedMindTrails(participants, events);
assert(trails.length === 1, "One explicit revision should create one changed-mind trail.");
assert(trails[0]?.participantId === "b", "Claude should be the participant that changed its mind.");
assert(trails[0]?.fromStance === "Web First" && trails[0]?.toStance === "Extension", "The stance transition must come from structured events.");
assert(trails[0]?.causedBy.length === 2, "Both explicit causedBy events must remain visible.");
assert(trails[0]?.causedBy.some((cause) => cause.participantId === "a" && cause.kind === "challenge"), "ChatGPT challenge provenance must survive.");
assert(trails[0]?.causedBy.some((cause) => cause.participantId === "c" && cause.kind === "evidence"), "Gemini evidence provenance must survive.");

const model = buildConsultationTheaterModel(participants, events, report, "en");
assert(model.summary.strongInfluenceLinks === 2, "Each causedBy relation should become a strong influence link.");
assert(model.summary.interactionLinks === 2, "Challenge and evidence targeting should remain interaction links, not successful persuasion by themselves.");
assert(model.summary.changedMindCount === 1, "Theater summary should count explicit changed minds.");
assert(model.graph.unresolvedReferences.length === 0, "All references in the fixture should resolve.");
assert(model.highlights.some((highlight) => highlight.kind === "most_open_minded" && highlight.participantName === "Claude"), "Event-derived open-minded highlight should identify Claude.");

const zh = buildConsultationTheaterModel(participants, events, report, "zh-CN");
assert(zh.highlights.some((highlight) => highlight.title === "最开放的参与者"), "Chinese Theater highlights should be first-class localized product copy.");
assert(influenceKindLabel("revision", "zh-CN") === "促成改口", "Strong influence labels should be localized.");
assert(influenceKindLabel("evidence", "en") === "Evidence", "English influence labels should be localized.");

const replay = buildConsultationReplay(participants, events);
assert(replay.length === events.length + 1, "Replay includes an initial empty frame plus every structured event.");
assert(replay[0]?.stage === "independent", "Replay begins at the independent stage.");
const revisionFrame = replay.find((frame) => frame.event?.id === "b-revision");
assert(revisionFrame?.stage === "consultation", "Revision occurs during open consultation.");
assert(revisionFrame?.changedMind?.participantName === "Claude", "Replay should surface a changed-mind moment at the exact revision frame.");
assert(revisionFrame?.influenceEdgeIds.length === 4, "At the revision frame the graph should include both interaction and strong influence edges.");
assert(replay.at(-1)?.stage === "complete", "The last final-position frame completes the replay.");

const brokenEvents: CouncilEvent[] = [
  ...events,
  {
    id: "broken-challenge",
    sessionId: "session",
    round: 2,
    actorId: "a",
    kind: "challenge",
    targetEventId: "missing-event",
    content: "broken",
    createdAt: "2026-08-13T00:00:08.000Z",
  },
];
const broken = buildConsultationTheaterModel(participants, brokenEvents, report, "en");
assert(broken.summary.unresolvedReferenceCount === 1, "Broken references should be counted and omitted safely rather than inventing an influence edge.");
assert(!broken.graph.edges.some((edge) => edge.sourceEventId === "broken-challenge"), "Missing target ids must never become invented graph edges.");

console.log("✓ ChatChat Consultation Theater provenance/replay tests passed");
