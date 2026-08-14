import fs from "node:fs";

const model = fs.readFileSync("src/theater/conflict-board.ts", "utf8");
const component = fs.readFileSync("src/extension/components/ConflictBoard.tsx", "utf8");
const portal = fs.readFileSync("src/extension/conflict-board-portal.tsx", "utf8");
const app = fs.readFileSync("app/app.html", "utf8");
const sidepanel = fs.readFileSync("extension/sidepanel.html", "utf8");
const guard = fs.readFileSync("extension-public/live-deliberation-showcase-guard.js", "utf8");

for (const claim of [
  "deriveOpenMeetingIssues",
  "structuralParent(event)",
  "event.targetEventId",
  "event.replyToEventId",
  "event.previousEventId",
  "event.causedBy",
  "externalInfluences",
  '"position_changed"',
  '"answered"',
  '"open"',
]) {
  assert(model.includes(claim), `Conflict thread model is missing structural provenance: ${claim}`);
}
assert(!model.includes("cosineSimilarity"), "Conflict Board must not cluster event prose by semantic similarity.");
assert(!model.includes("embedding"), "Conflict Board must not require embeddings to invent issue threads.");

for (const claim of [
  'data-conflict-board="event-provenance"',
  "data-conflict-thread",
  "data-conflict-anchor-event",
  "data-conflict-status",
  "data-conflict-movement",
  "data-conflict-movement-count",
  "data-conflict-count-kind",
  "data-conflict-open-event",
  "data-conflict-external-cause",
  "不会用文本相似度",
  "No prose clustering",
]) {
  assert(component.includes(claim), `Conflict Board UI is missing: ${claim}`);
}

for (const claim of [
  'const LIVE_EVENT = "chatchat:consultation-live"',
  'const COMPLETE_EVENT = "chatchat:consultation-complete"',
  'const OPEN_ARCHIVE_EVENT = "chatchat:consultation-open-archive"',
  "focusConsultationEvent",
  "compact={view.live}",
  "archive={view.archive}",
]) {
  assert(portal.includes(claim), `Conflict Board portal lost a read-only event source: ${claim}`);
}

for (const [label, html] of [["Full Room", app], ["Side Panel", sidepanel]]) {
  assert(html.includes('id="conflict-board-root"'), `${label} must mount the Conflict Board root.`);
  assert(html.includes('/src/extension/conflict-board-portal.tsx'), `${label} must load the Conflict Board portal.`);
  assert(
    html.indexOf('/src/extension/conflict-board-portal.tsx') < html.indexOf('/src/extension/consultation-panel.tsx'),
    `${label} must subscribe the Conflict Board before consultation events can start.`,
  );
}

for (const claim of [
  "data-chatchat-conflict-board-showcase",
  'data-conflict-movement="revision"',
  'data-conflict-count-kind="challenge"',
  'data-conflict-count-kind="evidence"',
  'data-conflict-count-kind="revision"',
  'data-conflict-status="open"',
  "data-conflict-open-event",
  "Movement and",
  "sawConflictChange",
  "sawOpenConflict",
]) {
  assert(guard.includes(claim), `Chromium live proof no longer enforces Conflict Board semantics: ${claim}`);
}

console.log("✓ Conflict Board is event-anchored, preserves simultaneous movement/open issues, and is required by Chromium proof");

function assert(condition, message) {
  if (!condition) throw new Error(`Conflict Board check failed: ${message}`);
}
