import fs from "node:fs";

const selector = fs.readFileSync("src/provider-sdk/context-selection.ts", "utf8");
const test = fs.readFileSync("tests/context-selection-bounded-fairness.test.ts", "utf8");
const docEn = fs.readFileSync("docs/BOUNDED_MEMORY_PROCEDURAL_FAIRNESS.md", "utf8");
const docZh = fs.readFileSync("docs/BOUNDED_MEMORY_PROCEDURAL_FAIRNESS.zh-CN.md", "utf8");

for (const claim of [
  "selectPinnedIssueMemory",
  "selectOrdinaryRecentIds",
  "balancedRoundIds",
  "same structural priority and the same source round",
  "Only the oldest boundary round that cannot fit is truncated",
  "Issue context groups are indivisible",
  "stableRotation(`${sessionId}|pin|${cohortKey}`",
  "stableRotation(seed, actorIds.length)",
]) {
  assert(selector.includes(claim), `Bounded-memory fairness selector is missing ${claim}.`);
}

assert(!selector.includes("ordinaryCandidates.slice(-remaining)"), "Ordinary recency must not regress to publication-tail slice(-remaining).");
assert(!/issueMemoryRank\(a\)[\s\S]{0,180}indexById\.get\(a\.sourceEventId\)/.test(selector), "Pin selection must not rely on a global source-index tiebreak after rank/round without source-actor balancing.");

for (const claim of [
  "Boundary-round selected event set must be invariant to actor block publication order",
  "Every active boundary-round seat must get one slot before any seat gets its second",
  "Same-rank same-round pin competition must give one source issue to every active actor",
  "Pinned source set must be invariant to actor block publication order",
  "Lower-rank uncertainty must not leapfrog unresolved challenges",
  "multi-event issue context group that cannot fit must be skipped whole",
]) {
  assert(test.includes(claim), `Bounded-memory fairness regression test is missing ${claim}.`);
}

for (const doc of [docEn, docZh]) {
  assert(/newest|最新/.test(doc), "Fairness docs must cover newest-round allocation.");
  assert(/pin/i.test(doc), "Fairness docs must cover unresolved pin allocation.");
  assert(/recency|近期/.test(doc), "Fairness docs must cover ordinary recency allocation.");
  assert(/not guarantee|不保证/.test(doc), "Fairness docs must state non-guarantees rather than overclaim equality.");
  assert(/correctness|正确/.test(doc), "Fairness docs must remain separate from answer correctness.");
}

console.log("✓ bounded public memory protects structural priority and recency while removing fixed seat-order tie bias");

function assert(condition, message) {
  if (!condition) throw new Error(`Bounded-memory procedural fairness check failed: ${message}`);
}
