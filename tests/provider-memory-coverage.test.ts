import type { CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import { selectProviderContextEvents } from "../src/provider-sdk/context-selection.js";
import type { ProviderExecutionAuditEvent } from "../src/provider-sdk/execution-audit.js";
import type { ProviderTransportAuditRecord } from "../src/provider-sdk/transport-audit.js";
import { deriveProviderMemoryCoverage } from "../src/theater/provider-memory-coverage.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "a", name: "Alpha", provider: "alpha" },
  { id: "b", name: "Beta", provider: "beta" },
];
const base = { sessionId: "memory-coverage-session", createdAt: "2026-08-15T01:00:00.000Z" };
const r1: CouncilEvent[] = [
  { ...base, id: "a1", round: 1, actorId: "a", kind: "argument", stance: "A", content: "Initial A.", confidence: .65 },
  { ...base, id: "u1", round: 1, actorId: "a", kind: "uncertain", content: "An old rollout risk remains unresolved.", confidence: .2 },
  { ...base, id: "b1", round: 1, actorId: "b", kind: "argument", stance: "B", content: "Initial B.", confidence: .66 },
];
const r2: CouncilEvent[] = Array.from({ length: 10 }, (_, index) => ({
  ...base,
  id: `r2-${index + 1}`,
  round: 2,
  actorId: index % 2 ? "a" : "b",
  kind: "argument" as const,
  stance: index % 2 ? "A" : "B",
  content: `Round two ordinary public point ${index + 1}.`,
  confidence: .6,
  createdAt: `2026-08-15T01:00:${String(10 + index).padStart(2, "0")}.000Z`,
}));
const beforeR3 = [...r1, ...r2];
const selectionR3 = selectProviderContextEvents(beforeR3);
assert(selectionR3.events.length === 12, "R3 should consume the full 12-event public context budget.");
assert(selectionR3.pinnedIssueSourceEventIds.includes("u1"), "The old unresolved uncertainty must be a pin reason in R3.");
assert(selectionR3.pinnedEventIds.includes("u1"), "The old unresolved source event itself must be restored into R3 memory.");
assert(!selectionR3.latestRoundEventIds.includes("u1"), "The restored issue must be old memory, not part of the protected newest round.");

const r3: CouncilEvent[] = [
  {
    ...base,
    id: "a2",
    round: 3,
    actorId: "a",
    kind: "revision",
    previousEventId: "a1",
    stance: "A with rollout guardrail",
    content: "The round-two signal resolves my earlier rollout uncertainty.",
    confidence: .82,
    causedBy: ["r2-10"],
    createdAt: "2026-08-15T01:01:00.000Z",
  },
  ...Array.from({ length: 8 }, (_, index) => ({
    ...base,
    id: `r3-${index + 1}`,
    round: 3,
    actorId: index % 2 ? "a" : "b",
    kind: "argument" as const,
    stance: "A with rollout guardrail",
    content: `Round three follow-up point ${index + 1}.`,
    confidence: .7,
    createdAt: `2026-08-15T01:01:${String(10 + index).padStart(2, "0")}.000Z`,
  })),
];
const beforeR4 = [...beforeR3, ...r3];
const selectionR4 = selectProviderContextEvents(beforeR4);
assert(!selectionR4.pinnedIssueSourceEventIds.includes("u1"), "Once the exact canonical resolver closes u1, R4 must stop pinning it.");
assert(!selectionR4.pinnedEventIds.includes("u1"), "Resolved old uncertainty must stop consuming pinned memory slots.");

const audits: ProviderExecutionAuditEvent[] = [
  audit("a", "Alpha", 3, selectionR3),
  audit("b", "Beta", 3, selectionR3),
  audit("a", "Alpha", 4, selectionR4),
  audit("b", "Beta", 4, selectionR4),
];
const transports: ProviderTransportAuditRecord[] = [
  transport("a", 3, 101, selectionR3),
  transport("b", 3, 102, selectionR3),
  transport("a", 4, 101, selectionR4),
  transport("b", 4, 102, selectionR4),
];
const model = deriveProviderMemoryCoverage(participants, beforeR4, audits, transports);
const round3 = model.rounds.find((round) => round.round === 3);
const round4 = model.rounds.find((round) => round.round === 4);
assert(round3 && round4, "Memory model must expose R3 and R4 audit decks.");
assert(round3.snapshotsConsistent && round3.receivedSeatCount === 2, "Both peers should receive the same R3 immutable public memory deck.");
assert(round3.actualPromptSeatCount === 2 && round3.selectorMismatchSeatCount === 0, "R3 should be backed by actual Prompt metadata that agrees with the selector for both seats.");
assert(round3.availableCount === 13 && round3.snapshotCount === 12, "R3 must disclose that one older ordinary event was omitted by budget.");
assert(round3.pinnedIssueSourceEventIds.includes("u1"), "R3 UI model must preserve the exact old Open Issue that caused pinning.");
assert(round3.pinnedIssues[0]?.resolverEventId === "a2" && round3.pinnedIssues[0]?.resolvedRound === 3, "Pinned issue history must identify the later exact resolver without pretending it was known before R3 ran.");
assert(round3.omittedEventIds.length === 1, "R3 memory accounting must expose exactly one omitted ordinary historical event.");
assert(round4.snapshotsConsistent && !round4.pinnedIssueSourceEventIds.includes("u1"), "R4 must prove pin-until-resolved lifecycle closure.");
assert(round4.actualPromptSeatCount === 2 && round4.selectorMismatchSeatCount === 0, "R4 actual Prompt metadata must keep agreeing with the selector after the old issue is unpinned.");
assert(round4.availableCount === 22 && round4.snapshotCount === 12 && round4.omittedEventIds.length === 10, "R4 must expose bounded context accounting after the history grows.");
assert(model.roundsWithPinnedMemory === 1, "Only the still-unresolved R3 turn should need conflict-pinned memory.");
assert(model.actualPromptTurnCount === 4, "Every deterministic turn in this fixture should carry actual Prompt evidence.");
assert(model.selectorMismatchTurnCount === 0 && model.allPromptSelectorConsistent, "Baseline actual Prompt metadata must agree with deterministic selector audit.");
assert(model.allSharedSnapshotsConsistent, "Equal peers should share identical actual public memory selection within each round.");

// Selector-only drift is a different failure class from peer fairness. Keep the
// actual Prompt receipts identical, but mutate Beta's deterministic selector
// audit. Provider-to-Provider fairness should remain true while selector↔Prompt
// consistency becomes false for exactly one turn.
const selectorMismatched = audits.map((item) => ({
  ...item,
  snapshotEventIds: [...item.snapshotEventIds],
  ...(item.pinnedOpenIssueEventIds ? { pinnedOpenIssueEventIds: [...item.pinnedOpenIssueEventIds] } : {}),
  ...(item.pinnedIssueSourceEventIds ? { pinnedIssueSourceEventIds: [...item.pinnedIssueSourceEventIds] } : {}),
  ...(item.latestRoundEventIds ? { latestRoundEventIds: [...item.latestRoundEventIds] } : {}),
}));
const betaSelectorR3 = selectorMismatched.find((item) => item.actorId === "b" && item.round === 3)!;
betaSelectorR3.snapshotEventIds = betaSelectorR3.snapshotEventIds.slice(1);
const selectorMismatchModel = deriveProviderMemoryCoverage(participants, beforeR4, selectorMismatched, transports);
assert(selectorMismatchModel.allSharedSnapshotsConsistent, "Identical actual Provider Prompts must remain fair even if selector audit itself drifts.");
assert(selectorMismatchModel.selectorMismatchTurnCount === 1, "Exactly the mutated Beta R3 selector audit should disagree with its actual Prompt receipt.");
assert(!selectorMismatchModel.allPromptSelectorConsistent, "Selector-to-Prompt drift must be surfaced as its own integrity failure.");

// Actual Prompt drift *is* a peer-memory fairness failure. Mutate Beta R3's
// frozen actual Prompt receipt while leaving selector audit unchanged.
const promptMismatched = transports.map((item) => ({
  ...item,
  snapshotEventIds: [...item.snapshotEventIds],
  ...(item.pinnedOpenIssueEventIds ? { pinnedOpenIssueEventIds: [...item.pinnedOpenIssueEventIds] } : {}),
  ...(item.pinnedIssueSourceEventIds ? { pinnedIssueSourceEventIds: [...item.pinnedIssueSourceEventIds] } : {}),
  ...(item.latestRoundEventIds ? { latestRoundEventIds: [...item.latestRoundEventIds] } : {}),
}));
const betaPromptR3 = promptMismatched.find((item) => item.actorId === "b" && item.round === 3)!;
betaPromptR3.snapshotEventIds = betaPromptR3.snapshotEventIds.slice(1);
const promptMismatchModel = deriveProviderMemoryCoverage(participants, beforeR4, audits, promptMismatched);
assert(!promptMismatchModel.allSharedSnapshotsConsistent, "Different actual Provider Prompt decks must surface a same-round peer-memory fairness failure.");
assert(promptMismatchModel.selectorMismatchTurnCount === 1, "The drifted actual Beta R3 Prompt should also disagree with deterministic selector audit.");

console.log("✓ Provider Memory Coverage proves bounded context, peer fairness, selector agreement and pin-until-resolved lifecycle");

function audit(
  actorId: string,
  providerName: string,
  round: number,
  selection: ReturnType<typeof selectProviderContextEvents>,
): ProviderExecutionAuditEvent {
  return {
    sessionId: base.sessionId,
    actorId,
    providerId: actorId,
    providerName,
    phase: "debate",
    round,
    stage: "turn_started",
    snapshotEventIds: selection.events.map((event) => event.id),
    ...(selection.pinnedEventIds.length ? { pinnedOpenIssueEventIds: [...selection.pinnedEventIds] } : {}),
    ...(selection.pinnedIssueSourceEventIds.length ? { pinnedIssueSourceEventIds: [...selection.pinnedIssueSourceEventIds] } : {}),
    ...(selection.latestRoundEventIds.length ? { latestRoundEventIds: [...selection.latestRoundEventIds] } : {}),
    observedAt: `2026-08-15T01:0${round}:00.000Z`,
  };
}

function transport(
  actorId: string,
  round: number,
  tabId: number,
  selection: ReturnType<typeof selectProviderContextEvents>,
): ProviderTransportAuditRecord {
  return {
    sessionId: base.sessionId,
    actorId,
    phase: "debate",
    round,
    state: "received",
    mode: "live-provider-tabs",
    observedAt: `2026-08-15T01:0${round}:01.000Z`,
    promptMemoryObserved: true,
    snapshotEventIds: selection.events.map((event) => event.id),
    ...(selection.pinnedEventIds.length ? { pinnedOpenIssueEventIds: [...selection.pinnedEventIds] } : {}),
    ...(selection.pinnedIssueSourceEventIds.length ? { pinnedIssueSourceEventIds: [...selection.pinnedIssueSourceEventIds] } : {}),
    ...(selection.latestRoundEventIds.length ? { latestRoundEventIds: [...selection.latestRoundEventIds] } : {}),
    repairAttempt: false,
    tabId,
    promptChars: 1000,
    responseChars: 500,
    elapsedMs: 100,
  };
}
