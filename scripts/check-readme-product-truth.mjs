import fs from "node:fs";

const readmeEn = fs.readFileSync("README.md", "utf8");
const readmeZh = fs.readFileSync("README.zh-CN.md", "utf8");
const demo = fs.readFileSync("assets/readme/demo-overview.svg", "utf8");
const browserGuard = fs.readFileSync("extension-public/live-deliberation-showcase-guard.js", "utf8");

const productionFiles = [
  "src/extension/components/LiveAgenda.tsx",
  "src/extension/components/OpenIssuesRadar.tsx",
  "src/extension/components/PeerExchangeQueue.tsx",
  "src/extension/components/LiveResearchDesk.tsx",
  "src/extension/components/LiveDiscussionStream.tsx",
  "src/extension/components/RelationshipMap.tsx",
  "src/consultation/open-issues.ts",
  "src/consultation/structured-response.ts",
  "src/consultation/reply-provenance.ts",
];

for (const file of productionFiles) {
  assert(fs.existsSync(file) && fs.statSync(file).size > 0, `README claim has no production implementation: ${file}`);
}

for (const claim of [
  "Live Agenda",
  "Open Issues",
  "Peer Exchange Queue",
  "Live Research Desk",
  "replyToEventId",
  "Meeting Secretariat",
  "docs/MEETING_SECRETARIAT.md",
]) {
  assert(readmeEn.includes(claim), `English README is missing real product capability: ${claim}`);
}

for (const claim of [
  "Live Agenda",
  "Open Issues",
  "Peer Exchange Queue",
  "Live Research Desk",
  "replyToEventId",
  "大会秘书处",
  "docs/MEETING_SECRETARIAT.zh-CN.md",
]) {
  assert(readmeZh.includes(claim), `Chinese README is missing real product capability: ${claim}`);
}

for (const claim of [
  "LIVE RESEARCH",
  "LIVE AGENDA",
  "OPEN ISSUES",
  "PEER EXCHANGE",
  "DIRECT REPLY",
  "EXPLICIT REVISION",
]) {
  assert(demo.includes(claim), `README demo no longer mirrors the real meeting: ${claim}`);
}

for (const proof of [
  'data-chatchat-live-deliberation-showcase',
  'data-chatchat-meeting-secretariat-showcase',
  '[data-peer-stage="queued"]',
  '[data-peer-stage="responding"]',
  '[data-peer-stage="answered"]',
  '[data-reply-to-event]',
  '.live-research-desk',
  '.relationship-edge.edge-reply',
]) {
  assert(browserGuard.includes(proof), `README capability is not covered by the real Chromium proof: ${proof}`);
}

for (const source of [readmeEn, readmeZh]) {
  assert(!/chair AI decides|议长 AI 决定|majority becomes authority|多数意见成为权威/i.test(source), "README must not introduce hierarchical meeting semantics.");
}

console.log("✓ README claims map to production implementation and Chromium meeting proof");

function assert(condition, message) {
  if (!condition) throw new Error(`README product-truth check failed: ${message}`);
}
