import fs from "node:fs";

const artifactDir = process.argv[2] ?? "artifacts";
const manifestPath = process.argv[3] ?? "dist-extension/manifest.json";

const pages = {
  sideZh: read("chatchat-consultation-zh.html"),
  sideEn: read("chatchat-consultation-en.html"),
  roomZh: read("chatchat-room-zh.html"),
  roomEn: read("chatchat-room-en.html"),
  liveZh: read("chatchat-live-meeting-zh.html"),
  liveEn: read("chatchat-live-meeting-en.html"),
};
const manifest = fs.readFileSync(manifestPath, "utf8");

for (const [label, html] of [["Chinese Side Panel", pages.sideZh], ["English Side Panel", pages.sideEn]]) {
  requireAll(label, html, [
    'data-chatchat-consultation-showcase="complete"',
    'data-chatchat-live-floor-showcase="complete"',
    'data-chatchat-live-deliberation-showcase="complete"',
    'data-chatchat-deliberation-story-showcase="complete"',
    'data-chatchat-evidence-radar-showcase="complete"',
    'data-chatchat-next-move-showcase="complete"',
    'data-chatchat-proposal-mode-showcase="complete"',
    'data-chatchat-consultation-receipt-showcase="complete"',
    'data-chatchat-investigation-trail-storage-showcase="complete"',
    'data-chatchat-investigation-trail-showcase="complete"',
    'data-chatchat-history-persistence-showcase="complete"',
    'data-chatchat-conflict-board-showcase="complete"',
    'data-chatchat-conflict-resolution-showcase="complete"',
    'data-chatchat-stance-fronts-showcase="complete"',
    'data-chatchat-final-position-floor-showcase="complete"',
    'data-provider-memory-view="live"',
    'data-provider-memory-coverage="audited"',
    'data-provider-memory-evidence="actual_prompt"',
    'data-provider-memory-integrity="verified"',
    'data-provider-memory-consistent="true"',
    'data-provider-memory-selector-consistent="true"',
    'data-provider-memory-gap-state="clear"',
    'data-final-position-floor="explicit-final-submissions"',
    'data-final-position-alignment-match="true"',
    'data-final-position-group-leading="true"',
    'data-final-position-group-leading="false"',
    'data-final-seat-changed="true"',
    'data-final-seat-lineage="explicit-revision"',
    'data-final-seat-execution="verified"',
    'data-stance-front-state="current"',
    'data-stance-front-state="vacated"',
    'data-stance-movement-event=',
    'data-stance-movement-cause=',
    'data-stance-uncommitted="explicit-none"',
  ]);
}
requireAll("Chinese Side Panel", pages.sideZh, [
  "用户发起提案", "平等 AI 参与者", "没有议长", "协商结果", "协商剧场", "明确发生的立场修正", "明示立场战线", "会议最终席位图", "上下文记忆收据", "Claude", "Web + Extension", "Browser Extension",
]);
requireAll("English Side Panel", pages.sideEn, [
  "Propose once", "Equal AI participants", "CONSULTATION OUTCOME", "CONSULTATION THEATER", "Explicit revisions", "Who changed what", "EXPLICIT STANCE FRONTS", "FINAL POSITION FLOOR", "PROVIDER MEMORY COVERAGE", "Claude", "Web + Extension", "Browser Extension",
]);
assert(/no chair/i.test(pages.sideEn), "English Side Panel must preserve no-chair language.");
assert(/no delegation/i.test(pages.sideEn), "English Side Panel must explicitly reject delegation hierarchy.");

for (const [label, html] of [["Chinese Full Room", pages.roomZh], ["English Full Room", pages.roomEn]]) {
  requireAll(label, html, [
    'data-chatchat-room-showcase="complete"',
    'data-chatchat-live-floor-showcase="complete"',
    'data-chatchat-live-deliberation-showcase="complete"',
    'data-chatchat-deliberation-story-showcase="complete"',
    'data-chatchat-evidence-radar-showcase="complete"',
    'data-chatchat-next-move-showcase="complete"',
    'data-chatchat-proposal-mode-showcase="complete"',
    'data-chatchat-consultation-receipt-showcase="complete"',
    'data-chatchat-investigation-trail-storage-showcase="complete"',
    'data-chatchat-investigation-trail-showcase="complete"',
    'data-chatchat-history-persistence-showcase="complete"',
    'data-chatchat-conflict-board-showcase="complete"',
    'data-chatchat-conflict-resolution-showcase="complete"',
    'data-chatchat-stance-fronts-showcase="complete"',
    'data-chatchat-final-position-floor-showcase="complete"',
    'data-provider-memory-view="archive"',
    'data-provider-memory-coverage="audited"',
    'data-provider-memory-evidence="actual_prompt"',
    'data-provider-memory-integrity="verified"',
    'data-provider-memory-consistent="true"',
    'data-provider-memory-selector-consistent="true"',
    'data-provider-memory-gap-state="clear"',
    'data-final-position-floor="explicit-final-submissions"',
    'data-final-position-alignment-match="true"',
    'data-final-position-group-leading="true"',
    'data-final-position-group-leading="false"',
    'data-final-seat-lineage="explicit-revision"',
    'data-meeting-integrity-state="verified"',
    'data-history-execution-audit="loaded"',
  ]);
}
requireAll("Chinese Full Room", pages.roomZh, ["协商记录", "history-entry", "INDEXEDDB · LOCAL", "协商剧场", "AI 关系战场", "明示立场战线", "会议最终席位图", "LOCAL · EXECUTION RECEIPT", "历史回放：只读取冻结的 execution receipt"]);
requireAll("English Full Room", pages.roomEn, ["CONSULTATION HISTORY", "history-entry", "INDEXEDDB · LOCAL", "CONSULTATION THEATER", "RELATIONSHIP MAP", "EXPLICIT STANCE FRONTS", "FINAL POSITION FLOOR", "LOCAL · EXECUTION RECEIPT", "Archive replay: reconstructed only from frozen execution receipts"]);

requireAll("Chinese live meeting frame", pages.liveZh, [
  'data-chatchat-live-proof-showcase="complete"',
  'data-chatchat-live-proof-frame="persuasion"',
  'data-persuasion-strength="strong"',
  'data-persuasion-cause-event=',
  'data-persuasion-action-event=',
  "AI 大会正在发生",
  "实时说服",
  "观点正在移动",
]);
requireAll("English live meeting frame", pages.liveEn, [
  'data-chatchat-live-proof-showcase="complete"',
  'data-chatchat-live-proof-frame="persuasion"',
  'data-persuasion-strength="strong"',
  'data-persuasion-cause-event=',
  'data-persuasion-action-event=',
  "The AI assembly is happening now",
  "LIVE PERSUASION",
  "Positions are moving",
]);

for (const [label, html] of Object.entries({ sideZh: pages.sideZh, sideEn: pages.sideEn, roomZh: pages.roomZh, roomEn: pages.roomEn })) {
  for (const forbidden of ["KING'S COMMAND", "AI HOUSE", "HOUSE VERDICT", "众议院", "COUNCIL THEATER", "议会剧场"]) {
    assert(!html.includes(forbidden), `${label} contains forbidden legacy product language: ${forbidden}`);
  }
  assert(!/\bAI delegation\b|\bdelegation leader\b|\bdelegation chair\b/i.test(html), `${label} contains affirmative delegation hierarchy language.`);
}

requireAll("manifest", manifest, ["ChatChat — AI Consultation", "optional_host_permissions"]);
assert(!manifest.includes("AI Council"), "Manifest must not regress to AI Council product language.");
assert(!manifest.includes("Parliament"), "Manifest must not regress to Parliament product language.");
assert(fs.existsSync("dist-extension/app/app.html"), "Full Room build output is missing.");

console.log("✓ bilingual Chromium DOM evidence preserves consultation, conflict, stance-front, final-position, execution-integrity, Provider-memory and frozen-history contracts");

function read(name) {
  const path = `${artifactDir}/${name}`;
  assert(fs.existsSync(path), `Missing product evidence file: ${path}`);
  return fs.readFileSync(path, "utf8");
}

function requireAll(label, value, needles) {
  for (const needle of needles) assert(value.includes(needle), `${label} is missing required evidence: ${needle}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(`Product evidence validation failed: ${message}`);
}
