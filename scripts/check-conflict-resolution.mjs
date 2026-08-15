import fs from "node:fs";

const model = fs.readFileSync("src/theater/conflict-resolution.ts", "utf8");
const panel = fs.readFileSync("src/extension/components/ConflictResolutionLedger.tsx", "utf8");
const board = fs.readFileSync("src/extension/components/ConflictBoard.tsx", "utf8");
const guard = fs.readFileSync("extension-public/live-deliberation-showcase-guard.js", "utf8");

for (const claim of [
  "ConflictObligationResolution",
  "ConflictRoundTrajectory",
  "deriveConflictResolutionLedger",
  "explicitlyAnswersRequest",
  "eventReferences",
  "directPeerRequestTarget",
  'state: resolver ? "resolved" : "open"',
  "resolvedByEventId",
  "resolvedRound",
  "openAtEnd",
]) {
  assert(model.includes(claim), `Conflict resolution model is missing: ${claim}`);
}
for (const forbidden of ["semanticSimilarity", "cosineSimilarity", "createEmbedding", "embeddingVector"]) {
  assert(!model.includes(forbidden), `Conflict closure must not use semantic inference: ${forbidden}`);
}
assert(!model.includes("consensusRatio"), "Conflict closure must not depend on majority alignment.");

for (const claim of [
  'data-conflict-resolution-ledger="exact-provenance"',
  "data-conflict-obligation-state",
  "data-conflict-resolved-by-event",
  "data-conflict-trajectory-round",
  "data-conflict-trajectory-open-at-end",
  "Still awaiting exact structured response",
  "仍等待精确结构化回应",
]) {
  assert(panel.includes(claim), `Conflict closure UI is missing: ${claim}`);
}
assert(board.includes("<ConflictResolutionLedgerPanel"), "Conflict Board must render the Resolution Ledger.");

for (const claim of [
  "data-chatchat-conflict-resolution-showcase",
  'data-conflict-obligation-state="resolved"',
  "data-conflict-resolved-by-event",
  'data-conflict-obligation-state="open"',
  "data-conflict-trajectory-round",
  "sawResolvedConflictObligation",
  "sawOpenConflictObligation",
  "sawConflictTrajectory",
]) {
  assert(guard.includes(claim), `Chromium proof does not enforce conflict closure provenance: ${claim}`);
}

console.log("✓ conflict closure receipts and round trajectories require exact structured provenance");

function assert(condition, message) {
  if (!condition) throw new Error(`Conflict Resolution check failed: ${message}`);
}
