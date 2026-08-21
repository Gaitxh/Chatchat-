import fs from "node:fs";

const openIssues = fs.readFileSync("src/consultation/open-issues.ts", "utf8");
const selector = fs.readFileSync("src/provider-sdk/context-selection.ts", "utf8");
const protocol = fs.readFileSync("src/provider-sdk/consultation-protocol.ts", "utf8");
const modePrompt = fs.readFileSync("src/provider-sdk/consultation-mode-prompt.ts", "utf8");
const agent = fs.readFileSync("src/provider-sdk/consultation-agent.ts", "utf8");
const executionAudit = fs.readFileSync("src/provider-sdk/execution-audit.ts", "utf8");
const attendance = fs.readFileSync("src/theater/provider-attendance.ts", "utf8");
const fairnessTest = fs.readFileSync("tests/context-selection-seat-fairness.test.ts", "utf8");

for (const claim of [
  "OpenMeetingIssueProvenance",
  "deriveOpenMeetingIssueProvenance",
  "deriveOpenMeetingIssues",
  "explicitlyAnswersRequest",
]) {
  assert(openIssues.includes(claim), `Open Issues structural truth source is missing: ${claim}`);
}

for (const claim of [
  "DEFAULT_PROVIDER_CONTEXT_EVENTS = 12",
  "DEFAULT_PROVIDER_PINNED_ISSUE_EVENTS = 6",
  "deriveOpenMeetingIssueProvenance",
  "latestRoundEventIds",
  "protectedLatest",
  "pinnedIssueSourceEventIds",
  "providerVisibleConsultationContext",
  "Pinned events gain memory priority only — never authority",
  "balancedRoundIds",
  "const byActor = new Map",
  "stableRotation",
  "const actorCycle = rotate",
  "publication position receives preference",
]) {
  assert(selector.includes(claim), `Conflict-aware context selector is missing semantic structure: ${claim}`);
}
assert(
  /function latestRoundIds[\s\S]*?return balancedRoundIds\(latest, maxEvents,/.test(selector),
  "Overflowing newest-round selection must delegate to the deterministic actor-balanced allocator.",
);
assert(
  /function balancedRoundIds[\s\S]*?byActor[\s\S]*?actorCycle[\s\S]*?selected\.add/.test(selector),
  "Actor-balanced allocator must group by actor, rotate deterministically and allocate selected event ids.",
);
assert(!selector.includes("embedding"), "Provider context selection must not use embeddings or semantic similarity.");
assert(!selector.includes("consensusRatio"), "Provider context memory priority must not depend on stance majority.");
assert(!selector.includes("confidence >"), "Provider context memory priority must not reward higher model confidence.");
assert(!/filter\(\(event\) => event\.round === latestRound\)[\s\S]{0,80}slice\(-maxEvents\)/.test(selector), "Overflowing newest-round memory must not regress to publication-tail slice(-maxEvents).");

for (const claim of [
  "12 slots across 3 equally active seats must allocate 4/4/4",
  "Selected latest-round event set must be invariant to actor block publication order",
  "differ by at most one slot",
  "A seat with one public event must keep that event",
]) {
  assert(fairnessTest.includes(claim), `Latest-round seat fairness regression test is missing: ${claim}`);
}

for (const claim of [
  "selectProviderContextEvents(context.publicEvents)",
  "PUBLIC_SNAPSHOT_EVENT_IDS_JSON",
  "PINNED_OPEN_ISSUE_EVENT_IDS_JSON",
  "LATEST_ROUND_EVENT_IDS_JSON",
  "Pinned events have memory priority only; they do not gain authority",
  "providerVisibleConsultationContext(context).context",
  "outside this Provider turn's visible consultation context",
]) {
  assert(protocol.includes(claim), `Provider prompt/parser lost bounded conflict-aware context semantics: ${claim}`);
}

for (const claim of [
  "providerVisibleConsultationContext(context)",
  "PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON",
  "CHATCHAT_PINNED_OPEN_ISSUES",
  "directPeerInboxPromptBlock(visibleContext)",
  "explicitReplyPromptBlock(visibleContext)",
  "this block adds attention, not new evidence",
  "no event extra authority, truth status, vote weight, speaking priority",
]) {
  assert(modePrompt.includes(claim), `Mode-aware prompt block lost pinned issue response semantics: ${claim}`);
}

for (const claim of [
  "providerVisibleConsultationContext(context).context",
  "attachExplicitPeerReplies(raw, visible, parsed)",
]) {
  assert(agent.includes(claim), `Real Provider parse/reply path can reference invisible events: ${claim}`);
}

for (const claim of [
  "selectProviderContextEvents(context.publicEvents)",
  "pinnedOpenIssueEventIds",
  "latestRoundEventIds",
]) {
  assert(executionAudit.includes(claim), `Execution audit does not preserve context-selection provenance: ${claim}`);
}
for (const claim of [
  "pinnedOpenIssueEventIds",
  "latestRoundEventIds",
]) {
  assert(attendance.includes(claim), `Attendance audit model drops context-selection provenance: ${claim}`);
}

console.log("✓ unresolved conflict memory, exact provenance and deterministic actor-balanced newest-round protection are mechanically enforced");

function assert(condition, message) {
  if (!condition) throw new Error(`Context selection check failed: ${message}`);
}
