import type { CouncilParticipant } from "../src/core/types.js";
import type { ProviderExecutionAuditEvent } from "../src/provider-sdk/execution-audit.js";
import type { ProviderTransportAuditRecord } from "../src/provider-sdk/transport-audit.js";
import { deriveProviderMemoryFairness } from "../src/theater/provider-memory-fairness.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "a", name: "Alpha", provider: "alpha" },
  { id: "b", name: "Beta", provider: "beta" },
  { id: "c", name: "Gamma", provider: "gamma" },
];
const audits = participants.map((participant) => audit(participant.id));
const transports = participants.map((participant, index) => firstPrompt(participant.id, 100 + index));

const verified = deriveProviderMemoryFairness(participants, audits, transports);
assert(verified.state === "verified", "Equal actual public payloads with complete actor representation must be verified.");
assert(verified.rounds[0]?.publicPayloadConsistent, "Same fingerprint across equal peers must prove actual public payload equality.");
assert(verified.rounds[0]?.latestRoundRepresentationComplete, "All previous-round actors must be represented.");
assert(verified.actualPromptTurns === 3, "Every seat must carry actual Prompt evidence in the baseline fixture.");

const payloadMismatch = transports.map(cloneTransport);
payloadMismatch[1]!.publicContextFingerprint = "fnv1a32:deadbeef:321";
const payloadMismatchModel = deriveProviderMemoryFairness(participants, audits, payloadMismatch);
assert(payloadMismatchModel.state === "public_payload_mismatch", "Same-round equal peers with different actual public JSON fingerprints must fail payload fairness even if ids still match.");
assert(payloadMismatchModel.publicPayloadMismatchRounds === 1, "Payload mismatch must be reported at round granularity.");

const repaired = [...transports.map(cloneTransport), repairPrompt("a", 100, "fnv1a32:12345678:300")];
const repairedModel = deriveProviderMemoryFairness(participants, audits, repaired);
assert(repairedModel.state === "verified", "A format repair with the exact same public deck must preserve fairness.");
assert(repairedModel.turns.find((turn) => turn.actorId === "a")?.repairContextConsistent === true, "Repair parity must be explicitly auditable when repair occurs.");

const repairDrift = [...transports.map(cloneTransport), repairPrompt("a", 100, "fnv1a32:87654321:301")];
const repairDriftModel = deriveProviderMemoryFairness(participants, audits, repairDrift);
assert(repairDriftModel.state === "repair_context_drift", "Repair that changes the public payload must be a distinct protocol violation.");
assert(repairDriftModel.repairContextMismatchTurns === 1, "Exact repair-context mismatch turn must be counted.");

const actorDrift = transports.map(cloneTransport);
actorDrift[2]!.latestRoundSelectedActorIds = ["a", "b"];
const actorDriftModel = deriveProviderMemoryFairness(participants, audits, actorDrift);
assert(actorDriftModel.state === "selector_actor_drift", "Actual Prompt actor representation must match deterministic selector actor coverage.");
assert(actorDriftModel.selectorActorMismatchTurns === 1, "Selector actor drift must identify the affected Provider turn.");

const limitedAudits = audits.map(cloneAudit);
for (const item of limitedAudits) {
  item.latestRoundSelectedActorIds = ["a", "b"];
  item.latestRoundOmittedActorIds = ["c"];
}
const limitedTransports = transports.map((record) => ({ ...cloneTransport(record), latestRoundSelectedActorIds: ["a", "b"] }));
const limited = deriveProviderMemoryFairness(participants, limitedAudits, limitedTransports);
assert(limited.state === "representation_limited", "Actor count beyond representable hard-cap coverage must be explicit rather than called verified.");
assert(limited.representationLimitedRounds === 1, "Representation-limited round must be counted.");

const promptUnverified = deriveProviderMemoryFairness(participants, audits, []);
assert(promptUnverified.state === "prompt_unverified", "Modern selector audit without actual Prompt proof must not be mislabeled legacy or verified.");

const legacyAudits = audits.map((item) => {
  const copy = cloneAudit(item);
  delete copy.contextSelectionObserved;
  delete copy.latestRoundActorIds;
  delete copy.latestRoundSelectedActorIds;
  delete copy.latestRoundOmittedActorIds;
  return copy;
});
const legacy = deriveProviderMemoryFairness(participants, legacyAudits, []);
assert(legacy.state === "legacy_unverified", "Old archives without explicit modern fairness provenance must stay legacy-unverified.");

console.log("✓ Provider public-memory fairness separates payload equality, repair parity, actor coverage, prompt proof and legacy evidence");

function audit(actorId: string): ProviderExecutionAuditEvent {
  return {
    sessionId: "fairness-session",
    actorId,
    providerId: actorId,
    providerName: actorId.toUpperCase(),
    phase: "debate",
    round: 3,
    stage: "turn_started",
    snapshotEventIds: ["e1", "e2", "e3"],
    contextSelectionObserved: true,
    pinnedOpenIssueEventIds: [],
    pinnedIssueSourceEventIds: [],
    latestRoundEventIds: ["e1", "e2", "e3"],
    latestRoundActorIds: ["a", "b", "c"],
    latestRoundSelectedActorIds: ["a", "b", "c"],
    latestRoundOmittedActorIds: [],
    observedAt: `2026-08-21T00:03:0${actorId.charCodeAt(0) % 3}.000Z`,
  };
}

function firstPrompt(actorId: string, tabId: number): ProviderTransportAuditRecord {
  return {
    sessionId: "fairness-session",
    actorId,
    phase: "debate",
    round: 3,
    state: "received",
    mode: "live-provider-tabs",
    observedAt: `2026-08-21T00:03:${String(tabId - 100).padStart(2, "0")}.000Z`,
    snapshotEventIds: ["e1", "e2", "e3"],
    promptMemoryObserved: true,
    pinnedOpenIssueEventIds: [],
    pinnedIssueSourceEventIds: [],
    latestRoundEventIds: ["e1", "e2", "e3"],
    latestRoundSelectedActorIds: ["a", "b", "c"],
    publicContextFingerprint: "fnv1a32:12345678:300",
    repairAttempt: false,
    tabId,
    promptChars: 1000,
    responseChars: 500,
  };
}

function repairPrompt(actorId: string, tabId: number, publicContextFingerprint: string): ProviderTransportAuditRecord {
  return {
    ...firstPrompt(actorId, tabId),
    repairAttempt: true,
    publicContextFingerprint,
    observedAt: "2026-08-21T00:03:59.000Z",
  };
}

function cloneAudit(item: ProviderExecutionAuditEvent): ProviderExecutionAuditEvent {
  return {
    ...item,
    snapshotEventIds: [...item.snapshotEventIds],
    ...(item.pinnedOpenIssueEventIds !== undefined ? { pinnedOpenIssueEventIds: [...item.pinnedOpenIssueEventIds] } : {}),
    ...(item.pinnedIssueSourceEventIds !== undefined ? { pinnedIssueSourceEventIds: [...item.pinnedIssueSourceEventIds] } : {}),
    ...(item.latestRoundEventIds !== undefined ? { latestRoundEventIds: [...item.latestRoundEventIds] } : {}),
    ...(item.latestRoundActorIds !== undefined ? { latestRoundActorIds: [...item.latestRoundActorIds] } : {}),
    ...(item.latestRoundSelectedActorIds !== undefined ? { latestRoundSelectedActorIds: [...item.latestRoundSelectedActorIds] } : {}),
    ...(item.latestRoundOmittedActorIds !== undefined ? { latestRoundOmittedActorIds: [...item.latestRoundOmittedActorIds] } : {}),
  };
}

function cloneTransport(item: ProviderTransportAuditRecord): ProviderTransportAuditRecord {
  return {
    ...item,
    snapshotEventIds: [...item.snapshotEventIds],
    ...(item.pinnedOpenIssueEventIds !== undefined ? { pinnedOpenIssueEventIds: [...item.pinnedOpenIssueEventIds] } : {}),
    ...(item.pinnedIssueSourceEventIds !== undefined ? { pinnedIssueSourceEventIds: [...item.pinnedIssueSourceEventIds] } : {}),
    ...(item.latestRoundEventIds !== undefined ? { latestRoundEventIds: [...item.latestRoundEventIds] } : {}),
    ...(item.latestRoundSelectedActorIds !== undefined ? { latestRoundSelectedActorIds: [...item.latestRoundSelectedActorIds] } : {}),
  };
}
