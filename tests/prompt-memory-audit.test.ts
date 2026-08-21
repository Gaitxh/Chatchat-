import {
  parseProviderPromptMemorySelection,
  providerPromptMemorySelectionFor,
  rememberProviderPromptMemorySelection,
} from "../src/provider-sdk/prompt-memory-audit.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const publicEvents = [
  { id: "a1", actorId: "gpt", round: 1, kind: "argument", stance: "A", confidence: .7, content: "Initial." },
  { id: "q1", actorId: "gpt", round: 1, kind: "question", targetActorId: "claude", content: "Question?" },
  { id: "r2-1", actorId: "gemini", round: 2, kind: "evidence", claim: "Evidence", content: "Detail", confidence: .8 },
];
const prompt = [
  "SESSION_ID: memory-session",
  "PHASE: debate",
  "ROUND: 3",
  "YOUR_ACTOR_ID: claude",
  'PUBLIC_SNAPSHOT_EVENT_IDS_JSON: ["a1","q1","r2-1"]',
  'PINNED_OPEN_ISSUE_EVENT_IDS_JSON: ["q1"]',
  'LATEST_ROUND_EVENT_IDS_JSON: ["r2-1"]',
  `CONSULTATION_EVENTS_JSON: ${JSON.stringify(publicEvents)}`,
  "CHATCHAT_PINNED_OPEN_ISSUES",
  'PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON: ["q1"]',
].join("\n");

const parsed = parseProviderPromptMemorySelection(prompt);
assert(parsed?.sessionId === "memory-session" && parsed.actorId === "claude", "Prompt audit must preserve session and actor identity.");
assert(parsed?.round === 3 && parsed.phase === "debate", "Prompt audit must preserve phase and round.");
assert(parsed?.snapshotEventIds.join(",") === "a1,q1,r2-1", "Prompt audit must preserve exact public snapshot order.");
assert(parsed?.pinnedOpenIssueEventIds.join(",") === "q1", "Prompt audit must preserve restored event ids.");
assert(parsed?.pinnedIssueSourceEventIds.join(",") === "q1", "Prompt audit must preserve the exact canonical pin-reason source event.");
assert(parsed?.latestRoundEventIds.join(",") === "r2-1", "Prompt audit must preserve protected newest-round ids.");
assert(parsed?.latestRoundSelectedActorIds.join(",") === "gemini", "Actual Prompt audit must derive represented latest-round actors only from payload it can see.");
assert(/^fnv1a64:[0-9a-f]{16}:\d+$/.test(parsed?.publicContextFingerprint ?? ""), "Actual Prompt audit must preserve a bounded 64-bit normalized public-payload fingerprint without storing duplicate prose.");
assert(parsed?.repairAttempt === false, "First Prompt must not be mislabeled as repair.");

const firstRemembered = rememberProviderPromptMemorySelection(prompt);
const repair = rememberProviderPromptMemorySelection(`${prompt}\nREPAIR ATTEMPT:\nReturn corrected JSON.`);
assert(repair?.repairAttempt, "Repair Prompt must receive an independent audit key.");
assert(repair?.publicContextFingerprint === firstRemembered?.publicContextFingerprint, "A pure format repair must preserve the exact normalized public payload fingerprint.");
const remembered = providerPromptMemorySelectionFor({
  sessionId: "memory-session",
  actorId: "claude",
  phase: "debate",
  round: 3,
  repairAttempt: true,
});
assert(remembered?.snapshotEventIds.length === 3, "Remembered repair metadata must retain the exact public deck.");
assert(remembered?.latestRoundSelectedActorIds.join(",") === "gemini", "Remembered repair receipt must keep actual represented actors.");

const changedPayloadPrompt = prompt.replace("Detail", "Different detail");
const changedPayload = parseProviderPromptMemorySelection(changedPayloadPrompt);
assert(changedPayload?.snapshotEventIds.join(",") === parsed?.snapshotEventIds.join(","), "Payload drift fixture intentionally keeps identical event ids.");
assert(changedPayload?.publicContextFingerprint !== parsed?.publicContextFingerprint, "Same event ids with different public event content must produce a different payload fingerprint.");

const zeroPin = parseProviderPromptMemorySelection([
  "SESSION_ID: memory-session",
  "PHASE: sealed",
  "ROUND: 1",
  "YOUR_ACTOR_ID: claude",
  "PUBLIC_SNAPSHOT_EVENT_IDS_JSON: []",
  "PINNED_OPEN_ISSUE_EVENT_IDS_JSON: []",
  "LATEST_ROUND_EVENT_IDS_JSON: []",
  "CONSULTATION_EVENTS_JSON: []",
].join("\n"));
assert(zeroPin && zeroPin.pinnedOpenIssueEventIds.length === 0 && zeroPin.pinnedIssueSourceEventIds.length === 0, "Observed modern zero-pin Prompts must remain distinguishable from legacy missing audit data.");
assert(zeroPin?.publicContextFingerprint, "Even an empty sealed public payload must have an actual Prompt fingerprint when the field exists.");

console.log("✓ exact RUN_SPEECH memory metadata, 64-bit public-payload fingerprint and repair parity are audited without prose inference");
