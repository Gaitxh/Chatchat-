import fs from "node:fs";

const promptAudit = fs.readFileSync("src/provider-sdk/prompt-memory-audit.ts", "utf8");
const transport = fs.readFileSync("src/provider-sdk/transport-audit.ts", "utf8");
const model = fs.readFileSync("src/theater/provider-memory-payload-integrity.ts", "utf8");
const ui = fs.readFileSync("src/extension/components/ProviderMemoryPayloadIntegrity.tsx", "utf8");
const portal = fs.readFileSync("src/extension/provider-memory-portal.tsx", "utf8");
const fixture = fs.readFileSync("extension-public/provider-payload-repair-showcase.js", "utf8");
const guard = fs.readFileSync("extension-public/provider-payload-repair-showcase-guard.js", "utf8");
const validator = fs.readFileSync("scripts/validate-provider-payload-evidence.mjs", "utf8");
const test = fs.readFileSync("tests/provider-memory-payload-integrity.test.ts", "utf8");
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
  "not a security primitive",
  "eq64:",
]) assert(promptAudit.includes(claim), `Actual Prompt payload audit is missing ${claim}.`);
assert(!promptAudit.includes("eq32:"), "Prompt payload implementation must not regress to stale eq32 product truth.");
assert(!/equalityFingerprint\(JSON\.stringify\(publicPayload\)\)/.test(promptAudit), "Exact Prompt payload receipts must not normalize parsed payload before fingerprinting.");
assert(promptAudit.includes('[ \\t]*([^\\r\\n]+)'), "Raw protocol line parsing must stay on one physical Prompt line rather than crossing into another field.");

for (const claim of [
  "publicPayloadFingerprint?: string",
  "publicPayloadEventCount?: number",
  "promptSelection.publicPayloadFingerprint",
  "not a cryptographic signature or truth proof",
]) assert(transport.includes(claim), `Transport payload receipt is missing ${claim}.`);

for (const claim of [
  '"verified"', '"peer_payload_drift"', '"repair_deck_drift"', '"payload_unverified"',
  '"not_used"', '"matched"', '"drift"',
  "payloadReceipts.length <= 1", "repairPayloadMatched", "repairSelectionMatched",
  "repairPayloadDriftSeatCount", "repairSelectionDriftSeatCount",
  "repairPayloadDriftTurnCount", "repairSelectionDriftTurnCount",
  "unverifiedSeatCount", "unverifiedTurnCount", "isConsultationTurnRecord",
  "selectionFingerprint", "record.pinnedIssueSourceEventIds", "record.latestRoundEventIds",
  "Missing evidence is `payload_unverified`", "Fingerprints are equality aids only",
]) assert(model.includes(claim), `Public payload integrity model is missing semantic contract: ${claim}.`);
assert(/turnKeys\s*=\s*unique\(sessionRecords[\s\S]{0,180}filter\(isConsultationTurnRecord\)/.test(model), "Payload denominator must come from all formal consultation transport turns.");
assert(!/turnKeys\s*=\s*unique\(sessionRecords[\s\S]{0,180}promptMemoryObserved\s*===\s*true/.test(model), "Missing Prompt observer may not delete a real Provider turn from accounting.");
assert(/payloadsConsistent\s*:\s*complete\s*\?\s*payloadReceipts\.length\s*<=\s*1\s*:\s*null/.test(model), "Incomplete payload receipts must remain unknown while complete same-round receipts compare exact payload equality.");
assert(/unverifiedTurnCount\s*>\s*0[\s\S]{0,120}payload_unverified/.test(model), "Any real turn missing a complete payload receipt must prevent a verified aggregate state.");
assert(/repairDeckState[\s\S]{0,420}repairPayloadMatched[\s\S]{0,260}repairSelectionMatched/.test(model), "Repair verification must require payload equality and selection-provenance equality.");

for (const claim of [
  "PUBLIC PAYLOAD INTEGRITY", "data-provider-payload-integrity", "data-provider-payload-consistent",
  "data-provider-payload-receipt-count", "data-provider-payload-unverified-turns", "data-provider-payload-unverified-seats",
  "data-provider-repair-matched-seats", "data-provider-repair-payload-drift-seats", "data-provider-repair-selection-drift-seats",
  "data-provider-payload-repair-payload-drift", "data-provider-payload-repair-selection-drift",
  "EXACT PUBLIC PAYLOAD MATCH", "repair contexts fully matched", "selection provenance drift",
  "remains in the denominator", "eq64", "not a cryptographic signature",
]) assert(ui.includes(claim), `Public payload integrity UI is missing ${claim}.`);
assert(!ui.includes("eq32"), "Payload UI must not expose stale eq32 wording after eq64 implementation upgrade.");

for (const claim of ["deriveProviderPublicPayloadIntegrity", "ProviderMemoryPayloadIntegrity"]) assert(portal.includes(claim), `Provider Memory portal is missing payload-integrity wiring: ${claim}.`);
for (const claim of ['payload-proof") !== "repair"', "corrupted = false", "REPAIR ATTEMPT", "invalid structured consultation response"]) assert(fixture.includes(claim), `Repair browser fixture is missing ${claim}.`);
for (const claim of ['data-provider-payload-integrity="verified"', 'data-provider-payload-round="2"', "data-provider-payload-receipt-count", "data-provider-repair-matched-seats", "data-provider-repair-payload-drift-seats", "data-provider-repair-selection-drift-seats", "chatchatProviderPayloadRepairShowcase", 'data-attendance-turn-state="repaired"']) assert(guard.includes(claim), `Repair browser guard is missing ${claim}.`);
for (const claim of ["data-provider-payload-repair-payload-drift", "data-provider-payload-repair-selection-drift", "data-provider-payload-receipt-count", "repair must not change exact serialized public payload", "repair must not change snapshot/pinned/source/latest provenance"]) assert(validator.includes(claim), `Payload browser validator is missing ${claim}.`);
for (const claim of ["startsWith(\"eq64:\")", "Same IDs with different serialized public content", "Semantically equal but differently serialized public JSON", "peer_payload_drift", "repair_deck_drift", "repairSelectionMatched", "payload_unverified", "Fingerprint without exact payload event count", "Missing Prompt observer evidence", "remain in the denominator", "never verified 2/2", "no repair"]) assert(test.includes(claim), `Payload integrity test is missing ${claim}.`);

for (const doc of [docEn, docZh]) {
  assert(/eq64/.test(doc), "Payload integrity docs must match the current eq64 implementation.");
  assert(!/eq32/.test(doc), "Payload integrity docs must not retain stale eq32 wording.");
  assert(/raw serialized|原始序列化/.test(doc), "Payload docs must state equality is taken from raw serialized Prompt content.");
  assert(/not.*cryptographic|不是密码学/.test(doc), "Payload docs must reject cryptographic/signature overclaiming.");
  assert(/selection provenance|selection-provenance/i.test(doc), "Payload docs must explain repair selection-provenance invariance.");
  assert(/denominator|分母/.test(doc), "Payload docs must say missing receipts remain in denominator.");
  assert(/correctness|正确性/.test(doc), "Payload docs must stay separate from answer correctness.");
}

console.log("✓ eq64 exact serialized payload parity keeps every transport-observed turn in the denominator and requires full repair-context invariance");

function assert(condition, message) { if (!condition) throw new Error(`Provider memory payload integrity check failed: ${message}`); }
