import {
  createExecutionAuditHistoryArchive,
} from "../src/history/execution-audit-history.js";
import type { ProviderExecutionAuditEvent } from "../src/provider-sdk/execution-audit.js";
import type { ProviderTransportAuditRecord } from "../src/provider-sdk/transport-audit.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const transports: ProviderTransportAuditRecord[] = [
  {
    sessionId: "session-a",
    actorId: "claude",
    phase: "debate",
    round: 2,
    state: "received",
    mode: "live-provider-tabs",
    observedAt: "2026-08-15T01:00:00.000Z",
    snapshotEventIds: ["e1", "e2"],
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
assert(archive.transports[0]?.snapshotEventIds.join(",") === "e1,e2", "receipt must freeze exact prompt snapshot ids");
assert(archive.execution[0]?.contributionKinds?.[0] === "revision", "receipt must freeze structured contribution kinds");

// The archive must own its arrays rather than retaining mutable live-ledger references.
(transports[0]!.snapshotEventIds as string[]).push("mutated-after-freeze");
(execution[0]!.contributionKinds as string[]).push("support");
assert(archive.transports[0]?.snapshotEventIds.join(",") === "e1,e2", "frozen receipt must not change with live transport ledger mutation");
assert(archive.execution[0]?.contributionKinds?.join(",") === "revision", "frozen receipt must not change with live parse ledger mutation");

const unknown = createExecutionAuditHistoryArchive("missing-session", transports, execution);
assert(unknown.mode === "unknown", "receipt without transport evidence must not invent a live/synthetic mode");
assert(unknown.transports.length === 0 && unknown.execution.length === 0, "missing session receipt must remain empty");

console.log("✓ Durable Provider execution receipt snapshot tests passed");
