import type { CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import { createExecutionAuditHistoryArchive } from "../src/history/execution-audit-history.js";
import type { ProviderExecutionAuditEvent } from "../src/provider-sdk/execution-audit.js";
import type { ProviderTransportAuditRecord } from "../src/provider-sdk/transport-audit.js";
import { deriveProviderMemoryCoverage } from "../src/theater/provider-memory-coverage.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participant: CouncilParticipant = { id: "a", name: "Alpha", provider: "alpha" };
const event: CouncilEvent = {
  id: "e1",
  sessionId: "memory-history-session",
  round: 1,
  actorId: "a",
  kind: "uncertain",
  content: "Old public uncertainty.",
  confidence: .2,
  createdAt: "2026-08-15T04:00:00.000Z",
};
const snapshotIds = ["e1"];
const latestIds = ["e1"];
const transports: ProviderTransportAuditRecord[] = [{
  sessionId: event.sessionId,
  actorId: "a",
  phase: "debate",
  round: 2,
  state: "sending",
  mode: "live-provider-tabs",
  observedAt: "2026-08-15T04:01:00.000Z",
  promptMemoryObserved: true,
  snapshotEventIds: snapshotIds,
  latestRoundEventIds: latestIds,
  repairAttempt: false,
  tabId: 101,
  promptChars: 1200,
}];
const execution: ProviderExecutionAuditEvent[] = [{
  sessionId: event.sessionId,
  actorId: "a",
  providerId: "alpha",
  providerName: "Alpha",
  phase: "debate",
  round: 2,
  stage: "turn_started",
  snapshotEventIds: snapshotIds,
  latestRoundEventIds: latestIds,
  observedAt: "2026-08-15T04:01:00.000Z",
}];

const archive = createExecutionAuditHistoryArchive(event.sessionId, transports, execution);
assert(archive.sessionId === event.sessionId, "Execution receipt must preserve the consultation session id.");
assert(archive.transports[0]?.promptMemoryObserved === true, "Durable execution receipt must preserve actual Prompt observation strength.");
assert(archive.transports[0]?.latestRoundEventIds?.[0] === "e1", "Durable receipt must preserve actual Prompt latest-round classification.");

// Mutating live arrays after close must not rewrite the frozen receipt.
snapshotIds.push("mutated-after-close");
latestIds.length = 0;
transports[0]!.snapshotEventIds = ["transport-mutated"];
execution[0]!.snapshotEventIds = ["execution-mutated"];
assert(archive.transports[0]?.snapshotEventIds.join(",") === "e1", "Frozen transport Prompt memory must be isolated from live-array mutation.");
assert(archive.transports[0]?.latestRoundEventIds?.join(",") === "e1", "Frozen Prompt memory categories must survive source-array mutation.");
assert(archive.execution[0]?.snapshotEventIds.join(",") === "e1", "Frozen selector audit must also be isolated from live-array mutation.");

const coverage = deriveProviderMemoryCoverage([participant], [event], archive.execution, archive.transports);
assert(coverage.actualPromptTurnCount === 1, "Historical Memory Coverage must reconstruct actual_prompt evidence from the frozen transport receipt.");
assert(coverage.turns[0]?.selectionEvidence === "actual_prompt", "Browser restart must not silently downgrade an actual Prompt receipt to selector_audit.");
assert(coverage.allPromptSelectorConsistent, "Frozen actual Prompt and selector audit should remain comparable after restart.");

console.log("✓ durable execution history preserves actual Prompt memory evidence strength and bounded-memory categories");
