import fs from "node:fs";

const selector = fs.readFileSync("src/provider-sdk/context-selection.ts", "utf8");
const test = fs.readFileSync("tests/context-selection-seat-fairness.test.ts", "utf8");
const doc = fs.readFileSync("docs/SEAT_BALANCED_MEMORY.md", "utf8");

for (const claim of [
  "const byActor = new Map",
  "stableRotation",
  "const actorCycle = rotate",
  "publication position receives preference",
  "return latest.filter((event) => selected.has(event.id))",
]) assert(selector.includes(claim), `Seat-balanced selector is missing ${claim}.`);

assert(
  !/filter\(\(event\) => event\.round === latestRound\)[\s\S]{0,100}slice\(-maxEvents\)/.test(selector),
  "Latest-round overflow must never fall back to publication-tail slice(-maxEvents).",
);

for (const claim of [
  "4/4/4",
  "publication order",
  "differ by at most one slot",
  "quiet active seat",
]) assert(test.toLowerCase().includes(claim.toLowerCase()), `Seat fairness test is missing ${claim}.`);

for (const claim of [
  "hidden bias",
  "Group newest-round events by `actorId`",
  "sessionId + round",
  "memory coverage",
  "does not solve",
]) assert(doc.includes(claim), `Seat-balanced memory documentation is missing ${claim}.`);

console.log("✓ overflowing newest-round memory is required to be deterministic, seat-balanced and publication-order independent");

function assert(condition, message) {
  if (!condition) throw new Error(`Seat-balanced memory check failed: ${message}`);
}
