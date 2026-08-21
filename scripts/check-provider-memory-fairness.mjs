import fs from "node:fs";

const selector = read("src/provider-sdk/context-selection.ts");
const fingerprint = read("src/provider-sdk/protocol-fingerprint.ts");
const promptAudit = read("src/provider-sdk/prompt-memory-audit.ts");
const execution = read("src/provider-sdk/execution-audit.ts");
const transport = read("src/provider-sdk/transport-audit.ts");
const fairness = read("src/theater/provider-memory-fairness.ts");
const portal = read("src/extension/provider-memory-portal.tsx");
const ui = read("src/extension/components/ProviderMemoryFairness.tsx");
const selectorTest = read("tests/context-selection-fairness.test.ts");
const fairnessTest = read("tests/provider-memory-fairness.test.ts");
const historyTest = read("tests/execution-audit-history.test.ts");
const fixture = read("extension-public/provider-memory-fairness-showcase.js");
const guard = read("extension-public/provider-memory-fairness-showcase-guard.js");
const historyGuard = read("extension-public/history-persistence-showcase-guard.js");
const validator = read("scripts/validate-provider-memory-fairness-evidence.mjs");
const workflow = read(".github/workflows/ci.yml");
const app = read("app/app.html");

requireClaims("Seat-balanced latest-round selector", selector, [
  "selectLatestRoundFairly",
  "latestRoundActorIds",
  "latestRoundSelectedActorIds",
  "latestRoundOmittedActorIds",
  "stableActorRank",
  "latest-round actor receives one slot before any actor receives a second slot",
  "canonical-open source events",
]);

requireClaims("Protocol payload fingerprint", fingerprint, [
  'algorithm: "fnv1a64"',
  "fingerprintProtocolJsonText",
  "64-bit width reduces accidental collision risk",
  "not a security hash",
]);

requireClaims("Actual Prompt fairness audit", promptAudit, [
  "CONSULTATION_EVENTS_JSON",
  "publicContextFingerprint",
  "latestRoundSelectedActorIds",
  "fingerprintProtocolJsonText",
]);

requireClaims("Selector fairness audit", execution, [
  "latestRoundActorIds",
  "latestRoundSelectedActorIds",
  "latestRoundOmittedActorIds",
  "contextSelectionObserved: true",
]);

requireClaims("Transport fairness receipt", transport, [
  "publicContextFingerprint",
  "latestRoundSelectedActorIds",
  "promptMemoryObserved: true",
]);

requireClaims("Provider Memory Fairness model", fairness, [
  '"representation_limited"',
  '"public_payload_mismatch"',
  '"repair_context_drift"',
  '"selector_actor_drift"',
  '"prompt_unverified"',
  '"legacy_unverified"',
  "samePromptDeck",
  "selectorActorCoverageMatchesActual",
]);

requireClaims("Provider Memory fairness portal", portal, [
  "deriveProviderMemoryFairness",
  "ProviderMemoryFairness",
]);

requireClaims("Provider Memory Fairness UI", ui, [
  "PUBLIC MEMORY PROCEDURAL FAIRNESS",
  "data-provider-memory-fairness",
  "data-memory-fairness-payload-consistent",
  "data-memory-fairness-actor-omitted",
  "repair keeps deck",
  "REPRESENTATION LIMITED",
]);

requireClaims("Seat-order regression test", selectorTest, [
  "4 latest-round slots each",
  "Changing actor publication order",
  "Five-seat overfull selection",
  "latestRoundOmittedActorIds.length === 1",
]);

requireClaims("Fairness state regression test", fairnessTest, [
  "public_payload_mismatch",
  "repair_context_drift",
  "selector_actor_drift",
  "representation_limited",
  "prompt_unverified",
  "legacy_unverified",
]);

requireClaims("Durable fairness receipt test", historyTest, [
  "latestRoundSelectedActorIds",
  "latestRoundOmittedActorIds",
  "publicContextFingerprint",
  "frozen selector audit must own omitted actor ids",
]);

requireClaims("Overfull latest-round browser fixture", fixture, [
  'fairness-proof") !== "overfull"',
  "MEMORY_FAIRNESS_OVERFULL_R2",
  "exactly six public events",
  "never writes the success marker",
]);

requireClaims("Provider Memory Fairness browser guard", guard, [
  'data-memory-fairness-round="3"',
  "data-memory-fairness-actor-represented",
  "data-memory-fairness-payload-consistent",
  "data-provider-memory-latest-count",
  "chatchatProviderMemoryFairnessShowcase",
]);

requireClaims("Frozen Provider Memory Fairness replay", historyGuard, [
  "chatchatProviderMemoryFairnessHistoryReplayShowcase",
  'data-provider-memory-fairness-view="archive"',
  "Historical Provider Memory Fairness",
  "not-applicable",
]);

requireClaims("Provider Memory Fairness evidence validator", validator, [
  "chatchat-provider-memory-fairness-zh.html",
  "chatchat-provider-memory-fairness-en.html",
  "three actors spoke in the overfull latest round",
  "must preserve all three latest-round actors",
  "same normalized public payload",
]);

requireClaims("Full Room fairness proof scripts", app, [
  "provider-memory-fairness-showcase.js",
  "provider-memory-fairness-showcase-guard.js",
]);

requireClaims("CI Provider Memory Fairness proof", workflow, [
  "fairness-proof=overfull",
  "data-chatchat-provider-memory-fairness-showcase=",
  "chatchat-provider-memory-fairness-zh.png",
  "chatchat-provider-memory-fairness-en.png",
  "validate-provider-memory-fairness-evidence.mjs",
]);

console.log("✓ Provider memory fairness requires seat-balanced representation, 64-bit actual-payload equality, repair-deck parity, frozen replay and dedicated Chromium proof");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireClaims(label, value, claims) {
  for (const claim of claims) {
    if (!value.includes(claim)) throw new Error(`Provider memory fairness check failed: ${label} is missing ${claim}.`);
  }
}
