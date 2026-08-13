import {
  describeSourceObservation,
  sourceAgeDays,
  type EvidenceSourceObservation,
} from "../src/evidence/source-metadata.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const observation: EvidenceSourceObservation = {
  state: "reachable",
  observedAt: "2026-08-14T00:00:00.000Z",
  title: "Example source",
  description: "A bounded machine-observed description.",
  excerpt: "A short excerpt that was actually present in the bounded response.",
  pageDate: "2026-07-01T00:00:00.000Z",
  pageDateKind: "published",
  bodyHash: "sha256:0123456789abcdef",
  textCharacters: 1234,
};

const summary = describeSourceObservation(observation);
assert(summary?.includes("published_date=2026-07-01"), "Observation summary should preserve a page date signal.");
assert(summary?.includes("body_hash=sha256:0123456789abcdef"), "Observation summary should preserve the bounded content fingerprint.");
assert(sourceAgeDays(observation.pageDate, observation.observedAt) === 44, "Age signal should be an objective date distance.");
assert(sourceAgeDays(undefined, observation.observedAt) === null, "Missing page date must not invent an age signal.");

const legacy: EvidenceSourceObservation = {
  state: "reachable",
  observedAt: "2026-08-14T00:00:00.000Z",
  statusCode: 200,
};
assert(describeSourceObservation(legacy)?.includes("observed_at="), "Legacy v1 verification snapshots remain compatible.");
assert(!(summary ?? "").toLowerCase().includes("verified"), "Source Observation must not call a reachable page verified truth.");
assert(!(summary ?? "").toLowerCase().includes("stale"), "Date age alone must not auto-label a source stale.");

console.log("✓ ChatChat bounded Source Observation semantics passed");
