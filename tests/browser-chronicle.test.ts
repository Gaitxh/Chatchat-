import type { CouncilEvent, CouncilReport } from "../src/core/types.js";
import {
  createBrowserChronicleArchive,
  isBrowserChronicleArchive,
  summarizeBrowserChronicle,
} from "../src/extension/chronicle-store.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const events: CouncilEvent[] = [
  {
    id: "event-a",
    sessionId: "chronicle-session-1",
    round: 1,
    actorId: "gpt-01",
    kind: "argument",
    stance: "Electron",
    content: "PRIVATE MODEL BODY A",
    confidence: 0.72,
    createdAt: "2026-08-13T01:00:00.000Z",
  },
  {
    id: "event-b",
    sessionId: "chronicle-session-1",
    round: 2,
    actorId: "qwen-01",
    kind: "challenge",
    targetEventId: "event-a",
    content: "PRIVATE CHALLENGE BODY",
    createdAt: "2026-08-13T01:00:01.000Z",
  },
  {
    id: "event-c",
    sessionId: "chronicle-session-1",
    round: 2,
    actorId: "gpt-01",
    kind: "revision",
    previousEventId: "event-a",
    stance: "Tauri",
    content: "PRIVATE REVISION BODY",
    confidence: 0.81,
    causedBy: ["event-b"],
    createdAt: "2026-08-13T01:00:02.000Z",
  },
  {
    id: "event-d",
    sessionId: "chronicle-session-1",
    round: 3,
    actorId: "gpt-01",
    kind: "final_position",
    stance: "Tauri",
    content: "PRIVATE FINAL BODY A",
    confidence: 0.83,
    caveats: [],
    createdAt: "2026-08-13T01:00:03.000Z",
  },
  {
    id: "event-e",
    sessionId: "chronicle-session-1",
    round: 3,
    actorId: "qwen-01",
    kind: "final_position",
    stance: "Electron",
    content: "PRIVATE FINAL BODY B",
    confidence: 0.75,
    caveats: ["PRIVATE CAVEAT"],
    createdAt: "2026-08-13T01:00:04.000Z",
  },
];

const report: CouncilReport = {
  sessionId: "chronicle-session-1",
  question: "PRIVATE KING QUESTION — should we choose Tauri or Electron for our local-first browser companion?",
  consensusStance: "Tauri",
  consensusRatio: 0.5,
  confidence: 0.79,
  rounds: 3,
  positions: [
    {
      participant: {
        id: "gpt-01",
        name: "ChatGPT · 01",
        provider: "openai-chatgpt",
        delegationId: "openai-chatgpt",
        seatIndex: 1,
        seatCount: 1,
      },
      stance: "Tauri",
      content: "PRIVATE POSITION A",
      confidence: 0.83,
      caveats: [],
    },
    {
      participant: {
        id: "qwen-01",
        name: "Qwen · 01",
        provider: "alibaba-qwen",
        delegationId: "alibaba-qwen",
        seatIndex: 1,
        seatCount: 1,
      },
      stance: "Electron",
      content: "PRIVATE POSITION B",
      confidence: 0.75,
      caveats: ["PRIVATE MINORITY CAVEAT"],
    },
  ],
  disagreements: [
    {
      participant: {
        id: "qwen-01",
        name: "Qwen · 01",
        provider: "alibaba-qwen",
      },
      stance: "Electron",
      content: "PRIVATE POSITION B",
      confidence: 0.75,
      caveats: ["PRIVATE MINORITY CAVEAT"],
    },
  ],
  eventCount: events.length,
};

const archive = createBrowserChronicleArchive(report, events);
assert(isBrowserChronicleArchive(archive), "A freshly created local Chronicle archive must pass its structural validator.");
assert(archive.question === report.question, "Private Chronicle is intentionally allowed to retain the full King's question locally.");
assert(archive.events[0]?.content === "PRIVATE MODEL BODY A", "Private Chronicle is intentionally allowed to retain full Blackboard content locally.");
assert(archive.participants.length === 2, "Chronicle should de-duplicate participants by actor id.");
assert(archive.createdAt === events[0]?.createdAt, "Chronicle creation time should use the first Council event when available.");

const summary = summarizeBrowserChronicle(archive);
assert(summary.sessionId === archive.sessionId, "Summary must preserve the local archive key.");
assert(summary.rounds === 3 && summary.eventCount === 5, "Summary should expose cheap list metadata without loading the full transcript later.");
assert(summary.changedMindCount === 1, "Revision count should be derivable for the local list.");
assert(summary.minorityOpinionPresent, "Minority flag must reflect the archived report.");
assert(summary.consensusRatio === 0.5, "Consensus ratio should be preserved within [0,1].");

const serializedSummary = JSON.stringify(summary);
for (const privateBody of [
  "PRIVATE MODEL BODY A",
  "PRIVATE CHALLENGE BODY",
  "PRIVATE REVISION BODY",
  "PRIVATE FINAL BODY A",
  "PRIVATE FINAL BODY B",
  "PRIVATE POSITION A",
  "PRIVATE POSITION B",
  "PRIVATE MINORITY CAVEAT",
]) {
  assert(!serializedSummary.includes(privateBody), `Chronicle list summary must not copy full transcript body: ${privateBody}`);
}
assert(serializedSummary.includes("PRIVATE KING QUESTION"), "A private local Chronicle summary may include a short question preview for the user's own list.");

assert(!isBrowserChronicleArchive(null), "Null is not an archive.");
assert(!isBrowserChronicleArchive({ schemaVersion: 1 }), "Incomplete objects must be rejected.");
assert(
  !isBrowserChronicleArchive({ ...archive, sessionId: "mismatch" }),
  "Archive validator must reject a session id that disagrees with the report.",
);
assert(
  !isBrowserChronicleArchive({ ...archive, events: [{ bad: true }] }),
  "Corrupt event arrays must fail locally instead of reaching Theater.",
);

console.log("✓ ChatChat Browser Court Chronicle tests passed");
