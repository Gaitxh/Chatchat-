import {
  parseProviderPromptMemorySelection,
  rememberProviderPromptMemorySelection,
} from "../src/provider-sdk/prompt-memory-audit.js";
import {
  providerTransportAuditSnapshot,
  recordProviderTransportAudit,
} from "../src/provider-sdk/transport-audit.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const prompt = [
  "CHATCHAT_SHARED_MEETING_OBJECTIVE",
  "SESSION_ID: memory-prompt-session",
  "PHASE: debate",
  "ROUND: 3",
  "YOUR_ACTOR_ID: actor-a",
  'PUBLIC_SNAPSHOT_EVENT_IDS_JSON: ["latest-1","old-risk","recent-2"]',
  'PINNED_OPEN_ISSUE_EVENT_IDS_JSON: ["old-risk"]',
  'LATEST_ROUND_EVENT_IDS_JSON: ["latest-1"]',
  "CHATCHAT_PINNED_OPEN_ISSUES",
  'PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON: ["old-risk"]',
  "END_CHATCHAT_PINNED_OPEN_ISSUES",
].join("\n");

const parsed = parseProviderPromptMemorySelection(prompt);
assert(parsed?.sessionId === "memory-prompt-session" && parsed.actorId === "actor-a", "Prompt memory parser must preserve exact session/actor identity.");
assert(parsed.phase === "debate" && parsed.round === 3, "Prompt memory parser must preserve phase/round.");
assert(parsed.snapshotEventIds.join(",") === "latest-1,old-risk,recent-2", "Prompt parser must preserve the exact public snapshot order.");
assert(parsed.pinnedOpenIssueEventIds[0] === "old-risk", "Prompt parser must identify actual conflict-pinned event ids.");
assert(parsed.pinnedIssueSourceEventIds[0] === "old-risk", "Prompt parser must preserve the exact Open Issue source that caused pinning.");
assert(parsed.latestRoundEventIds[0] === "latest-1", "Prompt parser must preserve latest-round protected ids.");

rememberProviderPromptMemorySelection(prompt);
recordProviderTransportAudit({
  sessionId: "memory-prompt-session",
  actorId: "actor-a",
  phase: "debate",
  round: 3,
  state: "received",
  mode: "live-provider-tabs",
  observedAt: "2026-08-15T02:00:00.000Z",
  // Simulate the older execution-provenance wrapper supplying only the generic
  // snapshot field. recordProviderTransportAudit must enrich from the actual
  // Prompt registry before freezing the receipt.
  snapshotEventIds: [],
  repairAttempt: false,
  tabId: 101,
  promptChars: prompt.length,
  responseChars: 500,
  elapsedMs: 120,
});
const receipt = providerTransportAuditSnapshot("memory-prompt-session")[0];
assert(receipt?.promptMemoryObserved === true, "Transport receipt must state that memory categories were observed in the actual RUN_SPEECH Prompt.");
assert(receipt.snapshotEventIds.join(",") === "latest-1,old-risk,recent-2", "Transport receipt must be enriched from actual Prompt snapshot metadata.");
assert(receipt.pinnedOpenIssueEventIds?.[0] === "old-risk", "Transport receipt must freeze actual Prompt pinned events.");
assert(receipt.pinnedIssueSourceEventIds?.[0] === "old-risk", "Transport receipt must freeze the actual pin-reason source event.");
assert(receipt.latestRoundEventIds?.[0] === "latest-1", "Transport receipt must freeze actual Prompt latest-round protection.");

const repairPrompt = `${prompt}\nREPAIR ATTEMPT:\nReturn corrected JSON.`;
const repair = rememberProviderPromptMemorySelection(repairPrompt);
assert(repair?.repairAttempt, "Repair prompt memory selection must use a distinct audit key.");
recordProviderTransportAudit({
  sessionId: "memory-prompt-session",
  actorId: "actor-a",
  phase: "debate",
  round: 3,
  state: "received",
  mode: "live-provider-tabs",
  observedAt: "2026-08-15T02:00:01.000Z",
  snapshotEventIds: [],
  repairAttempt: true,
  tabId: 101,
  promptChars: repairPrompt.length,
  responseChars: 480,
  elapsedMs: 90,
});
const repairReceipt = providerTransportAuditSnapshot("memory-prompt-session").find((item) => item.repairAttempt);
assert(repairReceipt?.promptMemoryObserved === true, "Repair receipt must retain actual Prompt observation status.");
assert(repairReceipt.pinnedIssueSourceEventIds?.[0] === "old-risk", "Repair transport receipt must preserve the same actual memory deck provenance.");

console.log("✓ actual RUN_SPEECH Prompt memory metadata enriches durable transport receipts");
