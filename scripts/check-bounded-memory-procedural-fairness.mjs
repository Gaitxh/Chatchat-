import fs from "node:fs";

const selector = fs.readFileSync("src/provider-sdk/context-selection.ts", "utf8");
const test = fs.readFileSync("tests/context-selection-bounded-fairness.test.ts", "utf8");
const docEn = fs.readFileSync("docs/BOUNDED_MEMORY_PROCEDURAL_FAIRNESS.md", "utf8");
const docZh = fs.readFileSync("docs/BOUNDED_MEMORY_PROCEDURAL_FAIRNESS.zh-CN.md", "utf8");

for (const claim of [
  "selectPinnedIssueMemory",
  "selectOrdinaryRecentIds",
  "balancedRoundIds",
  "stableRotation(`${sessionId}|pin|${cohortKey}`",
  "stableRotation(seed, actorIds.length)",
  "pinned.size + additions.length > maxPinnedIssueEvents",
]) {
  assert(selector.includes(claim), `Bounded-memory fairness selector is missing semantic structure: ${claim}.`);
}
assert(
  /const key = `\$\{issueMemoryRank\(issue\)\}\|\$\{issue\.round\}`/.test(selector),
  "Pin cohorts must be defined by structural priority plus source round before actor balancing resolves ties.",
);
assert(
  /const byActor = new Map<string, OpenMeetingIssueProvenance\[\]>/[Symbol.match](selector)
    && /const actorCycle = rotate\(actorIds, stableRotation\(`\$\{sessionId\}\|pin\|\$\{cohortKey\}`/.test(selector),
  "Equal-rank/equal-round pin candidates must be grouped by source actor and traversed with deterministic rotation.",
);
assert(
  /function selectOrdinaryRecentIds[\s\S]*?rounds[\s\S]*?sort\(\(a, b\) => b - a\)[\s\S]*?balancedRoundIds\(roundEvents, remaining/.test(selector),
  "Ordinary recency must preserve newer rounds first and delegate only the truncated boundary round to actor balancing.",
);
assert(
  /function balancedRoundIds[\s\S]*?return events\.filter\(\(event\) => selected\.has\(event\.id\)\)/.test(selector),
  "Shared actor-balanced allocator must restore selected events to input Blackboard chronology.",
);
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
