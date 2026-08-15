import fs from "node:fs";

const model = fs.readFileSync("src/theater/final-position-floor.ts", "utf8");
const component = fs.readFileSync("src/extension/components/FinalPositionFloor.tsx", "utf8");
const portal = fs.readFileSync("src/extension/final-position-floor-portal.tsx", "utf8");
const app = fs.readFileSync("app/app.html", "utf8");
const sidepanel = fs.readFileSync("extension/sidepanel.html", "utf8");
const browserGuard = fs.readFileSync("extension-public/final-position-floor-showcase-guard.js", "utf8");
const ci = fs.readFileSync(".github/workflows/ci.yml", "utf8");
const capture = fs.readFileSync("scripts/capture-chromium-proof.mjs", "utf8");
const focusedValidator = fs.readFileSync("scripts/validate-final-position-evidence.mjs", "utf8");

for (const claim of [
  "deriveFinalPositionFloor",
  "CouncilReport",
  "report.positions.map",
  "normalizeFinalStance",
  "unexplainedFinalShift",
  "revisionSteps",
  "causedByEventIds",
  "executionState",
  'finalTurn.state === "fallback"',
  'finalTurn.state === "repaired"',
  "reportAlignmentMatchesGroups",
]) {
  assert(model.includes(claim), `Final Position Floor model is missing: ${claim}`);
}
assert(!/\bembed(?:ding)?\s*\(/i.test(model), "Final groups must not call embedding similarity code.");
assert(!/\bcosineSimilarity\s*\(/.test(model), "Final groups must not infer semantically similar camps.");
assert(model.includes("stance.trim().toLocaleLowerCase()"), "Final grouping must match the orchestrator trim/lowercase contract.");

for (const claim of [
  "FINAL POSITION FLOOR",
  "会议最终席位图",
  'data-final-position-floor="explicit-final-submissions"',
  "data-final-position-group-leading",
  "data-final-seat-execution",
  "data-final-seat-lineage",
  "data-final-seat-revision-event",
  'data-final-seat-shift-warning="unexplained"',
  "EXPLICIT REVISION RECEIPTS",
  "明确 revision 票据",
  "no matching revision event",
  "没有对应 revision 事件",
  "Challenges, evidence, support, or somebody else's prose cannot assign a final camp",
  "质疑、证据、支持和别人替它说的话都不能把一个席位塞进某个阵营",
  "DEMO · SYNTHETIC",
]) {
  assert(component.includes(claim), `Final Position Floor UI is missing: ${claim}`);
}
assert(!component.includes("EXPLICIT REVISION LINEAGE"), "Final UI must not imply an unexplained final shift is part of the explicit revision lineage.");
assert(!component.includes("明确修正轨迹"), "Chinese Final UI must distinguish explicit revision receipts from unexplained Final changes.");

for (const claim of [
  "providerTransportAuditSnapshot",
  "providerExecutionAuditSnapshot",
  "ExecutionAuditHistoryStore",
  "buildProviderAttendanceAudit",
  "chatchat:consultation-complete",
  "chatchat:consultation-open-archive",
  "saved?.mode",
  "archive: true",
]) {
  assert(portal.includes(claim), `Final Position Floor live/archive provenance is missing: ${claim}`);
}

for (const [label, html] of [["Full Room", app], ["Side Panel", sidepanel]]) {
  assert(html.includes('id="final-position-floor-root"'), `${label} must mount the final position floor.`);
  assert(html.includes('/final-position-floor-showcase-guard.js'), `${label} must load final position Chromium proof.`);
  assert(html.includes('/src/extension/final-position-floor-portal.tsx'), `${label} must load final position floor before consultation panel.`);
  assert(
    html.indexOf('/src/extension/final-position-floor-portal.tsx') < html.indexOf('/src/extension/consultation-panel.tsx'),
    `${label} must subscribe to completion before the consultation panel can emit it.`,
  );
}

for (const claim of [
  "data-chatchat-final-position-floor-showcase",
  'data-final-position-synthetic="true"',
  'data-final-position-group-leading="true"',
  'data-final-position-group-leading="false"',
  'data-final-seat-execution="verified"',
  'data-final-seat-execution="repaired"',
  'data-final-seat-changed="true"',
  'data-final-seat-lineage="explicit-revision"',
  "data-final-seat-revision-event",
  'data-final-position-alignment-match',
]) {
  assert(browserGuard.includes(claim), `Chromium final-position proof is missing: ${claim}`);
}

for (const claim of [
  "Capture bilingual Final Position Floor close-up",
  "chatchat-final-position-floor-zh.png",
  "chatchat-final-position-floor-en.png",
  '--focus-selector \'[data-final-position-floor="explicit-final-submissions"]\'',
  "validate-final-position-evidence.mjs",
]) {
  assert(ci.includes(claim), `CI does not preserve focused Final Position Floor proof: ${claim}`);
}
assert(capture.includes("focusSelector") && capture.includes("scrollIntoView"), "CDP proof capture must support focused product screenshots.");
for (const claim of ["EXPLICIT REVISION RECEIPTS", "no matching revision event", "data-final-seat-shift-warning", "data-final-position-unexplained"]) {
  assert(focusedValidator.includes(claim), `Focused Final Position Floor validator is missing: ${claim}`);
}

console.log("✓ final position floor derives only from final submissions, preserves execution provenance, and separates explicit revision receipts from unexplained final shifts");

function assert(condition, message) {
  if (!condition) throw new Error(`Final Position Floor check failed: ${message}`);
}
