import type { CouncilEvent, CouncilReport } from "../src/core/types.js";
import {
  CONSULTATION_HISTORY_LIMIT,
  consultationArchiveChangedMindCount,
  createConsultationArchive,
  summarizeConsultationArchive,
} from "../src/consultation/history.js";
import { buildConsultationTheaterModel } from "../src/theater/consultation-theater.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const events: CouncilEvent[] = [
  {
    id: "a1",
    sessionId: "history-session",
    round: 1,
    actorId: "a",
    kind: "argument",
    stance: "Extension",
    content: "PRIVATE INITIAL A",
    confidence: 0.7,
    createdAt: "2026-08-13T01:00:00.000Z",
  },
  {
    id: "b1",
    sessionId: "history-session",
    round: 1,
    actorId: "b",
    kind: "argument",
    stance: "Web + Extension",
    content: "PRIVATE INITIAL B",
    confidence: 0.7,
    createdAt: "2026-08-13T01:00:01.000Z",
  },
  {
    id: "a2",
    sessionId: "history-session",
    round: 2,
    actorId: "a",
    kind: "challenge",
    targetEventId: "b1",
    content: "PRIVATE CHALLENGE",
    createdAt: "2026-08-13T01:00:02.000Z",
  },
  {
    id: "b2",
    sessionId: "history-session",
    round: 2,
    actorId: "b",
    kind: "revision",
    previousEventId: "b1",
    stance: "Extension",
    content: "PRIVATE REVISION",
    confidence: 0.82,
    causedBy: ["a2"],
    createdAt: "2026-08-13T01:00:03.000Z",
  },
  {
    id: "a3",
    sessionId: "history-session",
    round: 3,
    actorId: "a",
    kind: "final_position",
    stance: "Extension",
    content: "PRIVATE FINAL A",
    confidence: 0.84,
    caveats: [],
    createdAt: "2026-08-13T01:00:04.000Z",
  },
  {
    id: "b3",
    sessionId: "history-session",
    round: 3,
    actorId: "b",
    kind: "final_position",
    stance: "Extension",
    content: "PRIVATE FINAL B",
    confidence: 0.82,
    caveats: [],
    createdAt: "2026-08-13T01:00:05.000Z",
  },
];

const report: CouncilReport = {
  sessionId: "history-session",
  question: "PRIVATE USER PROPOSAL — should ChatChat prioritize the extension?",
  consensusStance: "Extension",
  consensusRatio: 1,
  confidence: 0.83,
  rounds: 3,
  eventCount: events.length,
  positions: [
    {
      participant: { id: "a", name: "ChatGPT", provider: "openai-chatgpt", role: "Independent AI Participant" },
      stance: "Extension",
      content: "PRIVATE POSITION A",
      confidence: 0.84,
      caveats: [],
    },
    {
      participant: { id: "b", name: "Claude", provider: "anthropic-claude", role: "Independent AI Participant" },
      stance: "Extension",
      content: "PRIVATE POSITION B",
      confidence: 0.82,
      caveats: [],
    },
  ],
  disagreements: [],
};

const archive = createConsultationArchive(report, events);
assert(archive.question === report.question, "The private local archive intentionally keeps the full user proposal.");
assert(archive.events[0]?.content === "PRIVATE INITIAL A", "The private local archive intentionally keeps full structured event text.");
assert(archive.participants.length === 2, "Archive should preserve the equal participant roster.");
assert(consultationArchiveChangedMindCount(archive) === 1, "History should expose explicit revisions as changed-mind metadata.");
assert(CONSULTATION_HISTORY_LIMIT === 24, "Browser consultation history should remain bounded to 24 records by default.");

const summary = summarizeConsultationArchive(archive);
assert(summary.changedMindCount === 1, "List summary should include the cheap changed-mind count.");
assert(summary.participantCount === 2, "List summary should include participant count.");
assert(summary.consensusStance === "Extension", "List summary should include the final shared stance when present.");
assert(summary.questionPreview.includes("PRIVATE USER PROPOSAL"), "The user's own local history list may include a short proposal preview.");

const summaryJson = JSON.stringify(summary);
for (const privateBody of [
  "PRIVATE INITIAL A",
  "PRIVATE INITIAL B",
  "PRIVATE CHALLENGE",
  "PRIVATE REVISION",
  "PRIVATE FINAL A",
  "PRIVATE FINAL B",
  "PRIVATE POSITION A",
  "PRIVATE POSITION B",
]) {
  assert(!summaryJson.includes(privateBody), `History list summary must not duplicate full event/position text: ${privateBody}`);
}

const replayModel = buildConsultationTheaterModel(
  archive.participants,
  archive.events,
  archive.report,
  "en",
);
assert(replayModel.replay.length === archive.events.length + 1, "A saved archive should feed the exact same local Theater replay model.");
assert(replayModel.changedMinds[0]?.participantName === "Claude", "Historical replay should preserve who changed their mind.");
assert(replayModel.changedMinds[0]?.fromStance === "Web + Extension", "Historical replay should preserve the old stance.");
assert(replayModel.changedMinds[0]?.toStance === "Extension", "Historical replay should preserve the new stance.");

console.log("✓ ChatChat local Consultation History tests passed");
