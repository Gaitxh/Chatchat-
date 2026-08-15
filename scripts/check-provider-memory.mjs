import fs from "node:fs";

const selector = fs.readFileSync("src/provider-sdk/context-selection.ts", "utf8");
const prompt = fs.readFileSync("src/provider-sdk/consultation-protocol.ts", "utf8");
const modePrompt = fs.readFileSync("src/provider-sdk/consultation-mode-prompt.ts", "utf8");
const execution = fs.readFileSync("src/provider-sdk/execution-audit.ts", "utf8");
const promptAudit = fs.readFileSync("src/provider-sdk/prompt-memory-audit.ts", "utf8");
const transport = fs.readFileSync("src/provider-sdk/transport-audit.ts", "utf8");
const model = fs.readFileSync("src/theater/provider-memory-coverage.ts", "utf8");
const ui = fs.readFileSync("src/extension/components/ProviderMemoryCoverage.tsx", "utf8");
const portal = fs.readFileSync("src/extension/provider-memory-portal.tsx", "utf8");
const app = fs.readFileSync("app/app.html", "utf8");
const sidepanel = fs.readFileSync("extension/sidepanel.html", "utf8");

for (const claim of [
  "DEFAULT_PROVIDER_CONTEXT_EVENTS = 12",
  "DEFAULT_PROVIDER_PINNED_ISSUE_EVENTS = 6",
  "deriveOpenMeetingIssueProvenance",
  "latestRoundEventIds",
  "pinnedIssueSourceEventIds",
  "recentEventIds",
]) {
  assert(selector.includes(claim), `bounded context selector is missing: ${claim}`);
}
for (const forbidden of ["semanticSimilarity", "cosineSimilarity", "embeddingVector", "consensusRatio"]) {
  assert(!selector.includes(forbidden), `memory selection must not rank semantic authority: ${forbidden}`);
}

for (const claim of [
  "PUBLIC_SNAPSHOT_EVENT_IDS_JSON",
  "PINNED_OPEN_ISSUE_EVENT_IDS_JSON",
  "LATEST_ROUND_EVENT_IDS_JSON",
  "memory priority only",
]) {
  assert(prompt.includes(claim), `base Provider prompt is missing memory provenance: ${claim}`);
}
for (const claim of [
  "CHATCHAT_PINNED_OPEN_ISSUES",
  "PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON",
  "attention, not new evidence",
  "no event extra authority",
]) {
  assert(modePrompt.includes(claim), `mode-aware prompt is missing bounded pin semantics: ${claim}`);
}

for (const claim of [
  "pinnedIssueSourceEventIds",
  "selectProviderContextEvents(context.publicEvents)",
  "pinnedOpenIssueEventIds",
  "latestRoundEventIds",
]) {
  assert(execution.includes(claim), `execution audit is missing memory selector provenance: ${claim}`);
}

for (const claim of [
  "parseProviderPromptMemorySelection",
  "rememberProviderPromptMemorySelection",
  "PUBLIC_SNAPSHOT_EVENT_IDS_JSON",
  "PINNED_OPEN_ISSUE_EVENT_IDS_JSON",
  "PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON",
  "LATEST_ROUND_EVENT_IDS_JSON",
  "repairAttempt",
]) {
  assert(promptAudit.includes(claim), `actual Prompt memory parser is missing: ${claim}`);
}
for (const claim of [
  "providerPromptMemorySelectionFor",
  "pinnedIssueSourceEventIds",
  "promptSelection.snapshotEventIds",
  "cloneProviderTransportAudit",
]) {
  assert(transport.includes(claim), `transport receipt is not enriched from actual Prompt memory: ${claim}`);
}

for (const claim of [
  "deriveProviderMemoryCoverage",
  'ProviderMemorySelectionEvidence = "actual_prompt" | "selector_audit"',
  'selectionEvidence: ProviderMemorySelectionEvidence',
  "actualPromptTurnCount",
  "snapshotsConsistent",
  "ordinaryRecentEventIds",
  "omittedEventIds",
  "pinnedIssueSourceEventIds",
  "findMeetingIssueResolver",
]) {
  assert(model.includes(claim), `Provider Memory Coverage model is missing: ${claim}`);
}
for (const forbidden of ["semanticSimilarity", "cosineSimilarity", "embeddingVector", "importanceScore", "winnerScore"]) {
  assert(!model.includes(forbidden), `memory coverage must remain provenance accounting, not inferred importance: ${forbidden}`);
}

for (const claim of [
  'data-provider-memory-coverage="audited"',
  "data-provider-memory-actual-prompt-turns",
  "data-provider-memory-pinned-rounds",
  "data-provider-memory-consistent",
  "data-provider-memory-pinned-source",
  "data-provider-memory-resolver-event",
  "data-provider-memory-omitted-count",
  "ACTUAL PROMPT",
  "记忆优先级，不代表权威或真理",
]) {
  assert(ui.includes(claim), `Provider Memory Coverage UI is missing: ${claim}`);
}
for (const claim of [
  "ExecutionAuditHistoryStore",
  "rememberProviderPromptMemorySelection",
  "installProviderMemoryPromptObserver",
  "PROVIDER_EXECUTION_AUDIT_EVENT",
  "PROVIDER_TRANSPORT_AUDIT_EVENT",
  "deriveProviderMemoryCoverage",
  "focusConsultationEvent",
]) {
  assert(portal.includes(claim), `Provider Memory portal is missing: ${claim}`);
}
assert(portal.includes("__chatchatProviderMemoryPromptAudit"), "Prompt memory transport wrapper must be idempotent.");

for (const [label, html] of [["Full Room", app], ["Side Panel", sidepanel]]) {
  assert(html.includes('id="provider-memory-root"'), `${label} must mount Provider Memory Coverage.`);
  assert(html.includes('/src/extension/provider-memory-portal.tsx'), `${label} must load Provider Memory Coverage.`);
  assert(
    html.indexOf('/src/extension/execution-provenance.tsx') < html.indexOf('/src/extension/provider-memory-portal.tsx'),
    `${label} must install execution provenance before the outer Prompt memory observer.`,
  );
  assert(
    html.indexOf('/src/extension/provider-memory-portal.tsx') < html.indexOf('/src/extension/consultation-panel.tsx'),
    `${label} must install the Prompt memory observer before consultation sends Provider turns.`,
  );
}

console.log("✓ Provider Memory Coverage proves bounded public memory from actual Prompt metadata with archive fallback");

function assert(condition, message) {
  if (!condition) throw new Error(`Provider Memory check failed: ${message}`);
}
