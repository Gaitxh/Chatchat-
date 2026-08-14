import fs from "node:fs";

const model = fs.readFileSync("src/theater/context-memory.ts", "utf8");
const portal = fs.readFileSync("src/extension/context-memory-portal.tsx", "utf8");
const guard = fs.readFileSync("extension-public/context-memory-showcase-guard.js", "utf8");
const app = fs.readFileSync("app/app.html", "utf8");
const sidepanel = fs.readFileSync("extension/sidepanel.html", "utf8");

for (const claim of [
  "deriveProviderContextMemory",
  'event.stage !== "turn_started"',
  "pinnedOpenIssueEventIds",
  "latestRoundEventIds",
  "legacySelectionAudit",
  "pinnedTurnCount",
  "legacyTurnCount",
]) {
  assert(model.includes(claim), `Context Memory model is missing: ${claim}`);
}

for (const claim of [
  "ExecutionAuditHistoryStore",
  "PROVIDER_EXECUTION_AUDIT_EVENT",
  "deriveProviderContextMemory",
  'data-context-memory-audit="visible"',
  "data-context-memory-pinned-turns",
  "data-context-memory-legacy-turns",
  "data-context-memory-pinned-count",
  "data-context-memory-latest-count",
  "data-context-memory-pinned-ids",
  "Pin ≠ 重要性评分",
  "Pin ≠ importance score",
  "不重新调用 Provider",
]) {
  assert(portal.includes(claim), `Context Memory portal is missing live/archive audit semantics: ${claim}`);
}

for (const [label, html] of [["Full Room", app], ["Side Panel", sidepanel]]) {
  assert(html.includes('id="context-memory-root"'), `${label} must mount Context Memory Audit.`);
  assert(html.includes('/src/extension/context-memory-portal.tsx'), `${label} must load Context Memory Audit.`);
  assert(html.includes('/context-memory-showcase-guard.js'), `${label} must load Context Memory Chromium proof.`);
  assert(
    html.indexOf('/src/extension/context-memory-portal.tsx') < html.indexOf('/src/extension/consultation-panel.tsx'),
    `${label} must subscribe to selection audit events before consultation turns start.`,
  );
}

for (const claim of [
  "chatchatContextMemoryLiveShowcase",
  "chatchatContextMemoryHistoryShowcase",
  "chatchatContextMemoryShowcase",
  'data-context-memory-pinned-count]:not([data-context-memory-pinned-count="0"]',
  'data-context-memory-latest-count]:not([data-context-memory-latest-count="0"]',
  'data-context-memory-pinned-ids="visible"',
  'dataset.surface === "web-app"',
  '"not-applicable"',
]) {
  assert(guard.includes(claim), `Chromium Context Memory proof is missing: ${claim}`);
}

console.log("✓ Context Memory Audit exposes live/frozen selection provenance and requires real pinned events in Chromium");

function assert(condition, message) {
  if (!condition) throw new Error(`Context Memory Audit check failed: ${message}`);
}
