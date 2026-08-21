import fs from "node:fs";

const selector = fs.readFileSync("src/provider-sdk/context-selection.ts", "utf8");
const fingerprint = fs.readFileSync("src/provider-sdk/protocol-fingerprint.ts", "utf8");
const promptAudit = fs.readFileSync("src/provider-sdk/prompt-memory-audit.ts", "utf8");
const execution = fs.readFileSync("src/provider-sdk/execution-audit.ts", "utf8");
const transport = fs.readFileSync("src/provider-sdk/transport-audit.ts", "utf8");
const fairness = fs.readFileSync("src/theater/provider-memory-fairness.ts", "utf8");
const portal = fs.readFileSync("src/extension/provider-memory-portal.tsx", "utf8");
const ui = fs.readFileSync("src/extension/components/ProviderMemoryFairness.tsx", "utf8");
const selectorTest = fs.readFileSync("tests/context-selection-fairness.test.ts", "utf8");
const fairnessTest = fs.readFileSync("tests/provider-memory-fairness.test.ts", "utf8");

for (const claim of [
  "selectLatestRoundFairly",
  "latestRoundActorIds",
  "latestRoundSelectedActorIds",
  "latestRoundOmittedActorIds",
  "stableActorRank",
  "Every latest-round actor receives one slot before any actor receives a second slot",
  "canonical-open source events",
]) assert(selector.includes(claim), `Seat-balanced latest-round selector is missing ${claim}.`);

for (const claim of [
  'algorithm: "fnv1a32"',
  "fingerprintProtocolJsonText",
  "not a security hash",
]) assert(fingerprint.includes(claim), `Protocol payload fingerprint contract is missing ${claim}.`);

for (const claim of [
  "CONSULTATION_EVENTS_JSON",
  "publicContextFingerprint",
  "latestRoundSelectedActorIds",
  "fingerprintProtocolJsonText",
]) assert(promptAudit.includes(claim), `Actual Prompt fairness audit is missing ${claim}.`);

for (const claim of [
  "latestRoundActorIds",
  "latestRoundSelectedActorIds",
  "latestRoundOmittedActorIds",
  "contextSelectionObserved: true",
]) assert(execution.includes(claim), `Selector fairness audit is missing ${claim}.`);

for (const claim of [
  "publicContextFingerprint",
  "latestRoundSelectedActorIds",
  "promptMemoryObserved: true",
]) assert(transport.includes(claim), `Transport fairness receipt is missing ${claim}.`);

for (const claim of [
  '"representation_limited"',
  '"public_payload_mismatch"',
  '"repair_context_drift"',
  '"selector_actor_drift"',
  '"prompt_unverified"',
  '"legacy_unverified"',
  "samePromptDeck",
  "selectorActorCoverageMatchesActual",
]) assert(fairness.includes(claim), `Provider Memory Fairness model is missing ${claim}.`);

for (const claim of [
  "deriveProviderMemoryFairness",
  "ProviderMemoryFairness",
]) assert(portal.includes(claim), `Provider Memory portal is missing fairness integration ${claim}.`);

for (const claim of [
  "PUBLIC MEMORY PROCEDURAL FAIRNESS",
  "data-provider-memory-fairness",
  "data-memory-fairness-payload-consistent",
  "data-memory-fairness-actor-omitted",
  "repair keeps deck",
  "REPRESENTATION LIMITED",
]) assert(ui.includes(claim), `Provider Memory Fairness UI is missing ${claim}.`);

for (const claim of [
  "4 latest-round slots each",
  "Changing actor publication order",
  "Five-seat overfull selection",
  "latestRoundOmittedActorIds.length === 1",
]) assert(selectorTest.includes(claim), `Seat-order regression test is missing ${claim}.`);

for (const claim of [
  "public_payload_mismatch",
  "repair_context_drift",
  "selector_actor_drift",
  "representation_limited",
  "prompt_unverified",
  "legacy_unverified",
]) assert(fairnessTest.includes(claim), `Fairness state regression test is missing ${claim}.`);

console.log("✓ Provider memory fairness enforces seat-balanced latest-round representation, actual payload equality and repair-deck parity");

function assert(condition, message) {
  if (!condition) throw new Error(`Provider memory fairness check failed: ${message}`);
}
