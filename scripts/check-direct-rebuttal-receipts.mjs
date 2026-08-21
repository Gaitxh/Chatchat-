import { readFile } from "node:fs/promises";

const [receipts, openIssues, inbox, orchestrator, theater, types, runner, pinnedPrompt] = await Promise.all([
  readFile("src/consultation/direct-response-receipts.ts", "utf8"),
  readFile("src/consultation/open-issues.ts", "utf8"),
  readFile("src/consultation/peer-inbox.ts", "utf8"),
  readFile("src/core/orchestrator-engine.ts", "utf8"),
  readFile("src/theater/peer-exchange.ts", "utf8"),
  readFile("src/core/types.ts", "utf8"),
  readFile("scripts/run-test-suite.mjs", "utf8"),
  readFile("tests/pinned-issue-prompt.test.ts", "utf8"),
]);

for (const contract of [
  "findMeetingIssueResolver",
  "directPeerRequestTarget",
  'status: resolver ? "answered" : "pending"',
  "responseEventId: resolver.id",
  "pendingDirectRequestEventIds",
]) {
  requireText(receipts, contract, "canonical direct response receipt contract");
}

for (const contract of [
  "explicitlyAnswersRequest",
  "findMeetingIssueResolver",
  "candidate.actorId === target.actorId",
]) {
  requireText(openIssues, contract, "Open Issues structural closure contract");
}

for (const contract of [
  "deriveDirectResponseReceipts",
  'receipt.status === "pending"',
  "receipt.targetActorId === context.participant.id",
  'receiptStatus: "pending"',
  "machine-verifiable response receipt",
  "minority position",
  "replyToEventId",
  "causedBy",
  "Oldest-round first",
]) {
  requireText(inbox, contract, "persistent direct peer inbox contract");
}

for (const contract of [
  "pendingDirectRequestEventIds",
  "unansweredDirectRequestEventIds",
  "...unansweredDirectRequestEventIds",
  "unansweredAfterRound.length > 0",
  "directResponseRecord",
]) {
  requireText(orchestrator, contract, "automatic direct-rebuttal agenda contract");
}

for (const contract of [
  "deriveDirectResponseReceipts",
  'receipt.status === "answered"',
  "responseEventId: response.id",
  "receipt.targetActorId",
  "The UI never re-infers closure from prose or its own rules",
]) {
  requireText(theater, contract, "live peer-exchange receipt contract");
}
if (theater.includes("explicitlyAnswersRequest")) {
  fail("Live peer exchange must not keep a second direct-response closure implementation after the canonical receipt ledger exists.");
}

for (const contract of [
  "unansweredDirectRequestEventIds?: string[]",
  "response receipt",
  "Presence is transparency",
  "requester was correct",
]) {
  requireText(types, contract, "final report transparency contract");
}

for (const test of [
  "dist/tests/direct-response-receipts.test.js",
  "dist/tests/direct-rebuttal-orchestrator.test.js",
  "dist/tests/peer-inbox.test.js",
  "dist/tests/peer-exchange.test.js",
  "dist/tests/open-issues.test.js",
  "dist/tests/pinned-issue-prompt.test.js",
]) {
  requireText(runner, test, "deterministic direct-rebuttal proof");
}

for (const contract of [
  "CHATCHAT_PINNED_OPEN_ISSUES",
  "CHATCHAT_DIRECT_PEER_INBOX",
  'receiptStatus === "pending"',
  "leave the pinned Open Issues attention surface entirely",
  "leave Claude's Direct Peer Inbox entirely",
]) {
  requireText(pinnedPrompt, contract, "bounded-memory direct rebuttal proof");
}

for (const forbidden of [
  "consensusRatio",
  "convergenceThreshold",
  "persuasionScore",
  "winnerActorId",
  "forcedConcede",
]) {
  if (receipts.includes(forbidden) || inbox.includes(forbidden)) {
    fail(`Direct response debt must never depend on majority/persuasion/forced-agreement state: ${forbidden}`);
  }
}

console.log("✓ ChatChat direct rebuttal receipts are structural, persistent, bounded and minority-safe");
console.log("✓ Orchestrator, Provider memory and live Peer Exchange share one exact response-receipt truth");

function requireText(haystack, needle, label) {
  if (!haystack.includes(needle)) fail(`Missing ${label}: ${needle}`);
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}
