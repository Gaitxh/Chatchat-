import { readFile } from "node:fs/promises";

const [
  canonical,
  summary,
  component,
  receipt,
  showcase,
  runner,
  councilStageWorkflow,
  summaryTest,
  captureProof,
  nextMovePortal,
  receiptPortal,
] = await Promise.all([
  readFile("src/consultation/direct-response-receipts.ts", "utf8"),
  readFile("src/consultation/response-obligation-summary.ts", "utf8"),
  readFile("src/extension/components/ResponseObligations.tsx", "utf8"),
  readFile("src/extension/components/ConsultationReceipt.tsx", "utf8"),
  readFile("extension-public/consultation-receipt-showcase-guard.js", "utf8"),
  readFile("scripts/run-test-suite.mjs", "utf8"),
  readFile(".github/workflows/council-stage-ui.yml", "utf8"),
  readFile("tests/response-obligation-summary.test.ts", "utf8"),
  readFile("scripts/capture-chromium-proof.mjs", "utf8"),
  readFile("src/extension/next-move-portal.tsx", "utf8"),
  readFile("src/extension/consultation-receipt-portal.tsx", "utf8"),
]);

requireText(summary, 'deriveDirectResponseReceipts(events)', "canonical direct-response ledger consumption");
requireText(canonical, "findMeetingIssueResolver", "Open Issues closure ownership");
requireText(summary, "FIRST_PUBLIC_DEBATE_ROUND = 2", "sealed round-one independence boundary");
requireText(summary, "receipt.requestRound >= FIRST_PUBLIC_DEBATE_ROUND", "R2+ public response obligation filter");
requireText(summary, "unansweredDirectRequestEventIds", "final report unanswered-id reconciliation");
requireText(summary, "reportMatchesCanonical", "report/ledger consistency receipt");
requireText(summary, "safeResponseObligationsMarkdown", "shareable Markdown response receipt");
requireText(summary, "responseObligationsSvgBadge", "shareable SVG response badge");
requireText(summaryTest, 'id: "sealed-question", round: 1', "adversarial sealed direct request fixture");
requireText(summaryTest, '!summary.items.some((item) => item.requestEventId === "sealed-question")', "sealed request exclusion proof");

for (const text of [
  'data-response-obligations="present"',
  "data-response-obligation-status",
  "data-request-event-id",
  "data-response-event-id",
  "Response duty ≠ agreement duty",
  "多数立场不能替任何 AI 代答",
]) requireText(component, text, "visible response-obligation receipt");

for (const text of [
  "deriveResponseObligationSummary(report, events)",
  "safeResponseObligationsMarkdown(responseObligations, locale)",
  "responseObligationsSvgBadge(baseSvg, responseObligations, locale)",
  "<ResponseObligations summary={responseObligations} locale={locale} />",
]) requireText(receipt, text, "Consultation Receipt response-obligation integration");

for (const [source, label] of [
  [nextMovePortal, "Next Move portal"],
  [receiptPortal, "Consultation Receipt portal"],
]) {
  requireText(source, 'const app = document.querySelector(".consultation-app")', `${label} Council Stage anchor`);
  requireText(source, "root.parentElement !== app", `${label} fail-safe stage reparent`);
  for (const forbidden of [
    "sourceObservation?.parentElement\n      ??",
    "evidence?.parentElement\n      ??",
    "history?.parentElement\n      ??",
    "nextMove?.parentElement\n      ??",
  ]) {
    if (source.includes(forbidden)) fail(`${label} must not derive its parent from an audit/secondary root: ${forbidden}`);
  }
}

for (const text of [
  'params.get("receipt-proof") === "focus"',
  'data-response-obligations="present"',
  'data-response-obligation-status="answered"',
  'data-response-obligation-status="pending"',
  'data-response-obligations-report-match',
  'receiptRoot.parentElement !== app || nextMoveRoot.parentElement !== app',
  'receiptRoot.closest("#chatchat-audit-vault")',
  'nextMoveRoot.closest("#chatchat-audit-vault")',
  'setMarker("chatchatResponseObligationStageParent", "complete")',
  "finalLayoutReady()",
  'dataset.chatchatLiveDeliberationShowcase === "complete"',
  'dataset.chatchatFinalPositionFloorShowcase === "complete"',
  'dataset.chatchatHistoryPersistenceShowcase === "complete"',
  'dataset.chatchatRoomShowcase === "complete"',
  "scheduleLayoutCheck(obligations)",
  "layoutChecks >= 6",
  "layoutChecks < 6",
  "window.setTimeout(() =>",
  "}, 120);",
  "geometryOf(element)",
  "geometryStable(previousGeometry, geometry)",
  'setMarker("chatchatResponseObligationLayoutReady", "complete")',
  'setMarker("chatchatResponseObligationsShowcase", "complete")',
  'if (document.documentElement.dataset[key] === value) return;',
  "attributeFilter: [",
  '"data-chatchat-live-deliberation-showcase"',
  '"data-chatchat-final-position-floor-showcase"',
  '"data-chatchat-history-persistence-showcase"',
  '"data-chatchat-room-showcase"',
]) requireText(showcase, text, "bounded stable-layout response receipt proof");
for (const forbidden of ["setInterval(", "scrollIntoView(", "insideViewport("]) {
  if (showcase.includes(forbidden)) fail(`Response showcase should wait for layout stability and leave viewport focus to shared Chromium: ${forbidden}`);
}
if (showcase.includes('observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });')) {
  fail("Response receipt proof must not observe every attribute; broad mutation churn can wedge hosted Chromium.");
}

for (const text of [
  "Capture bilingual response-obligation receipts",
  'if [ "$LANG" = "zh" ]; then HTML_LANG="zh-CN"; else HTML_LANG="en"; fi',
  "receipt-proof=focus",
  'data-chatchat-room-showcase=\\"complete\\"',
  'data-chatchat-live-deliberation-showcase=\\"complete\\"',
  'data-chatchat-history-persistence-showcase=\\"complete\\"',
  'data-chatchat-final-position-floor-showcase=\\"complete\\"',
  'data-chatchat-response-obligations-showcase=\\"complete\\"',
  'data-chatchat-response-obligation-layout-ready=\\"complete\\"',
  '--focus-selector \'[data-response-obligations="present"]\'',
  "Validate answered and pending response receipts",
]) requireText(councilStageWorkflow, text, "stable-layout focused Chromium response receipt proof");
if (councilStageWorkflow.includes("--clip-selector")) fail("Response receipt proof must use the existing bounded focus path, not custom screenshot clipping.");

for (const text of [
  "const focusSelector = typeof args.focusSelector",
  "await focusElement(cdp, focusSelector)",
  "captureBeyondViewport: false",
  "const cdpCallTimeoutMs = Math.min(8000",
  "const MAX_CAPTURE_ATTEMPTS = 2",
]) requireText(captureProof, text, "shared bounded Chromium proof contract");

const chromiumRetryPolicy = captureProof.match(
  /function isRetryableTransientCdpError\(error\) \{([\s\S]*?)\n\}/,
)?.[1] ?? "";
for (const allowed of ["Runtime\\.evaluate", "Page\\.captureScreenshot"]) {
  requireText(chromiumRetryPolicy, allowed, `shared bounded Chromium ${allowed} retry class`);
}
for (const forbidden of ["Page\\.navigate", "Page\\.enable", "Runtime\\.enable", "Emulation\\.setDeviceMetricsOverride"]) {
  if (chromiumRetryPolicy.includes(forbidden)) {
    fail(`Response receipt proof must not broaden shared fresh-browser retry policy to ${forbidden}.`);
  }
}
requireText(
  captureProof,
  "attempt >= MAX_CAPTURE_ATTEMPTS || !isRetryableTransientCdpError(error)",
  "second Chromium attempt remains fatal",
);

for (const forbidden of ["clipSelector", "cropPng", "decodePng", "PNG_SIGNATURE", 'from "node:zlib"']) {
  if (captureProof.includes(forbidden)) fail(`Response receipts must not expand the shared screenshot infrastructure: ${forbidden}`);
}

requireText(runner, 'dist/tests/response-obligation-summary.test.js', "deterministic response-obligation test program");

for (const forbidden of [
  "consensusRatio",
  "convergenceThreshold",
  "persuasionScore",
  "winnerActorId",
  "forcedConcede",
  "semanticSimilarity",
]) {
  if (summary.includes(forbidden)) fail(`Response-obligation closure/share model must not depend on ${forbidden}.`);
}

console.log("✓ ChatChat final receipt consumes the canonical named-response ledger");
console.log("✓ Sealed round-one targeting cannot become final public response debt");
console.log("✓ Primary Next Move / Consultation Receipt portals cannot follow audit roots into the Audit Vault");
console.log("✓ Answered/pending obligations remain exact-provenance facts, never forced agreement or a truth score");
console.log("✓ Proof waits for bounded geometric stability, then delegates viewport focus to the shared evidence-bounded Chromium helper");

function requireText(haystack, needle, label) {
  if (!haystack.includes(needle)) fail(`Missing ${label}: ${needle}`);
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}
