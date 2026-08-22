import { readFile } from "node:fs/promises";

const [summary, component, css, portal, app, hierarchy, runner, test, workflow, historyGuard] = await Promise.all([
  readFile("src/consultation/council-verdict-readout.ts", "utf8"),
  readFile("src/extension/components/CouncilVerdictReadout.tsx", "utf8"),
  readFile("src/extension/components/council-verdict-readout.css", "utf8"),
  readFile("src/extension/council-verdict-portal.tsx", "utf8"),
  readFile("app/app.html", "utf8"),
  readFile("src/extension/web-visual-hierarchy.ts", "utf8"),
  readFile("scripts/run-test-suite.mjs", "utf8"),
  readFile("tests/council-verdict-readout.test.ts", "utf8"),
  readFile(".github/workflows/council-verdict-ui.yml", "utf8"),
  readFile("extension-public/history-persistence-showcase-guard.js", "utf8"),
]);

for (const text of [
  "deriveResponseObligationSummary(report, events)",
  "response.pending > 0",
  "report.disagreements.length > 0",
  "report.consensusStance === null",
  '"stable-alignment"',
  "responseReportMatchesCanonical",
  "causeEventIds",
]) requireText(summary, text, "deterministic Council readout derivation");

for (const text of [
  'data-council-verdict="ready"',
  "data-council-verdict-archive",
  "data-council-verdict-response-pending",
  "data-council-verdict-minority-count",
  "data-council-verdict-response-report-match",
  "Majority is not authority",
  "Alignment is not correctness",
  "Unanswered is not a win condition",
  "多数不是权威",
  "不是正确率",
  "未答质询不是胜负判定",
]) requireText(component, text, "first-layer epistemic boundary");

for (const forbidden of [
  "outcome.confidence",
  "readout.confidence",
  "truthScore",
  "winnerActorId",
  "persuasionScore",
  "forcedConcede",
]) {
  if (component.includes(forbidden) || summary.includes(forbidden)) {
    fail(`Council Verdict must not turn confidence/persuasion into first-layer authority: ${forbidden}`);
  }
}

for (const text of [
  'id="council-verdict-root"',
  '/src/extension/council-verdict-portal.tsx',
]) requireText(app, text, "Web Room Council verdict mount");

const stageBlock = hierarchy.match(/const PUBLIC_STAGE_ROOT_IDS = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
const auditBlock = hierarchy.match(/const AUDIT_ROOT_IDS = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
requireText(stageBlock, '"council-verdict-root"', "Council Verdict public-stage registration");
if (auditBlock.includes('"council-verdict-root"')) fail("Council Verdict must never be demoted into Audit Vault.");

for (const text of [
  'const COMPLETE_EVENT = "chatchat:consultation-complete"',
  'const OPEN_ARCHIVE_EVENT = "chatchat:consultation-open-archive"',
  'const LIVE_EVENT = "chatchat:consultation-live"',
  'document.documentElement.dataset.chatchatVerdictStage = "ready"',
  'app.insertBefore(root, outcome)',
]) requireText(portal, text, "Council Verdict lifecycle / placement");

for (const text of [
  '.outcome-card > .outcome-hero',
  'data-chatchat-verdict-stage="ready"',
  '.council-verdict-facts',
  '.council-verdict-alert',
  '.participants-card',
  'position: static',
]) requireText(css, text, "Council Verdict visual hierarchy / overlap boundary");

requireText(runner, '"dist/tests/council-verdict-readout.test.js"', "Council Verdict deterministic test registration");

for (const text of [
  'id: "sealed-question", round: 1',
  'readout.attentionState === "pending-response"',
  'report.positions[1]!.confidence > report.positions[0]!.confidence',
  '!readout.unansweredRequestEventIds.includes("sealed-question")',
]) requireText(test, text, "adversarial verdict test");

for (const text of [
  'if (params.get("showcase") !== "consultation") return;',
  'const HOLD_LIVE_VERDICT = params.get("verdict-proof") === "focus";',
  'document.documentElement.dataset.chatchatExecutionHistoryPersistenceShowcase = "complete";',
  'document.documentElement.dataset.chatchatVerdictProofHistoryMode = "live-held";',
  'if (HOLD_LIVE_VERDICT)',
]) requireText(historyGuard, text, "Verdict-only synthetic proof ownership boundary");

for (const text of [
  "Council Verdict UI",
  'data-council-verdict="ready"',
  'data-council-verdict-archive="false"',
  'data-council-verdict-attention="pending-response"',
  'data-chatchat-verdict-proof-history-mode="live-held"',
  "verdict-proof=focus",
  "check-png-content.mjs",
]) requireText(workflow, text, "production Chromium live Council Verdict proof");
if (workflow.includes("receipt-proof=focus")) {
  fail("Dedicated Council Verdict proof must capture live completion, not trigger archive receipt replay.");
}

console.log("✓ Council Verdict keeps unresolved duties and minority views above apparent alignment");
console.log("✓ First-layer result language cannot promote confidence, majority, or persuasion into correctness");
console.log("✓ Completed verdict releases the sticky seat rail so the full-width result cannot be obscured");
console.log("✓ Verdict proof still verifies persistence, then holds the live view without taking over normal History replay");

function requireText(haystack, needle, label) {
  if (!haystack.includes(needle)) fail(`Missing ${label}: ${needle}`);
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}
