import fs from "node:fs";

const parser = fs.readFileSync("src/provider-sdk/prompt-memory-audit.ts", "utf8");
const observer = fs.readFileSync("src/extension/prompt-memory-observer.ts", "utf8");
const execution = fs.readFileSync("src/provider-sdk/execution-audit.ts", "utf8");
const transport = fs.readFileSync("src/provider-sdk/transport-audit.ts", "utf8");
const coverage = fs.readFileSync("src/theater/provider-memory-coverage.ts", "utf8");
const gaps = fs.readFileSync("src/theater/provider-memory-gaps.ts", "utf8");
const integrity = fs.readFileSync("src/theater/meeting-memory-integrity.ts", "utf8");
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
  assert(
    html.indexOf('/src/extension/prompt-memory-observer.ts') < html.indexOf('/src/extension/execution-provenance.tsx'),
    `${label} must install Prompt memory observation inside the existing execution wrapper so later receipts can carry actual-Prompt evidence.`,
  );
  assert(
    html.indexOf('/src/extension/execution-provenance.tsx') < html.indexOf('/src/extension/consultation-panel.tsx'),
    `${label} must still install execution provenance before consultation can start.`,
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

console.log("✓ actual Prompt memory, selector audit, hard-cap gaps and memory-integrity semantics are mechanically separated");

function assert(condition, message) {
  if (!condition) throw new Error(`Provider memory v2 check failed: ${message}`);
}
