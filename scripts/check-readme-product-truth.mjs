import fs from "node:fs";

const readmeEn = fs.readFileSync("README.md", "utf8");
const readmeZh = fs.readFileSync("README.zh-CN.md", "utf8");
const demoArt = fs.readFileSync("assets/readme/demo-overview.svg", "utf8");
const terminalDemo = fs.readFileSync("src/demo.ts", "utf8");
const mockCouncil = fs.readFileSync("src/providers/mock-council.ts", "utf8");
const formatter = fs.readFileSync("src/core/format.ts", "utf8");
const browserGuard = fs.readFileSync("extension-public/live-deliberation-showcase-guard.js", "utf8");
const liveFrameProof = fs.readFileSync("extension-public/live-meeting-frame-showcase.js", "utf8");
const ciWorkflow = fs.readFileSync(".github/workflows/ci.yml", "utf8");
const chromiumCapture = fs.readFileSync("scripts/capture-chromium-proof.mjs", "utf8");
const pngContentCheck = fs.readFileSync("scripts/check-png-content.mjs", "utf8");

const productionFiles = [
  "src/extension/components/LiveAgenda.tsx",
  "src/extension/components/OpenIssuesRadar.tsx",
  "src/extension/components/PeerExchangeQueue.tsx",
  "src/extension/components/LiveResearchDesk.tsx",
  "src/extension/components/LiveDiscussionStream.tsx",
  "src/extension/components/LivePersuasionPulse.tsx",
  "src/extension/components/RelationshipMap.tsx",
  "src/extension/execution-provenance.tsx",
  "src/consultation/open-issues.ts",
  "src/consultation/structured-response.ts",
  "src/consultation/reply-provenance.ts",
  "src/theater/live-persuasion.ts",
];

for (const file of productionFiles) {
  assert(fs.existsSync(file) && fs.statSync(file).size > 0, `README claim has no production implementation: ${file}`);
}

for (const claim of [
  "Live Agenda",
  "Open Issues",
  "Peer Exchange Queue",
  "Live Research Desk",
  "Live Persuasion",
  "replyToEventId",
  "Meeting Secretariat",
  "LIVE PROVIDER RECEIPTS",
  "DEMO · SYNTHETIC",
  "Real Chromium is not the same thing as real Provider inference",
  "docs/MEETING_SECRETARIAT.md",
  "scripts/check-execution-boundary.mjs",
]) {
  assert(readmeEn.includes(claim), `English README is missing real product/evidence capability: ${claim}`);
}

for (const claim of [
  "Live Agenda",
  "Open Issues",
  "Peer Exchange Queue",
  "Live Research Desk",
  "Live Persuasion",
  "replyToEventId",
  "大会秘书处",
  "LIVE PROVIDER RECEIPTS",
  "DEMO · SYNTHETIC",
  "真实 Chromium 不等于真实 Provider 推理",
  "docs/MEETING_SECRETARIAT.zh-CN.md",
  "scripts/check-execution-boundary.mjs",
]) {
  assert(readmeZh.includes(claim), `Chinese README is missing real product/evidence capability: ${claim}`);
}

for (const claim of [
  "LIVE RESEARCH",
  "LIVE AGENDA",
  "OPEN ISSUES",
  "PEER EXCHANGE",
  "DIRECT REPLY",
  "LIVE PERSUASION",
  "EXPLICIT REVISION",
  "REAL PRODUCT PROOF",
]) {
  assert(demoArt.includes(claim), `README demo no longer mirrors the real meeting: ${claim}`);
}

for (const claim of [
  "deriveOpenMeetingIssues",
  "deriveLivePersuasionMoments",
  "consultationResearchLaneAssignments",
  "LIVE RESEARCH DESK",
  "LIVE AGENDA",
  "LIVE PERSUASION",
  "OPEN ISSUES AT CLOSE",
]) {
  assert(terminalDemo.includes(claim), `npm run demo is missing current consultation behavior: ${claim}`);
}

assert(mockCouncil.includes("replyToEventId"), "Mock consultation must contain one explicit direct peer reply.");
assert(mockCouncil.includes("targetActorId"), "Mock consultation must contain a direct peer question.");
assert(mockCouncil.includes('kind: "evidence"'), "Mock consultation must put structured evidence on the public board.");
assert(mockCouncil.includes('kind: "revision"'), "Mock consultation must contain an explicit revision.");
assert(mockCouncil.includes("causedBy"), "Mock revision must preserve exact persuasion causes.");
assert(formatter.includes("CONSULTATION OUTCOME") && formatter.includes("Leading position"), "Terminal report must use consultation outcome semantics.");

for (const proof of [
  'data-chatchat-live-deliberation-showcase',
  'data-chatchat-meeting-secretariat-showcase',
  'data-chatchat-live-persuasion-showcase',
  'data-chatchat-execution-boundary-showcase',
  '[data-peer-stage="queued"]',
  '[data-peer-stage="responding"]',
  '[data-peer-stage="answered"]',
  '[data-reply-to-event]',
  '[data-persuasion-strength="strong"][data-persuasion-cause-event][data-persuasion-action-event]',
  '.live-research-desk',
  '.relationship-edge.edge-reply',
]) {
  assert(browserGuard.includes(proof), `README capability is not covered by the Chromium UI/protocol proof: ${proof}`);
}

for (const proof of [
  'proofMode !== "persuasion" && proofMode !== "response"',
  'mode: "persuasion"',
  'data-chatchat-live-proof-showcase',
  'data-chatchat-live-proof-frame',
  'data-persuasion-strength="strong"',
  "actual Live Floor",
]) {
  assert(liveFrameProof.includes(proof), `Live-frame Chromium demo proof is missing: ${proof}`);
}

for (const artifact of [
  "chatchat-live-meeting-zh.png",
  "chatchat-live-meeting-en.png",
  "Capture bilingual live persuasion frame from the proved DOM",
  "scripts/capture-chromium-proof.mjs",
  "scripts/check-png-content.mjs",
  "Reject blank or visually empty screenshots",
]) {
  assert(ciWorkflow.includes(artifact), `CI no longer captures content-validated Chromium live meeting evidence: ${artifact}`);
}
for (const proof of ["Page.captureScreenshot", "requestAnimationFrame", "readySelector", "document.documentElement.outerHTML"]) {
  assert(chromiumCapture.includes(proof), `Chromium proof capture no longer waits for and freezes the proved DOM: ${proof}`);
}
for (const proof of ["uniqueSampledColors", "channelRange", "lumaStdDev", "zlib.inflateSync"]) {
  assert(pngContentCheck.includes(proof), `Chromium screenshot proof no longer rejects visually blank PNGs: ${proof}`);
}

for (const source of [readmeEn, readmeZh]) {
  assert(!/chair AI decides|议长 AI 决定|majority becomes authority|多数意见成为权威/i.test(source), "README must not introduce hierarchical meeting semantics.");
}
for (const [label, source] of [["terminal demo", terminalDemo], ["mock consultation", mockCouncil], ["formatter", formatter]]) {
  assert(!/👑|\bking\b|king's|royal|\bverdict\b/i.test(source), `${label} still contains legacy hierarchical product language.`);
}

assert(
  !/showcase[^\n]{0,120}(real provider inference|真实 Provider 推理)/i.test(readmeEn + "\n" + readmeZh),
  "README must not present synthetic showcase speech as live third-party Provider inference.",
);

console.log("✓ README separates live Provider execution from synthetic Chromium UI/protocol evidence and requires nonblank proved-DOM screenshots");

function assert(condition, message) {
  if (!condition) throw new Error(`README product-truth check failed: ${message}`);
}
