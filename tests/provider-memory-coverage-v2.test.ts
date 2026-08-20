import type { CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import { selectProviderContextEvents } from "../src/provider-sdk/context-selection.js";
import type { ProviderExecutionAuditEvent } from "../src/provider-sdk/execution-audit.js";
import type { ProviderTransportAuditRecord } from "../src/provider-sdk/transport-audit.js";
import { deriveMeetingMemoryIntegrity } from "../src/theater/meeting-memory-integrity.js";
import { deriveProviderMemoryCoverage } from "../src/theater/provider-memory-coverage.js";
import { deriveProviderMemoryGaps } from "../src/theater/provider-memory-gaps.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "a", name: "Alpha", provider: "alpha" },
  { id: "b", name: "Beta", provider: "beta" },
];
const base = { sessionId: "memory-coverage-v2", createdAt: "2026-08-15T01:00:00.000Z" };
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
assert(selectionR3.events.length === 12, "R3 must retain the 12-event hard budget.");
assert(selectionR3.pinnedIssueSourceEventIds.includes("u1"), "Old unresolved uncertainty must cause an explicit pin.");

const r3: CouncilEvent[] = [
  {
    ...base,
    id: "a2",
    round: 3,
    actorId: "a",
    kind: "revision",
    previousEventId: "a1",
    stance: "A guarded",
    content: "I now add the rollout guardrail.",
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
    stance: "A guarded",
    content: `Round three follow-up ${index + 1}.`,
    confidence: .7,
    createdAt: `2026-08-15T01:01:${String(10 + index).padStart(2, "0")}.000Z`,
  })),
];
const beforeR4 = [...beforeR3, ...r3];
const selectionR4 = selectProviderContextEvents(beforeR4);
assert(!selectionR4.pinnedIssueSourceEventIds.includes("u1"), "Exact later resolution must release the old pin for the next round.");

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
const round3 = model.rounds.find((round) => round.round === 3)!;
const round4 = model.rounds.find((round) => round.round === 4)!;
assert(round3.availableCount === 13 && round3.snapshotCount === 12, "R3 must disclose hard-cap omission instead of pretending full history fit.");
assert(round3.actualPromptSeatCount === 2, "Both R3 seats must be backed by actual Prompt metadata.");
assert(round3.snapshotsConsistent, "Equal peers must receive one identical public memory deck in the same round.");
assert(round3.pinnedIssueSourceEventIds.includes("u1"), "Memory receipt must keep the exact canonical pin reason.");
assert(round3.pinnedIssues[0]?.resolverEventId === "a2", "Replay may show the later exact resolver while keeping the earlier turn's selection immutable.");
assert(round4.actualPromptSeatCount === 2 && !round4.pinnedIssueSourceEventIds.includes("u1"), "The resolved source must be absent from R4 pinned memory while actual Prompt proof continues.");
assert(model.actualPromptTurnCount === 4 && model.legacySelectorTurnCount === 0, "Modern actual Prompt proof must not be downgraded to selector-only evidence.");
assert(model.allSharedSnapshotsConsistent && model.allPromptSelectorConsistent, "Baseline fixture must satisfy peer fairness and selector↔Prompt agreement.");

const selectorMismatched = audits.map(cloneAudit);
const betaSelector = selectorMismatched.find((item) => item.actorId === "b" && item.round === 3)!;
betaSelector.snapshotEventIds = betaSelector.snapshotEventIds.slice(1);
const selectorDrift = deriveProviderMemoryCoverage(participants, beforeR4, selectorMismatched, transports);
assert(selectorDrift.allSharedSnapshotsConsistent, "Identical actual Prompt decks remain peer-fair even when selector audit drifts.");
assert(selectorDrift.selectorMismatchTurnCount === 1 && !selectorDrift.allPromptSelectorConsistent, "Selector drift must remain distinct from peer fairness.");

const promptMismatched = transports.map(cloneTransport);
const betaPrompt = promptMismatched.find((item) => item.actorId === "b" && item.round === 3)!;
betaPrompt.snapshotEventIds = betaPrompt.snapshotEventIds.slice(1);
const promptDrift = deriveProviderMemoryCoverage(participants, beforeR4, audits, promptMismatched);
assert(!promptDrift.allSharedSnapshotsConsistent, "Different actual public Prompt decks must surface peer fairness violation.");

const selectorOnly = transports.map((record) => ({ ...cloneTransport(record), promptMemoryObserved: undefined }));
const selectorOnlyModel = deriveProviderMemoryCoverage(participants, beforeR4, audits, selectorOnly as ProviderTransportAuditRecord[]);
assert(selectorOnlyModel.actualPromptTurnCount === 0 && selectorOnlyModel.legacySelectorTurnCount === 0, "Modern explicit selector audit without actual Prompt proof must remain selector-only, not legacy.");

const legacyAudits = audits.map((event) => {
  const copy = cloneAudit(event);
  delete copy.contextSelectionObserved;
  delete copy.pinnedOpenIssueEventIds;
  delete copy.pinnedIssueSourceEventIds;
  delete copy.latestRoundEventIds;
  return copy;
});
const legacyModel = deriveProviderMemoryCoverage(participants, beforeR4, legacyAudits, []);
assert(legacyModel.legacySelectorTurnCount === 4, "Old archives must stay visibly legacy rather than receiving post-hoc modern memory proof.");

// Create a deliberately tiny-memory projection so an actually open canonical
// issue is absent. The gap model may report coverage loss but never importance.
const tinyCoverage = deriveProviderMemoryCoverage(participants, beforeR3, [audit("a", "Alpha", 3, selectionR3)], [], 2);
tinyCoverage.turns[0]!.snapshotEventIds = ["r2-9", "r2-10"];
tinyCoverage.turns[0]!.omittedEventIds = tinyCoverage.turns[0]!.availableEventIds.filter((id) => !tinyCoverage.turns[0]!.snapshotEventIds.includes(id));
const gaps = deriveProviderMemoryGaps(participants, beforeR3, tinyCoverage);
assert(gaps.uniqueGapSourceEventIds.includes("u1"), "Canonical-open source omitted by the bounded deck must become a memory coverage gap.");
const integrity = deriveMeetingMemoryIntegrity(tinyCoverage, gaps);
assert(integrity.protocolState === "bounded_coverage", "Fair hard-cap omissions must be reported as bounded coverage rather than a composite trust failure.");

const peerIntegrity = deriveMeetingMemoryIntegrity(promptDrift, deriveProviderMemoryGaps(participants, beforeR4, promptDrift));
assert(peerIntegrity.protocolState === "peer_fairness_violation", "Different actual same-round public decks must dominate memory protocol state.");
const selectorIntegrity = deriveMeetingMemoryIntegrity(selectorDrift, deriveProviderMemoryGaps(participants, beforeR4, selectorDrift));
assert(selectorIntegrity.protocolState === "selector_drift", "Actual Prompt agreement failure with peer-fair decks must remain selector drift.");
const legacyIntegrity = deriveMeetingMemoryIntegrity(legacyModel, deriveProviderMemoryGaps(participants, beforeR4, legacyModel));
assert(legacyIntegrity.protocolState === "legacy_unverified", "Legacy selector-only archives must never be upgraded to verified memory integrity.");

console.log("✓ Provider memory v2 separates actual Prompt coverage, selector drift, peer fairness, hard-cap gaps and legacy evidence");

function audit(actorId: string, providerName: string, round: number, selection: ReturnType<typeof selectProviderContextEvents>): ProviderExecutionAuditEvent {
  return {
    sessionId: base.sessionId,
    actorId,
    providerId: actorId,
    providerName,
    phase: "debate",
    round,
    stage: "turn_started",
    snapshotEventIds: selection.events.map((event) => event.id),
    contextSelectionObserved: true,
    pinnedOpenIssueEventIds: [...selection.pinnedEventIds],
    pinnedIssueSourceEventIds: [...selection.pinnedIssueSourceEventIds],
    latestRoundEventIds: [...selection.latestRoundEventIds],
    observedAt: `2026-08-15T01:0${round}:00.000Z`,
  };
}

function transport(actorId: string, round: number, tabId: number, selection: ReturnType<typeof selectProviderContextEvents>): ProviderTransportAuditRecord {
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
    pinnedOpenIssueEventIds: [...selection.pinnedEventIds],
    pinnedIssueSourceEventIds: [...selection.pinnedIssueSourceEventIds],
    latestRoundEventIds: [...selection.latestRoundEventIds],
    repairAttempt: false,
    tabId,
    promptChars: 1000,
    responseChars: 500,
    elapsedMs: 100,
  };
}

function cloneAudit(item: ProviderExecutionAuditEvent): ProviderExecutionAuditEvent {
  return {
    ...item,
    snapshotEventIds: [...item.snapshotEventIds],
    ...(item.pinnedOpenIssueEventIds !== undefined ? { pinnedOpenIssueEventIds: [...item.pinnedOpenIssueEventIds] } : {}),
    ...(item.pinnedIssueSourceEventIds !== undefined ? { pinnedIssueSourceEventIds: [...item.pinnedIssueSourceEventIds] } : {}),
    ...(item.latestRoundEventIds !== undefined ? { latestRoundEventIds: [...item.latestRoundEventIds] } : {}),
  };
}

function cloneTransport(item: ProviderTransportAuditRecord): ProviderTransportAuditRecord {
  return {
    ...item,
    snapshotEventIds: [...item.snapshotEventIds],
    ...(item.pinnedOpenIssueEventIds !== undefined ? { pinnedOpenIssueEventIds: [...item.pinnedOpenIssueEventIds] } : {}),
    ...(item.pinnedIssueSourceEventIds !== undefined ? { pinnedIssueSourceEventIds: [...item.pinnedIssueSourceEventIds] } : {}),
    ...(item.latestRoundEventIds !== undefined ? { latestRoundEventIds: [...item.latestRoundEventIds] } : {}),
  };
}
