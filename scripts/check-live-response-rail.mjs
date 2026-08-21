import { readFile } from "node:fs/promises";

const [rail, floor, peerModel, runner, workflow, liveFrame] = await Promise.all([
  readFile("src/extension/components/LiveResponseRail.tsx", "utf8"),
  readFile("src/extension/components/LiveParticipantFloor.tsx", "utf8"),
  readFile("src/theater/peer-exchange.ts", "utf8"),
  readFile("scripts/run-test-suite.mjs", "utf8"),
  readFile(".github/workflows/council-stage-ui.yml", "utf8"),
  readFile("extension-public/live-meeting-frame-showcase.js", "utf8"),
]);

for (const text of [
  "buildPeerExchangeModel(participants, events, activities, phase)",
  "const item = model.items[0]",
  'data-live-response-rail="canonical-peer-exchange"',
  "data-live-response-state",
  "data-live-response-request-event",
  "data-live-response-target-actor",
  "data-live-response-pending-count",
  "data-live-response-responding-count",
  "data-live-response-answered-count",
  "Response duty ≠ agreement duty",
  "回应义务 ≠ 同意义务",
]) requireText(rail, text, "canonical live response rail");

for (const forbidden of [
  "deriveDirectResponseReceipts",
  "findMeetingIssueResolver",
  "explicitlyAnswersRequest",
  "consensusRatio",
  "convergenceThreshold",
  "persuasionScore",
  "winnerActorId",
  "semanticSimilarity",
]) {
  if (rail.includes(forbidden)) fail(`Live response rail must not create its own response truth: ${forbidden}`);
}

const roundIndex = floor.indexOf("<RoundRail");
const responseIndex = floor.indexOf("<LiveResponseRail");
const gridIndex = floor.indexOf('<div className="live-participant-grid">');
if (!(roundIndex >= 0 && responseIndex > roundIndex && gridIndex > responseIndex)) {
  fail("Live response rail must stay between the round rail and the live AI seat grid.");
}
requireText(floor, 'import { LiveResponseRail } from "./LiveResponseRail.js"', "Live Floor response rail import");
requireText(floor, "<PeerExchangeQueue", "full detailed Peer Exchange remains available");

for (const text of [
  "deriveDirectResponseReceipts(events)",
  'stateRank(a.state) - stateRank(b.state)',
  'state === "responding" ? 0 : state === "queued" ? 1',
]) requireText(peerModel, text, "canonical Peer Exchange priority/receipt truth");

requireText(runner, '"dist/tests/peer-exchange.test.js"', "canonical Peer Exchange deterministic test");

for (const text of [
  'proofMode !== "persuasion" && proofMode !== "response"',
  'proofMode === "response" ? captureResponse() : capturePersuasion()',
  'data-live-response-state="responding"',
  'data-live-response-state="queued"',
  "const QUEUED_FALLBACK_MS = 900",
  'mode: "response"',
  "liveResponseRequestEvent",
  "liveResponseTargetActor",
  "One AI is waiting on another",
  "点名答辩正在发生",
]) requireText(liveFrame, text, "real debate response-frame proof");
requireText(liveFrame, 'mode: "persuasion"', "existing persuasion frame remains intact");
if (liveFrame.includes('liveResponseState: "responding"') || liveFrame.includes('liveResponseState: "queued"')) {
  fail("Response proof must copy the real rail state rather than hardcoding a proof state.");
}

for (const text of [
  "Capture bilingual live response rail",
  'live-proof=response',
  'data-chatchat-live-proof-frame="response"',
  'data-live-response-rail="canonical-peer-exchange"',
  'data-live-response-state="(responding|queued)"',
  "Validate live response rail provenance",
]) requireText(workflow, text, "production Chromium live response rail proof");
if (workflow.includes('chatchat-live-response-rail-$LANG') && workflow.includes('live-proof=persuasion"')) {
  fail("The dedicated live response rail screenshot must not use the late persuasion/final snapshot.");
}

console.log("✓ Live Response Rail is a compact projection of canonical Peer Exchange state");
console.log("✓ Rail stays above AI seats while the detailed Peer Exchange queue remains intact");
console.log("✓ Chromium freezes a real responding/queued debate route, not the later final snapshot");
console.log("✓ No majority, persuasion, prose-similarity or duplicate closure logic can drive the rail");

function requireText(haystack, needle, label) {
  if (!haystack.includes(needle)) fail(`Missing ${label}: ${needle}`);
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}
