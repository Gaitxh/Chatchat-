import type { ProviderExecutionAuditEvent } from "../src/provider-sdk/execution-audit.js";
import { deriveProviderContextMemory } from "../src/theater/context-memory.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const modernStart = audit({
  sessionId: "memory-session",
  actorId: "claude",
  providerName: "Claude",
  phase: "debate",
  round: 6,
  stage: "turn_started",
  snapshotEventIds: ["old-q", "old-challenge", "r6-a", "r6-b"],
  pinnedOpenIssueEventIds: ["old-q", "old-challenge"],
  latestRoundEventIds: ["r6-a", "r6-b"],
  observedAt: "2026-08-15T02:00:00.000Z",
});
const parsedSameTurn = audit({
  ...modernStart,
  stage: "structured_parsed",
  attempt: 1,
  observedAt: "2026-08-15T02:00:05.000Z",
});
const repairSameTurn = audit({
  ...modernStart,
  stage: "repair_requested",
  attempt: 1,
  observedAt: "2026-08-15T02:00:04.000Z",
});
const latestOnlyStart = audit({
  sessionId: "memory-session",
  actorId: "gpt",
  providerName: "ChatGPT",
  phase: "debate",
  round: 6,
  stage: "turn_started",
  snapshotEventIds: ["r6-a", "r6-b"],
  pinnedOpenIssueEventIds: [],
  latestRoundEventIds: ["r6-a", "r6-b"],
  observedAt: "2026-08-15T02:00:01.000Z",
});
const legacyStart = audit({
  sessionId: "old-session",
  actorId: "gemini",
  providerName: "Gemini",
  phase: "debate",
  round: 4,
  stage: "turn_started",
  snapshotEventIds: ["legacy-a", "legacy-b"],
  observedAt: "2026-08-14T12:00:00.000Z",
});

const modern = deriveProviderContextMemory([modernStart, repairSameTurn, parsedSameTurn, latestOnlyStart]);
assert(modern.turns.length === 2, "Parse/repair stages must not duplicate the immutable per-turn memory receipt.");
assert(modern.pinnedTurnCount === 1, "Only the turn with restored old issues should count as pinned.");
assert(modern.legacyTurnCount === 0, "Modern selection audit arrays must not be mistaken for legacy data.");
const claude = modern.turns.find((turn) => turn.actorId === "claude");
assert(claude?.snapshotEventIds.length === 4, "Context Memory must preserve the exact visible snapshot count.");
assert(JSON.stringify(claude?.pinnedOpenIssueEventIds) === JSON.stringify(["old-q", "old-challenge"]), "Context Memory must preserve exact restored old issue ids.");
assert(JSON.stringify(claude?.latestRoundEventIds) === JSON.stringify(["r6-a", "r6-b"]), "Context Memory must preserve latest-round protected ids.");
assert(claude?.observedAt === modernStart.observedAt, "Later parser stages must not rewrite what the Provider originally saw.");
const gpt = modern.turns.find((turn) => turn.actorId === "gpt");
assert(gpt?.pinnedOpenIssueEventIds?.length === 0, "Zero pins must remain distinguishable from legacy/missing selection provenance.");
assert(!gpt?.legacySelectionAudit, "An explicit empty pin list is modern provenance, not legacy.");

const legacy = deriveProviderContextMemory([legacyStart]);
assert(legacy.turns.length === 1 && legacy.legacyTurnCount === 1, "Old audit records without selection arrays must remain readable as legacy.");
assert(legacy.turns[0]?.pinnedOpenIssueEventIds === undefined, "Legacy history must not fabricate a zero-pin claim.");
assert(legacy.turns[0]?.latestRoundEventIds === undefined, "Legacy history must not fabricate latest-round protection data.");

const mixed = deriveProviderContextMemory([legacyStart, modernStart]);
assert(mixed.turns[0]?.round === 4 && mixed.turns[1]?.round === 6, "Memory receipts must remain chronologically sortable across sessions/rounds.");
assert(mixed.pinnedTurnCount === 1 && mixed.legacyTurnCount === 1, "Mixed history must keep modern and legacy semantics separate.");

console.log("✓ ChatChat Context Memory audit model tests passed");
console.log("✓ Turn-start selection provenance cannot be rewritten by later parse/repair stages");

function audit(value: Partial<ProviderExecutionAuditEvent> & Pick<ProviderExecutionAuditEvent, "sessionId" | "actorId" | "providerName" | "phase" | "round" | "stage" | "snapshotEventIds" | "observedAt">): ProviderExecutionAuditEvent {
  return {
    providerId: value.providerId ?? "test-provider",
    ...value,
  } as ProviderExecutionAuditEvent;
}
