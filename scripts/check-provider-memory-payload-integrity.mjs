import fs from "node:fs";

const promptAudit = fs.readFileSync("src/provider-sdk/prompt-memory-audit.ts", "utf8");
const transport = fs.readFileSync("src/provider-sdk/transport-audit.ts", "utf8");
const model = fs.readFileSync("src/theater/provider-memory-payload-integrity.ts", "utf8");
const ui = fs.readFileSync("src/extension/components/ProviderMemoryPayloadIntegrity.tsx", "utf8");
const portal = fs.readFileSync("src/extension/provider-memory-portal.tsx", "utf8");
const fixture = fs.readFileSync("extension-public/provider-payload-repair-showcase.js", "utf8");
const guard = fs.readFileSync("extension-public/provider-payload-repair-showcase-guard.js", "utf8");
const historyGuard = fs.readFileSync("extension-public/history-persistence-showcase-guard.js", "utf8");
const validator = fs.readFileSync("scripts/validate-provider-payload-evidence.mjs", "utf8");
const productValidator = fs.readFileSync("scripts/validate-product-evidence.mjs", "utf8");
const test = fs.readFileSync("tests/provider-memory-payload-integrity.test.ts", "utf8");
const historyTest = fs.readFileSync("tests/execution-audit-history.test.ts", "utf8");
const docEn = fs.readFileSync("docs/PUBLIC_MEMORY_PAYLOAD_INTEGRITY.md", "utf8");
const docZh = fs.readFileSync("docs/PUBLIC_MEMORY_PAYLOAD_INTEGRITY.zh-CN.md", "utf8");

for (const claim of [
  "CONSULTATION_EVENTS_JSON",
  "publicPayloadFingerprint",
  "publicPayloadEventCount",
  "parseJsonRawLine",
  "publicPayloadRaw",
  "equalityFingerprint(publicPayloadRaw)",
  "TextEncoder",
  "BigInt.asUintN(64",
  "eq64:",
  "not a security primitive",
]) assert(promptAudit.includes(claim), `Actual Prompt payload audit is missing ${claim}.`);
assert(!promptAudit.includes("eq32:"), "Public payload equality receipts must not regress to the retired 32-bit format.");
assert(!/equalityFingerprint\(JSON\.stringify\(publicPayload\)\)/.test(promptAudit), "Exact Prompt payload receipts must not normalize the parsed payload before fingerprinting.");
assert(/\[ \\\\t\]\*\(\[\^\\\\r\\\\n\]\+\)/.test(promptAudit) || promptAudit.includes('[ \\t]*([^\\r\\n]+)'), "Raw protocol line parsing must stay on one physical Prompt line rather than crossing into another field.");
assert(/0xcbf29ce484222325n/.test(promptAudit) && /0x100000001b3n/.test(promptAudit), "eq64 must remain the documented 64-bit FNV-1a equality aid over UTF-8 bytes.");

for (const claim of [
  "publicPayloadFingerprint?: string",
  "publicPayloadEventCount?: number",
  "promptSelection.publicPayloadFingerprint",
  "not a cryptographic signature or truth proof",
]) assert(transport.includes(claim), `Transport payload receipt is missing ${claim}.`);

for (const claim of [
  '"verified"',
  '"peer_payload_drift"',
  '"repair_deck_drift"',
  '"payload_unverified"',
  '"not_used"',
  '"matched"',
  '"drift"',
  "payloadReceipts.length <= 1",
  "repairPayloadMatched",
  "repairSelectionMatched",
  "repairPayloadDriftSeatCount",
  "repairSelectionDriftSeatCount",
  "repairPayloadDriftTurnCount",
  "repairSelectionDriftTurnCount",
  "unverifiedSeatCount",
  "unverifiedTurnCount",
  "isConsultationTurnRecord",
  "selectionFingerprint",
  "record.pinnedIssueSourceEventIds",
  "record.latestRoundEventIds",
  "Missing evidence is `payload_unverified`",
  "Fingerprints are equality aids only",
]) assert(model.includes(claim), `Public payload integrity model is missing semantic contract: ${claim}.`);
assert(
  /turnKeys\s*=\s*unique\(sessionRecords[\s\S]{0,180}filter\(isConsultationTurnRecord\)/.test(model),
  "Payload integrity denominator must come from all formal consultation transport turns, not only promptMemoryObserved=true records.",
);
assert(
  !/turnKeys\s*=\s*unique\(sessionRecords[\s\S]{0,180}promptMemoryObserved\s*===\s*true/.test(model),
  "A missing Prompt observer may not delete a real Provider turn from payload-integrity accounting.",
);
assert(
  /payloadsConsistent\s*:\s*complete\s*\?\s*payloadReceipts\.length\s*<=\s*1\s*:\s*null/.test(model),
  "Incomplete historical/prompt payload receipts must remain unknown (null), while complete same-round receipts compare exact serialized payload receipt equality.",
);
assert(
  /unverifiedTurnCount\s*>\s*0[\s\S]{0,120}payload_unverified/.test(model),
  "Any real consultation turn missing a complete payload receipt must prevent a verified aggregate state.",
);
assert(
  /repairDeckState[\s\S]{0,420}repairPayloadMatched[\s\S]{0,260}repairSelectionMatched/.test(model),
  "Repair verification must require both exact serialized public payload equality and selection-provenance equality.",
);
assert(
  /pinnedOpenIssueEventIds[\s\S]{0,220}pinnedIssueSourceEventIds[\s\S]{0,220}latestRoundEventIds/.test(model),
  "Repair selection parity must include pinned events, exact pin-source provenance, and newest-round protection metadata.",
);

for (const claim of [
  "PUBLIC PAYLOAD INTEGRITY",
  "data-provider-payload-integrity",
  "data-provider-payload-consistent",
  "data-provider-payload-receipt-count",
  "data-provider-payload-unverified-turns",
  "data-provider-payload-unverified-seats",
  "data-provider-repair-matched-seats",
  "data-provider-repair-payload-drift-seats",
  "data-provider-repair-selection-drift-seats",
  "data-provider-payload-repair-payload-drift",
  "data-provider-payload-repair-selection-drift",
  "EXACT PUBLIC PAYLOAD MATCH",
  "repair contexts fully matched",
  "selection provenance drift",
  "remains in the denominator",
  "eq64",
  "64-bit non-cryptographic equality aid",
]) assert(ui.includes(claim), `Public payload integrity UI is missing ${claim}.`);
assert(!ui.includes("eq32"), "Public payload UI must not describe the retired 32-bit equality aid.");

for (const claim of [
  "deriveProviderPublicPayloadIntegrity",
  "ProviderMemoryPayloadIntegrity",
]) assert(portal.includes(claim), `Provider Memory portal is missing payload-integrity wiring: ${claim}.`);

for (const claim of [
  'payload-proof") !== "repair"',
  "corrupted = false",
  "REPAIR ATTEMPT",
  "invalid structured consultation response",
]) assert(fixture.includes(claim), `Repair-deck browser fixture is missing ${claim}.`);

for (const claim of [
  'data-provider-payload-integrity="verified"',
  'data-provider-payload-round="2"',
  "data-provider-payload-unverified-turns",
  "data-provider-payload-unverified-seats",
  "data-provider-payload-receipt-count",
  "data-provider-repair-matched-seats",
  "data-provider-repair-payload-drift-seats",
  "data-provider-repair-selection-drift-seats",
  "chatchatProviderPayloadRepairShowcase",
  'data-attendance-turn-state="repaired"',
]) assert(guard.includes(claim), `Repair-deck browser guard is missing ${claim}.`);

for (const claim of [
  "data-provider-payload-repair-payload-drift",
  "data-provider-payload-repair-selection-drift",
  "data-provider-payload-unverified-turns",
  "data-provider-payload-unverified-seats",
  "data-provider-payload-receipt-count",
  "repair must not change exact serialized public payload",
  "repair must not change snapshot/pinned/source/latest provenance",
]) assert(validator.includes(claim), `Payload browser evidence validator is missing ${claim}.`);

for (const claim of [
  "chatchatProviderPayloadHistoryReplayShowcase",
  'data-provider-payload-view="archive"',
  "data-provider-payload-unverified-turns",
  "Historical Provider Payload Integrity",
  "not-applicable",
]) assert(historyGuard.includes(claim), `Frozen payload-history replay contract is missing ${claim}.`);
for (const claim of [
  'data-chatchat-provider-payload-history-replay-showcase="not-applicable"',
  'data-chatchat-provider-payload-history-replay-showcase="complete"',
  'data-provider-payload-view="live"',
  'data-provider-payload-view="archive"',
  'data-provider-payload-unverified-turns="0"',
]) assert(productValidator.includes(claim), `Ordinary Chromium product evidence is missing payload-history contract: ${claim}.`);

for (const claim of [
  "eq64:",
  "Same IDs with different serialized public content",
  "Semantically equal but differently serialized public JSON",
  "peer_payload_drift",
  "repair_deck_drift",
  "repairSelectionMatched",
  "payload_unverified",
  "Fingerprint without exact payload event count",
  "Missing Prompt observer evidence",
  "remain in the denominator",
  "never verified 2/2",
  "no repair",
]) assert(test.toLowerCase().includes(claim.toLowerCase()), `Payload integrity test is missing ${claim}.`);
assert(!test.includes('startsWith("eq32:")'), "Payload integrity test must require the 64-bit receipt format.");
for (const claim of ["eq64:0123456789abcdef", "64-bit public-payload equality receipt"]) {
  assert(historyTest.includes(claim), `Durable history test is missing ${claim}.`);
}
assert(!historyTest.includes("eq32:"), "Durable history fixture must not retain the retired 32-bit receipt format.");

for (const doc of [docEn, docZh]) {
  assert(/raw serialized|原始序列化/.test(doc), "Payload integrity docs must state that equality is taken from raw serialized Prompt content.");
  assert(/eq64/.test(doc) && /64-bit/.test(doc), "Payload integrity docs must state the 64-bit equality-aid format.");
  assert(/UTF-8/.test(doc), "Payload integrity docs must state the raw serialized text is fingerprinted as UTF-8 bytes.");
  assert(/not.*cryptographic|不是密码学/.test(doc), "Payload integrity docs must reject cryptographic/signature overclaiming.");
  assert(/selection provenance|selection-provenance/i.test(doc), "Payload integrity docs must explain repair selection-provenance invariance.");
  assert(/repair/i.test(doc), "Payload integrity docs must explain repair context invariance.");
  assert(/denominator|分母/.test(doc), "Payload integrity docs must say missing Prompt receipts remain in the denominator.");
  assert(/history|历史/.test(doc), "Payload integrity docs must explain frozen historical replay rather than post-hoc reconstruction.");
  assert(/correctness|正确性/.test(doc), "Payload integrity docs must stay separate from answer correctness.");
  assert(!/eq32/.test(doc), "Payload integrity docs must not retain the retired 32-bit label.");
}

console.log("✓ 64-bit exact serialized payload parity keeps every transport-observed Provider turn in the denominator, preserves full repair context, and replays from frozen receipts");

function assert(condition, message) {
  if (!condition) throw new Error(`Provider memory payload integrity check failed: ${message}`);
}
