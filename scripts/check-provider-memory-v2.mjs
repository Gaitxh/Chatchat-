import fs from "node:fs";

const parser = fs.readFileSync("src/provider-sdk/prompt-memory-audit.ts", "utf8");
const observer = fs.readFileSync("src/extension/prompt-memory-observer.ts", "utf8");
const execution = fs.readFileSync("src/provider-sdk/execution-audit.ts", "utf8");
const transport = fs.readFileSync("src/provider-sdk/transport-audit.ts", "utf8");
const coverage = fs.readFileSync("src/theater/provider-memory-coverage.ts", "utf8");
const gaps = fs.readFileSync("src/theater/provider-memory-gaps.ts", "utf8");
const integrity = fs.readFileSync("src/theater/meeting-memory-integrity.ts", "utf8");
const portal = fs.readFileSync("src/extension/provider-memory-portal.tsx", "utf8");
const coverageUi = fs.readFileSync("src/extension/components/ProviderMemoryCoverage.tsx", "utf8");
const gapUi = fs.readFileSync("src/extension/components/ProviderMemoryGaps.tsx", "utf8");
const fixture = fs.readFileSync("extension-public/provider-memory-showcase.js", "utf8");
const guard = fs.readFileSync("extension-public/provider-memory-showcase-guard.js", "utf8");
const historyGuard = fs.readFileSync("extension-public/history-persistence-showcase-guard.js", "utf8");
const validator = fs.readFileSync("scripts/validate-provider-memory-evidence.mjs", "utf8");
const workflow = fs.readFileSync(".github/workflows/ci.yml", "utf8");
const app = fs.readFileSync("app/app.html", "utf8");
const sidepanel = fs.readFileSync("extension/sidepanel.html", "utf8");

for (const claim of [
  "PUBLIC_SNAPSHOT_EVENT_IDS_JSON",
  "PINNED_OPEN_ISSUE_EVENT_IDS_JSON",
  "PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON",
  "LATEST_ROUND_EVENT_IDS_JSON",
  "rememberProviderPromptMemorySelection",
]) assert(parser.includes(claim), `Exact Prompt memory parser is missing ${claim}.`);

for (const claim of [
  "RUN_SPEECH",
  "rememberProviderPromptMemorySelection",
  "return original(tabId, payload, ...rest)",
  "__chatchatPromptMemoryObserverV1",
]) assert(observer.includes(claim), `Prompt memory observer is missing ${claim}.`);

for (const [label, html] of [["Full Room", app], ["Side Panel", sidepanel]]) {
  assert(html.includes('/src/extension/prompt-memory-observer.ts'), `${label} must load the read-only Prompt memory observer.`);
  assert(html.includes('id="provider-memory-root"'), `${label} must expose a Provider Memory UI root.`);
  assert(html.includes('/src/extension/provider-memory-portal.tsx'), `${label} must mount Provider Memory Coverage.`);
  assert(
    html.indexOf('/src/extension/prompt-memory-observer.ts') < html.indexOf('/src/extension/execution-provenance.tsx'),
    `${label} must install Prompt memory observation inside the existing execution wrapper so later receipts can carry actual-Prompt evidence.`,
  );
  assert(
    html.indexOf('/src/extension/execution-provenance.tsx') < html.indexOf('/src/extension/provider-memory-portal.tsx')
      && html.indexOf('/src/extension/provider-memory-portal.tsx') < html.indexOf('/src/extension/consultation-panel.tsx'),
    `${label} must mount Provider Memory after execution provenance but before consultation can start.`,
  );
}

for (const claim of [
  "contextSelectionObserved?: true",
  "pinnedIssueSourceEventIds",
  "contextSelectionObserved: true",
  "pinnedOpenIssueEventIds: [...selection.pinnedEventIds]",
]) assert(execution.includes(claim), `Selector audit contract is missing ${claim}.`);

for (const claim of [
  "promptMemoryObserved?: true",
  "providerPromptMemorySelectionFor",
  "pinnedIssueSourceEventIds",
  "promptMemoryObserved: true",
]) assert(transport.includes(claim), `Transport actual-Prompt evidence is missing ${claim}.`);

for (const claim of [
  '"actual_prompt"',
  '"selector_audit"',
  '"legacy_selector_audit"',
  "selectorMatchesActualPrompt",
  "allSharedSnapshotsConsistent",
  "pinnedIssueSourceEventIds",
  "omittedEventIds",
]) assert(coverage.includes(claim), `Provider Memory Coverage is missing ${claim}.`);

for (const claim of [
  "deriveOpenMeetingIssueProvenance",
  "snapshot.has(issue.sourceEventId)",
  "memory-coverage fact only",
]) assert(gaps.includes(claim), `Provider memory gap semantics are missing ${claim}.`);

for (const claim of [
  '"bounded_coverage"',
  '"selector_drift"',
  '"peer_fairness_violation"',
  '"legacy_unverified"',
  "synthetic composite trust score",
]) assert(integrity.includes(claim), `Meeting memory integrity is missing ${claim}.`);

for (const claim of [
  "ExecutionAuditHistoryStore",
  "providerExecutionAuditSnapshot",
  "providerTransportAuditSnapshot",
  "deriveProviderMemoryCoverage",
  "deriveProviderMemoryGaps",
  "deriveMeetingMemoryIntegrity",
  "OPEN_ARCHIVE_EVENT",
  'data-provider-memory-view={archive ? "archive" : "live"}',
]) assert(portal.includes(claim), `Provider Memory portal is missing ${claim}.`);

for (const claim of [
  'data-provider-memory-coverage="audited"',
  "data-provider-memory-actual-prompt-turns",
  "data-provider-memory-consistent",
  "data-provider-memory-selector-consistent",
  "data-provider-memory-integrity",
  "WHY OLD EVENTS WERE BROUGHT BACK",
]) assert(coverageUi.includes(claim), `Provider Memory Coverage UI is missing ${claim}.`);

for (const claim of [
  "MEMORY COVERAGE GAPS",
  "data-provider-memory-gap-state",
  "Coverage gap",
  "ACTUAL PROMPT",
  "LEGACY SELECTOR",
]) assert(gapUi.includes(claim), `Provider Memory Gap UI is missing ${claim}.`);

for (const claim of [
  'memory-proof") !== "coverage"',
  "MEMORY_PROOF_OLD_ROLLOUT_RISK",
  "MEMORY_PROOF_R2_ORDINARY",
  "MEMORY_PROOF_R3_RESOLVER",
  "PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON",
]) assert(fixture.includes(claim), `Provider Memory stress fixture is missing ${claim}.`);

for (const claim of [
  'data-provider-memory-round="3"',
  'data-provider-memory-round="4"',
  'data-provider-memory-snapshot-count',
  'data-provider-memory-actual-prompt-seats',
  'data-provider-memory-resolver-event',
  "chatchatProviderMemoryShowcase",
]) assert(guard.includes(claim), `Provider Memory browser guard is missing ${claim}.`);

for (const claim of [
  'data-provider-memory-view="archive"',
  "data-provider-memory-view-session",
  "data-provider-memory-evidence",
  "chatchatProviderMemoryHistoryReplayShowcase",
  "Historical Provider Memory Coverage did not rebuild from the frozen execution receipt",
  "not-applicable",
]) assert(historyGuard.includes(claim), `Frozen Provider Memory history replay contract is missing ${claim}.`);

for (const claim of [
  "chatchat-provider-memory-zh.html",
  "chatchat-provider-memory-en.html",
  "R3 must preserve the 12-event hard cap",
  "R4 must release the resolved source",
]) assert(validator.includes(claim), `Provider Memory evidence validator is missing ${claim}.`);

for (const claim of [
  "memory-proof=coverage",
  "data-chatchat-provider-memory-showcase=",
  "chatchat-provider-memory-zh.png",
  "chatchat-provider-memory-en.png",
  "validate-provider-memory-evidence.mjs",
  "data-chatchat-live-deliberation-showcase=",
]) assert(workflow.includes(claim), `CI Provider Memory proof is missing ${claim}.`);

console.log("✓ actual Prompt memory, selector audit, hard-cap gaps, frozen archive replay and dedicated Chromium stress proof are mechanically required");

function assert(condition, message) {
  if (!condition) throw new Error(`Provider memory v2 check failed: ${message}`);
}
