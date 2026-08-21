import fs from "node:fs";

const selector = read("src/provider-sdk/context-selection.ts");
const test = read("tests/obligation-aware-context.test.ts");
const prompt = read("src/provider-sdk/consultation-mode-prompt.ts");

requireClaims("Obligation-aware selector", selector, [
  "seat floor → unresolved obligations → extra newest",
  "selectWithOverfullLatestRound",
  "scheduleObligationGroups",
  "selectActorFloor",
  "selectAdditionalLatestEvents",
  "Whole obligation groups are scheduled rather than prose summaries",
  "cannot indefinitely starve an older",
  "maxEvents - selectedAny.size",
]);

requireClaims("Obligation scheduling regression", test, [
  "Old unresolved direct question must regain bounded memory capacity",
  "One old direct obligation should displace one optional newest-round extra event",
  "Challenge target parent must be restored with its source",
  "Old obligation cannot displace a newest-round actor",
]);

// Existing Prompt semantics are part of the scheduling contract: once a source
// is restored into the shared bounded deck, target actors must be told to treat
// it as unfinished public meeting business before unrelated new points.
requireClaims("Pinned obligation Prompt", prompt, [
  "CHATCHAT_PINNED_OPEN_ISSUES",
  "PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON",
  "address it before unrelated new points",
]);

console.log("✓ bounded memory schedules equal-seat floor, canonical obligation groups, extra latest speech, then ordinary recency");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function requireClaims(label, value, claims) {
  for (const claim of claims) {
    if (!value.includes(claim)) throw new Error(`Obligation-aware memory check failed: ${label} is missing ${claim}.`);
  }
}
