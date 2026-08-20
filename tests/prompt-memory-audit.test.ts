import {
  parseProviderPromptMemorySelection,
  providerPromptMemorySelectionFor,
  rememberProviderPromptMemorySelection,
} from "../src/provider-sdk/prompt-memory-audit.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const prompt = [
  "SESSION_ID: memory-session",
  "PHASE: debate",
  "ROUND: 3",
  "YOUR_ACTOR_ID: claude",
  'PUBLIC_SNAPSHOT_EVENT_IDS_JSON: ["a1","q1","r2-1"]',
  'PINNED_OPEN_ISSUE_EVENT_IDS_JSON: ["q1"]',
  'LATEST_ROUND_EVENT_IDS_JSON: ["r2-1"]',
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
assert(parsed?.repairAttempt === false, "First Prompt must not be mislabeled as repair.");

const repair = rememberProviderPromptMemorySelection(`${prompt}\nREPAIR ATTEMPT:\nReturn corrected JSON.`);
assert(repair?.repairAttempt, "Repair Prompt must receive an independent audit key.");
const remembered = providerPromptMemorySelectionFor({
  sessionId: "memory-session",
  actorId: "claude",
  phase: "debate",
  round: 3,
  repairAttempt: true,
});
assert(remembered?.snapshotEventIds.length === 3, "Remembered repair metadata must retain the exact public deck.");

const zeroPin = parseProviderPromptMemorySelection([
  "SESSION_ID: memory-session",
  "PHASE: sealed",
  "ROUND: 1",
  "YOUR_ACTOR_ID: claude",
  "PUBLIC_SNAPSHOT_EVENT_IDS_JSON: []",
  "PINNED_OPEN_ISSUE_EVENT_IDS_JSON: []",
  "LATEST_ROUND_EVENT_IDS_JSON: []",
].join("\n"));
assert(zeroPin && zeroPin.pinnedOpenIssueEventIds.length === 0 && zeroPin.pinnedIssueSourceEventIds.length === 0, "Observed modern zero-pin Prompts must remain distinguishable from legacy missing audit data.");

console.log("✓ exact RUN_SPEECH Prompt memory metadata is parsed without prose inference");
