import {
  createExecutionAuditHistoryArchive,
} from "../src/history/execution-audit-history.js";
import type { ProviderExecutionAuditEvent } from "../src/provider-sdk/execution-audit.js";
import type { ProviderTransportAuditRecord } from "../src/provider-sdk/transport-audit.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const FINGERPRINT = "fnv1a64:1234567890abcdef:400";
const transports: ProviderTransportAuditRecord[] = [
  {
    sessionId: "session-a",
    actorId: "claude",
    phase: "debate",
    round: 2,
    state: "received",
    mode: "live-provider-tabs",
    observedAt: "2026-08-15T01:00:00.000Z",
    promptMemoryObserved: true,
    snapshotEventIds: ["e1", "e2"],
    declaredSnapshotEventIds: ["e1", "e2"],
    snapshotMetadataMatchesPayload: true,
    pinnedOpenIssueEventIds: ["e1"],
    pinnedIssueSourceEventIds: ["e1"],
    latestRoundEventIds: ["e2"],
    latestRoundSelectedActorIds: ["gpt", "claude"],
    publicContextFingerprint: FINGERPRINT,
    repairAttempt: false,
    tabId: 7,
    promptChars: 4100,
    responseChars: 1800,
    elapsedMs: 8200,
  },
  {
    sessionId: "other-session",
    actorId: "gpt",
    phase: "sealed",
    round: 1,
    state: "received",
    mode: "synthetic-showcase",
    observedAt: "2026-08-15T00:59:00.000Z",
    snapshotEventIds: [],
    repairAttempt: false,
    tabId: 8,
    promptChars: 100,
  },
];

const execution: ProviderExecutionAuditEvent[] = [
  {
    sessionId: "session-a",
    actorId: "claude",
    providerId: "anthropic-claude",
    providerName: "Claude",
    phase: "debate",
    round: 2,
    stage: "structured_parsed",
    snapshotEventIds: ["e1", "e2"],
    contextSelectionObserved: true,
    pinnedOpenIssueEventIds: ["e1"],
    pinnedIssueSourceEventIds: ["e1"],
    latestRoundEventIds: ["e2"],
    latestRoundActorIds: ["gpt", "claude", "gemini"],
    latestRoundSelectedActorIds: ["gpt", "claude"],
    latestRoundOmittedActorIds: ["gemini"],
    attempt: 1,
    contributionKinds: ["revision"],
    observedAt: "2026-08-15T01:00:09.000Z",
  },
  {
    sessionId: "other-session",
    actorId: "gpt",
    providerId: "openai-chatgpt",
    providerName: "ChatGPT",
    phase: "sealed",
    round: 1,
    stage: "structured_parsed",
    snapshotEventIds: [],
    attempt: 1,
    contributionKinds: ["argument"],
    observedAt: "2026-08-15T00:59:01.000Z",
  },
];

const archive = createExecutionAuditHistoryArchive("session-a", transports, execution);
assert(archive.sessionId === "session-a", "receipt must keep the requested session id");
assert(archive.mode === "live-provider-tabs", "receipt must preserve live versus synthetic execution mode");
assert(archive.transports.length === 1, "receipt must exclude transport records from other sessions");
assert(archive.execution.length === 1, "receipt must exclude execution audit records from other sessions");
assert(archive.transports[0]?.promptMemoryObserved === true, "receipt must preserve actual-Prompt memory evidence strength");
assert(archive.transports[0]?.snapshotEventIds.join(",") === "e1,e2", "receipt must freeze actual public payload ids");
assert(archive.transports[0]?.declaredSnapshotEventIds?.join(",") === "e1,e2", "receipt must freeze independent Prompt-declared snapshot ids");
assert(archive.transports[0]?.snapshotMetadataMatchesPayload === true, "receipt must freeze metadata↔actual payload parity");
assert(archive.transports[0]?.pinnedOpenIssueEventIds?.join(",") === "e1", "receipt must freeze restored old event ids");
assert(archive.transports[0]?.pinnedIssueSourceEventIds?.join(",") === "e1", "receipt must freeze exact canonical pin-reason source ids");
assert(archive.transports[0]?.latestRoundEventIds?.join(",") === "e2", "receipt must freeze newest-round protected ids");
assert(archive.transports[0]?.latestRoundSelectedActorIds?.join(",") === "gpt,claude", "receipt must freeze actual Prompt latest-round actor representation");
assert(archive.transports[0]?.publicContextFingerprint === FINGERPRINT, "receipt must freeze the actual normalized public-payload fingerprint");
assert(archive.execution[0]?.contextSelectionObserved === true, "receipt must preserve modern selector-audit provenance");
assert(archive.execution[0]?.latestRoundActorIds?.join(",") === "gpt,claude,gemini", "receipt must freeze all actors who spoke in the previous public round");
assert(archive.execution[0]?.latestRoundSelectedActorIds?.join(",") === "gpt,claude", "receipt must freeze selector actor representation");
assert(archive.execution[0]?.latestRoundOmittedActorIds?.join(",") === "gemini", "receipt must freeze mathematically unrepresented actors");
assert(archive.execution[0]?.contributionKinds?.[0] === "revision", "receipt must freeze structured contribution kinds");

// The archive must own every memory/fairness/protocol array rather than retaining
// mutable live-ledger references. Historical replay is evidence about what
// happened then; later runtime mutations must never rewrite that story.
(transports[0]!.snapshotEventIds as string[]).push("mutated-after-freeze");
(transports[0]!.declaredSnapshotEventIds as string[]).push("mutated-declaration");
(transports[0]!.pinnedOpenIssueEventIds as string[]).push("mutated-pin");
(transports[0]!.pinnedIssueSourceEventIds as string[]).push("mutated-source");
(transports[0]!.latestRoundEventIds as string[]).push("mutated-latest");
(transports[0]!.latestRoundSelectedActorIds as string[]).push("mutated-actor");
(execution[0]!.pinnedOpenIssueEventIds as string[]).push("mutated-execution-pin");
(execution[0]!.pinnedIssueSourceEventIds as string[]).push("mutated-execution-source");
(execution[0]!.latestRoundEventIds as string[]).push("mutated-execution-latest");
(execution[0]!.latestRoundActorIds as string[]).push("mutated-all-actor");
(execution[0]!.latestRoundSelectedActorIds as string[]).push("mutated-selected-actor");
(execution[0]!.latestRoundOmittedActorIds as string[]).push("mutated-omitted-actor");
(execution[0]!.contributionKinds as string[]).push("support");
assert(archive.transports[0]?.snapshotEventIds.join(",") === "e1,e2", "frozen receipt must own actual public payload ids");
assert(archive.transports[0]?.declaredSnapshotEventIds?.join(",") === "e1,e2", "frozen receipt must own declared snapshot ids");
assert(archive.transports[0]?.snapshotMetadataMatchesPayload === true, "frozen receipt must preserve metadata parity");
assert(archive.transports[0]?.pinnedOpenIssueEventIds?.join(",") === "e1", "frozen receipt must own pinned-event ids");
assert(archive.transports[0]?.pinnedIssueSourceEventIds?.join(",") === "e1", "frozen receipt must own pin-reason source ids");
assert(archive.transports[0]?.latestRoundEventIds?.join(",") === "e2", "frozen receipt must own latest-round ids");
assert(archive.transports[0]?.latestRoundSelectedActorIds?.join(",") === "gpt,claude", "frozen transport receipt must own actual represented-actor ids");
assert(archive.transports[0]?.publicContextFingerprint === FINGERPRINT, "frozen transport fingerprint must remain immutable");
assert(archive.execution[0]?.pinnedOpenIssueEventIds?.join(",") === "e1", "frozen execution audit must own pinned-event ids");
assert(archive.execution[0]?.pinnedIssueSourceEventIds?.join(",") === "e1", "frozen execution audit must own pin-source ids");
assert(archive.execution[0]?.latestRoundEventIds?.join(",") === "e2", "frozen execution audit must own latest-round ids");
assert(archive.execution[0]?.latestRoundActorIds?.join(",") === "gpt,claude,gemini", "frozen selector audit must own all latest-round actor ids");
assert(archive.execution[0]?.latestRoundSelectedActorIds?.join(",") === "gpt,claude", "frozen selector audit must own represented actor ids");
assert(archive.execution[0]?.latestRoundOmittedActorIds?.join(",") === "gemini", "frozen selector audit must own omitted actor ids");
assert(archive.execution[0]?.contributionKinds?.join(",") === "revision", "frozen receipt must not change with live parse ledger mutation");

const unknown = createExecutionAuditHistoryArchive("missing-session", transports, execution);
assert(unknown.mode === "unknown", "receipt without transport evidence must not invent a live/synthetic mode");
assert(unknown.transports.length === 0 && unknown.execution.length === 0, "missing session receipt must remain empty");

console.log("✓ Durable Provider execution + memory/fairness/metadata-parity receipt snapshot tests passed");
