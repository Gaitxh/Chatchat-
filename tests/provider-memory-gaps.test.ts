import type { CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import { selectProviderContextEvents } from "../src/provider-sdk/context-selection.js";
import type { ProviderExecutionAuditEvent } from "../src/provider-sdk/execution-audit.js";
import type { ProviderTransportAuditRecord } from "../src/provider-sdk/transport-audit.js";
import { deriveProviderMemoryCoverage } from "../src/theater/provider-memory-coverage.js";
import { deriveProviderMemoryGaps } from "../src/theater/provider-memory-gaps.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "a", name: "Alpha", provider: "alpha" },
  { id: "b", name: "Beta", provider: "beta" },
];
const base = { sessionId: "memory-gap-session", createdAt: "2026-08-15T03:00:00.000Z" };
const oldOpen: CouncilEvent[] = Array.from({ length: 7 }, (_, index) => ({
  ...base,
  id: `old-u-${index + 1}`,
  round: 1,
  actorId: index % 2 ? "a" : "b",
  kind: "uncertain" as const,
  content: `Old unresolved risk ${index + 1}.`,
  confidence: .2,
  createdAt: `2026-08-15T03:00:0${index}.000Z`,
}));
const newest: CouncilEvent[] = Array.from({ length: 10 }, (_, index) => ({
  ...base,
  id: `new-${index + 1}`,
  round: 2,
  actorId: index % 2 ? "a" : "b",
  kind: "argument" as const,
  stance: "Working option",
  content: `Newest round event ${index + 1}.`,
  confidence: .6,
  createdAt: `2026-08-15T03:01:${String(index).padStart(2, "0")}.000Z`,
}));
const events = [...oldOpen, ...newest];
const selection = selectProviderContextEvents(events);
assert(selection.events.length === 12, "The hard public context budget must remain 12.");
assert(selection.latestRoundEventIds.length === 10, "The newest round must be protected first.");
assert(selection.pinnedEventIds.length === 2, "Only two old unresolved events fit after the 10-event newest round.");

const execution: ProviderExecutionAuditEvent[] = [
  audit("a", "Alpha", selection),
  audit("b", "Beta", selection),
];
const transports: ProviderTransportAuditRecord[] = [
  transport("a", 101, selection),
  transport("b", 102, selection),
];
const coverage = deriveProviderMemoryCoverage(participants, events, execution, transports);
const gaps = deriveProviderMemoryGaps(participants, events, coverage);
assert(coverage.allSharedSnapshotsConsistent, "Both peers should still receive the same bounded deck.");
assert(coverage.allPromptSelectorConsistent, "Actual Prompt and selector should agree even when the hard budget cannot cover every unresolved issue.");
assert(gaps.gapTurnCount === 2, "Both Provider turns must disclose unresolved material omitted by the hard cap.");
assert(gaps.uniqueGapSourceEventIds.length === 5, "Seven old uncertainties with two restored slots should leave five unique unresolved source gaps.");
assert(gaps.gaps.length === 10, "The same five known gaps should be reported for both equal Provider turns.");
assert(gaps.actualPromptGapCount === 10, "Coverage-gap evidence should be backed by actual Prompt receipts in this fixture.");
assert(gaps.allGapSetsFairWithinRound, "Equal peers should have the same known memory-gap set when their actual Prompt decks match.");
assert(gaps.gaps.every((gap) => gap.kind === "explicit_uncertainty" && gap.openedRound === 1), "Only canonical still-open old uncertainties should appear as known gaps.");

// Hard-cap limitation is not the same thing as Provider unfairness. Make Beta's
// actual Prompt include one previously omitted open source while Alpha remains
// unchanged. The gap sets should diverge and peer memory fairness should fail.
const unfairTransports = transports.map((record) => ({
  ...record,
  snapshotEventIds: [...record.snapshotEventIds],
  ...(record.pinnedOpenIssueEventIds ? { pinnedOpenIssueEventIds: [...record.pinnedOpenIssueEventIds] } : {}),
  ...(record.pinnedIssueSourceEventIds ? { pinnedIssueSourceEventIds: [...record.pinnedIssueSourceEventIds] } : {}),
  ...(record.latestRoundEventIds ? { latestRoundEventIds: [...record.latestRoundEventIds] } : {}),
}));
const beta = unfairTransports.find((record) => record.actorId === "b")!;
const omittedOpen = oldOpen.find((event) => !selection.events.some((selected) => selected.id === event.id))!;
beta.snapshotEventIds = [...beta.snapshotEventIds.slice(0, -1), omittedOpen.id];
const unfairCoverage = deriveProviderMemoryCoverage(participants, events, execution, unfairTransports);
const unfairGaps = deriveProviderMemoryGaps(participants, events, unfairCoverage);
assert(!unfairCoverage.allSharedSnapshotsConsistent, "Different actual Prompt decks must remain a Provider fairness violation.");
assert(!unfairGaps.allGapSetsFairWithinRound, "Different actual decks should produce visibly different unresolved coverage-gap sets.");

console.log("✓ Provider Memory Gaps expose unresolved obligations omitted by the hard context cap without inventing importance");

function audit(
  actorId: string,
  providerName: string,
  selection: ReturnType<typeof selectProviderContextEvents>,
): ProviderExecutionAuditEvent {
  return {
    sessionId: base.sessionId,
    actorId,
    providerId: actorId,
    providerName,
    phase: "debate",
    round: 3,
    stage: "turn_started",
    snapshotEventIds: selection.events.map((event) => event.id),
    ...(selection.pinnedEventIds.length ? { pinnedOpenIssueEventIds: [...selection.pinnedEventIds] } : {}),
    ...(selection.pinnedIssueSourceEventIds.length ? { pinnedIssueSourceEventIds: [...selection.pinnedIssueSourceEventIds] } : {}),
    ...(selection.latestRoundEventIds.length ? { latestRoundEventIds: [...selection.latestRoundEventIds] } : {}),
    observedAt: "2026-08-15T03:02:00.000Z",
  };
}

function transport(
  actorId: string,
  tabId: number,
  selection: ReturnType<typeof selectProviderContextEvents>,
): ProviderTransportAuditRecord {
  return {
    sessionId: base.sessionId,
    actorId,
    phase: "debate",
    round: 3,
    state: "received",
    mode: "live-provider-tabs",
    observedAt: "2026-08-15T03:02:01.000Z",
    promptMemoryObserved: true,
    snapshotEventIds: selection.events.map((event) => event.id),
    ...(selection.pinnedEventIds.length ? { pinnedOpenIssueEventIds: [...selection.pinnedEventIds] } : {}),
    ...(selection.pinnedIssueSourceEventIds.length ? { pinnedIssueSourceEventIds: [...selection.pinnedIssueSourceEventIds] } : {}),
    ...(selection.latestRoundEventIds.length ? { latestRoundEventIds: [...selection.latestRoundEventIds] } : {}),
    repairAttempt: false,
    tabId,
    promptChars: 1200,
    responseChars: 400,
    elapsedMs: 90,
  };
}
