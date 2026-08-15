import fs from "node:fs";

const gaps = fs.readFileSync("src/theater/provider-memory-gaps.ts", "utf8");
const memoryIntegrity = fs.readFileSync("src/theater/meeting-memory-integrity.ts", "utf8");
const resultBundle = fs.readFileSync("src/theater/result-integrity-bundle.ts", "utf8");
const memoryReceipt = fs.readFileSync("src/consultation/memory-receipt.ts", "utf8");
const privacy = fs.readFileSync("docs/PROVIDER_MEMORY_PRIVACY.md", "utf8");
const memoryDoc = fs.readFileSync("docs/PROVIDER_MEMORY_COVERAGE.md", "utf8");
const integrityDoc = fs.readFileSync("docs/MEETING_MEMORY_INTEGRITY.md", "utf8");

for (const claim of [
  "deriveOpenMeetingIssueProvenance(available)",
  "if (snapshot.has(issue.sourceEventId)) return []",
  "sourceEventId",
  "selectionEvidence",
  "allGapSetsFairWithinRound",
]) {
  assert(gaps.includes(claim), `Memory Coverage Gap model is missing canonical provenance: ${claim}`);
}
for (const forbidden of [
  "embedding",
  "cosine",
  "semanticSimilarity",
  "importanceScore",
  "confidenceRank",
  "consensusRatio",
]) {
  assert(!gaps.includes(forbidden), `Memory Coverage Gaps must not infer semantic importance: ${forbidden}`);
}

for (const claim of [
  '"verified"',
  '"bounded_coverage"',
  '"selector_drift"',
  '"peer_fairness_violation"',
  '"actual_prompt"',
  '"mixed"',
  '"selector_audit"',
  "peerMismatchRounds",
  "selectorMismatchTurns",
  "gapTurns",
]) {
  assert(memoryIntegrity.includes(claim), `Meeting Memory Integrity is missing: ${claim}`);
}
assert(
  memoryIntegrity.indexOf('"peer_fairness_violation"') < memoryIntegrity.indexOf('"selector_drift"'),
  "Peer memory fairness violations must take precedence over selector drift.",
);

for (const claim of [
  'answerCorrectness: "not_scored"',
  "stanceAlignment: report.consensusRatio",
  "memory_bounded_coverage",
  "memory_selector_drift",
  "memory_peer_fairness_violation",
  "execution_degraded",
  "requiresProminentCaveat",
]) {
  assert(resultBundle.includes(claim), `Result Integrity Bundle is missing: ${claim}`);
}
for (const forbidden of [
  "trustScore",
  "trust_score",
  "overallScore",
  "overall_score",
  "accuracyScore",
  "accuracy_score",
  "weightedAverage",
]) {
  assert(!resultBundle.includes(forbidden), `Result integrity must not invent a composite score: ${forbidden}`);
}

for (const claim of [
  "deriveProviderMemoryReceipt",
  "providerMemoryReceiptMarkdown",
  "protocolState",
  "evidenceStrength",
  "knownGapSourceEventIds",
  "actualPromptSeats",
  "omittedEvents",
  "not authority, truth or answer correctness",
]) {
  assert(memoryReceipt.includes(claim), `Provider Memory Receipt is missing bounded provenance: ${claim}`);
}
for (const forbidden of ["responseText", "chain-of-thought", "CHATCHAT_SHARED_MEETING_OBJECTIVE"]) {
  assert(!memoryReceipt.includes(forbidden), `Memory Receipt must not become a second full Prompt/response transcript: ${forbidden}`);
}

for (const claim of [
  "hard public-event budget",
  "Coverage gaps are possible",
  "actual_prompt",
  "selector_audit",
  "Provider-to-Provider public-memory fairness",
  "Selector ↔ actual Prompt agreement",
]) {
  assert(memoryDoc.includes(claim), `Provider Memory docs are missing hard-limit honesty: ${claim}`);
}
for (const claim of [
  "Keep four facts separate",
  "Answer correctness",
  "bounded_coverage",
  "selector_drift",
  "peer_fairness_violation",
  "There is no valid arithmetic",
]) {
  assert(integrityDoc.includes(claim), `Memory Integrity docs are missing multidimensional semantics: ${claim}`);
}
for (const claim of [
  "selection provenance",
  "does not need to persist",
  "hidden chain-of-thought",
  "full raw Provider page responses",
  "permanent duplicate of every generated Prompt string",
]) {
  assert(privacy.includes(claim), `Memory privacy boundary is missing: ${claim}`);
}

console.log("✓ memory gaps, memory protocol integrity, result caveats and privacy receipt stay provenance-first with no composite trust score");

function assert(condition, message) {
  if (!condition) throw new Error(`Memory Result Integrity check failed: ${message}`);
}
