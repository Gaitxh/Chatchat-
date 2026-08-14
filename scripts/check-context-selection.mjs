import fs from "node:fs";

const openIssues = fs.readFileSync("src/consultation/open-issues.ts", "utf8");
const selector = fs.readFileSync("src/provider-sdk/context-selection.ts", "utf8");
const protocol = fs.readFileSync("src/provider-sdk/consultation-protocol.ts", "utf8");
const modePrompt = fs.readFileSync("src/provider-sdk/consultation-mode-prompt.ts", "utf8");
const agent = fs.readFileSync("src/provider-sdk/consultation-agent.ts", "utf8");
const executionAudit = fs.readFileSync("src/provider-sdk/execution-audit.ts", "utf8");
const attendance = fs.readFileSync("src/theater/provider-attendance.ts", "utf8");

for (const claim of [
  "OpenMeetingIssueProvenance",
  "deriveOpenMeetingIssueProvenance",
  "deriveOpenMeetingIssues",
  "explicitlyAnswersRequest",
]) {
  assert(openIssues.includes(claim), `Open Issues structural truth source is missing: ${claim}`);
}

for (const claim of [
  "DEFAULT_PROVIDER_CONTEXT_EVENTS = 12",
  "DEFAULT_PROVIDER_PINNED_ISSUE_EVENTS = 6",
  "deriveOpenMeetingIssueProvenance",
  "latestRoundEventIds",
  "protectedLatest",
  "pinnedIssueSourceEventIds",
  "providerVisibleConsultationContext",
  "Pinned events gain memory priority only — never authority",
]) {
  assert(selector.includes(claim), `Conflict-aware context selector is missing: ${claim}`);
}
assert(!selector.includes("embedding"), "Provider context selection must not use embeddings or semantic similarity.");
assert(!selector.includes("consensusRatio"), "Provider context memory priority must not depend on stance majority.");
assert(!selector.includes("confidence >"), "Provider context memory priority must not reward higher model confidence.");

for (const claim of [
  "selectProviderContextEvents(context.publicEvents)",
  "PUBLIC_SNAPSHOT_EVENT_IDS_JSON",
  "PINNED_OPEN_ISSUE_EVENT_IDS_JSON",
  "LATEST_ROUND_EVENT_IDS_JSON",
  "Pinned events have memory priority only; they do not gain authority",
  "providerVisibleConsultationContext(context).context",
  "outside this Provider turn's visible consultation context",
]) {
  assert(protocol.includes(claim), `Provider prompt/parser lost bounded conflict-aware context semantics: ${claim}`);
}

for (const claim of [
  "providerVisibleConsultationContext(context).context",
  "directPeerInboxPromptBlock(visibleContext)",
  "explicitReplyPromptBlock(visibleContext)",
]) {
  assert(modePrompt.includes(claim), `Mode-aware prompt block is not using the same visible context: ${claim}`);
}

for (const claim of [
  "providerVisibleConsultationContext(context).context",
  "attachExplicitPeerReplies(raw, visible, parsed)",
]) {
  assert(agent.includes(claim), `Real Provider parse/reply path can reference invisible events: ${claim}`);
}

for (const claim of [
  "selectProviderContextEvents(context.publicEvents)",
  "pinnedOpenIssueEventIds",
  "latestRoundEventIds",
]) {
  assert(executionAudit.includes(claim), `Execution audit does not preserve context-selection provenance: ${claim}`);
}
for (const claim of [
  "pinnedOpenIssueEventIds",
  "latestRoundEventIds",
]) {
  assert(attendance.includes(claim), `Attendance audit model drops context-selection provenance: ${claim}`);
}

console.log("✓ unresolved conflict memory, exact visible provenance and latest-round protection are mechanically enforced");

function assert(condition, message) {
  if (!condition) throw new Error(`Context selection check failed: ${message}`);
}
