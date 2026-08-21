import {
  parseProviderPromptMemorySelection,
  providerPromptMemorySelectionFor,
  rememberProviderPromptMemorySelection,
} from "../src/provider-sdk/prompt-memory-audit.js";
import {
  parseProviderPublicDeck,
  providerPublicDeckAuditForRound,
  rememberProviderPublicDeck,
} from "../src/provider-sdk/public-deck-audit.js";

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

const exactPayload = JSON.stringify([
  { id: "evt-a", actorId: "gpt", round: 2, kind: "argument", stance: "ship", confidence: 0.72, content: "Use the same public deck." },
  { id: "evt-b", actorId: "claude", round: 2, kind: "challenge", targetEventId: "evt-a", content: "Verify the rollout assumption." },
]);

function publicDeckPrompt(sessionId: string, actorId: string, payload: string, repairAttempt = false): string {
  return [
    `SESSION_ID: ${sessionId}`,
    "PHASE: debate",
    "ROUND: 3",
    `YOUR_ACTOR_ID: ${actorId}`,
    'PUBLIC_SNAPSHOT_EVENT_IDS_JSON: ["evt-a","evt-b"]',
    `CONSULTATION_EVENTS_JSON: ${payload}`,
    ...(repairAttempt ? ["REPAIR ATTEMPT:", "Return corrected JSON."] : []),
  ].join("\n");
}

const exactParsed = parseProviderPublicDeck(publicDeckPrompt("exact-deck-session", "gpt", exactPayload));
assert(exactParsed?.publicSnapshotPayload === exactPayload, "Exact public-deck audit must retain the serialized payload rather than re-stringifying it.");
assert(exactParsed?.payloadCharacters === exactPayload.length, "Exact public-deck audit must expose the observed payload size without persisting another transcript copy elsewhere.");

rememberProviderPublicDeck(publicDeckPrompt("exact-deck-session", "gpt", exactPayload));
rememberProviderPublicDeck(publicDeckPrompt("exact-deck-session", "claude", exactPayload));
rememberProviderPublicDeck(publicDeckPrompt("exact-deck-session", "gemini", exactPayload));
rememberProviderPublicDeck(publicDeckPrompt("exact-deck-session", "claude", exactPayload, true));

const exactAudit = providerPublicDeckAuditForRound({
  sessionId: "exact-deck-session",
  phase: "debate",
  round: 3,
});
assert(exactAudit.peerDecksExactlyEqual === true, "Equal Provider seats must be provably observed with byte-identical serialized public Blackboard payloads.");
assert(exactAudit.peerDeckGroups.length === 1 && exactAudit.peerDeckGroups[0]?.actorIds.length === 3, "One exact deck group must contain every equal first-attempt peer.");
assert(exactAudit.repairDecksExactlyPreserved === true, "Parser repair must preserve the exact public deck visible on the first attempt.");
assert(exactAudit.repairMismatchActorIds.length === 0 && exactAudit.unpairedRepairActorIds.length === 0, "A valid repair must introduce no public-deck mismatch or unpaired repair observation.");

const sameIdsDifferentContent = JSON.stringify([
  { id: "evt-a", actorId: "gpt", round: 2, kind: "argument", stance: "ship", confidence: 0.72, content: "MUTATED FOR ONE PEER" },
  { id: "evt-b", actorId: "claude", round: 2, kind: "challenge", targetEventId: "evt-a", content: "Verify the rollout assumption." },
]);
rememberProviderPublicDeck(publicDeckPrompt("mismatch-deck-session", "gpt", exactPayload));
rememberProviderPublicDeck(publicDeckPrompt("mismatch-deck-session", "claude", sameIdsDifferentContent));
const mismatchAudit = providerPublicDeckAuditForRound({
  sessionId: "mismatch-deck-session",
  phase: "debate",
  round: 3,
});
assert(mismatchAudit.peerDecksExactlyEqual === false, "Audit must catch changed public content even when PUBLIC_SNAPSHOT_EVENT_IDS_JSON stays identical.");
assert(mismatchAudit.peerDeckGroups.length === 2, "Different serialized payloads with the same ids must form separate exact-deck groups.");

rememberProviderPublicDeck(publicDeckPrompt("repair-mismatch-session", "gpt", exactPayload));
rememberProviderPublicDeck(publicDeckPrompt("repair-mismatch-session", "gpt", sameIdsDifferentContent, true));
const repairMismatchAudit = providerPublicDeckAuditForRound({
  sessionId: "repair-mismatch-session",
  phase: "debate",
  round: 3,
});
assert(repairMismatchAudit.repairDecksExactlyPreserved === false, "Repair audit must fail when a retry sees a changed public payload.");
assert(repairMismatchAudit.repairMismatchActorIds.join(",") === "gpt", "Repair audit must identify the seat whose public deck changed.");

console.log("✓ exact RUN_SPEECH Prompt memory metadata and byte-identical public-deck parity are audited without prose inference");
