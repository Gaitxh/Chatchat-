import fs from "node:fs";

const readmeEn = fs.readFileSync("README.md", "utf8");
const readmeZh = fs.readFileSync("README.zh-CN.md", "utf8");
const demoArt = fs.readFileSync("assets/readme/demo-overview.svg", "utf8");
const terminalDemo = fs.readFileSync("src/demo.ts", "utf8");
const mockCouncil = fs.readFileSync("src/providers/mock-council.ts", "utf8");
const formatter = fs.readFileSync("src/core/format.ts", "utf8");
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
  assert(demoArt.includes(claim), `README demo no longer mirrors the real meeting: ${claim}`);
}

for (const claim of [
  "deriveOpenMeetingIssues",
  "consultationResearchLaneAssignments",
  "LIVE RESEARCH DESK",
  "LIVE AGENDA",
  "OPEN ISSUES AT CLOSE",
]) {
  assert(terminalDemo.includes(claim), `npm run demo is missing current consultation behavior: ${claim}`);
}
assert(mockCouncil.includes("replyToEventId"), "Mock consultation must contain one explicit direct peer reply.");
assert(mockCouncil.includes("targetActorId"), "Mock consultation must contain a direct peer question.");
assert(mockCouncil.includes('kind: "evidence"'), "Mock consultation must put structured evidence on the public board.");
assert(mockCouncil.includes('kind: "revision"'), "Mock consultation must contain an explicit revision.");
assert(formatter.includes("CONSULTATION OUTCOME") && formatter.includes("Leading position"), "Terminal report must use consultation outcome semantics.");

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
for (const [label, source] of [["terminal demo", terminalDemo], ["mock consultation", mockCouncil], ["formatter", formatter]]) {
  assert(!/👑|\bking\b|king's|royal|\bverdict\b/i.test(source), `${label} still contains legacy hierarchical product language.`);
}

console.log("✓ README and demos map to production implementation and Chromium meeting proof");

function assert(condition, message) {
  if (!condition) throw new Error(`README product-truth check failed: ${message}`);
}
