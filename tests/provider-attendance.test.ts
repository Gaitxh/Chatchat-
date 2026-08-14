import type { CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import type { ProviderExecutionAuditEvent } from "../src/provider-sdk/execution-audit.js";
import {
  buildProviderAttendanceAudit,
  type ProviderTransportAuditRecord,
} from "../src/theater/provider-attendance.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "gpt", name: "ChatGPT", provider: "openai-chatgpt" },
  { id: "claude", name: "Claude", provider: "anthropic-claude" },
  { id: "gemini", name: "Gemini", provider: "google-gemini" },
];

const sessionId = "session-audit";
const events: CouncilEvent[] = [
  argument("e-gpt-r1", "gpt", 1, "A"),
  argument("e-claude-r1", "claude", 1, "B"),
  argument("e-gemini-r1", "gemini", 1, "A"),
  {
    id: "e-gpt-r2",
    sessionId,
    round: 2,
    actorId: "gpt",
    kind: "challenge",
    targetEventId: "e-claude-r1",
    content: "Challenge",
    createdAt: "2026-08-15T00:00:04.000Z",
  },
  {
    id: "e-claude-r2",
    sessionId,
    round: 2,
    actorId: "claude",
    kind: "revision",
    previousEventId: "e-claude-r1",
    stance: "A",
    content: "Revised after repair",
    confidence: 0.82,
    causedBy: ["e-gpt-r2"],
    createdAt: "2026-08-15T00:00:05.000Z",
  },
  {
    id: "e-gemini-r2",
    sessionId,
    round: 2,
    actorId: "gemini",
    kind: "uncertain",
    content: "This participant could not complete its structured consultation turn. Transport failed.",
    confidence: 0,
    createdAt: "2026-08-15T00:00:06.000Z",
  },
];

const transports: ProviderTransportAuditRecord[] = [
  transport("gpt", "sealed", 1, "received", [], false, "chatgpt.com"),
  transport("claude", "sealed", 1, "received", [], false, "claude.ai"),
  transport("gemini", "sealed", 1, "received", [], false, "gemini.google.com"),
  transport("gpt", "debate", 2, "received", ["e-gpt-r1", "e-claude-r1", "e-gemini-r1"], false, "chatgpt.com"),
  transport("claude", "debate", 2, "received", ["e-gpt-r1", "e-claude-r1", "e-gemini-r1"], false, "claude.ai"),
  transport("claude", "debate", 2, "received", ["e-gpt-r1", "e-claude-r1", "e-gemini-r1"], true, "claude.ai"),
  {
    ...transport("gemini", "debate", 2, "failed", ["e-gpt-r1", "e-claude-r1", "e-gemini-r1"], false, "gemini.google.com"),
    error: "Transport failed",
  },
];

const execution: ProviderExecutionAuditEvent[] = [
  parsed("gpt", "sealed", 1, 1, ["argument"], []),
  parsed("claude", "sealed", 1, 1, ["argument"], []),
  parsed("gemini", "sealed", 1, 1, ["argument"], []),
  parsed("gpt", "debate", 2, 1, ["challenge"], ["e-gpt-r1", "e-claude-r1", "e-gemini-r1"]),
  signal("claude", "debate", 2, "repair_requested", ["e-gpt-r1", "e-claude-r1", "e-gemini-r1"], 1),
  parsed("claude", "debate", 2, 2, ["revision"], ["e-gpt-r1", "e-claude-r1", "e-gemini-r1"]),
  {
    ...signal("gemini", "debate", 2, "fallback_emitted", ["e-gpt-r1", "e-claude-r1", "e-gemini-r1"]),
    contributionKinds: ["uncertain"],
    error: "Transport failed",
  },
];

const model = buildProviderAttendanceAudit(participants, transports, execution, events);
assert(model.sessionId === sessionId, "latest meeting session must be selected");
assert(model.seats.length === 3, "all participants must have audit seats");

const gptR2 = model.seats.find((seat) => seat.actorId === "gpt")?.turns.find((turn) => turn.round === 2);
assert(gptR2?.state === "published", "a received, parsed and published real turn must be verified");
assert(gptR2.snapshotEventIds.join(",") === "e-gpt-r1,e-claude-r1,e-gemini-r1", "turn must preserve the exact prompt snapshot ids");
assert(gptR2.publishedEventIds.includes("e-gpt-r2"), "published Blackboard event id must close the audit chain");

const claudeR2 = model.seats.find((seat) => seat.actorId === "claude")?.turns.find((turn) => turn.round === 2);
assert(claudeR2?.state === "repaired", "a successful second structured parse must remain visibly repaired");
assert(claudeR2.repairRequested && claudeR2.repairSucceeded, "repair lifecycle must remain explicit");
assert(claudeR2.publishedEventIds.includes("e-claude-r2"), "repair is not complete until an event reaches Blackboard");

const geminiR2 = model.seats.find((seat) => seat.actorId === "gemini")?.turns.find((turn) => turn.round === 2);
assert(geminiR2?.state === "fallback", "fallback speech must never masquerade as verified provider reasoning");
assert(geminiR2.transportFailed, "transport failure must stay visible beside the fallback event");
assert(model.fallbackTurns === 1, "fallback totals must be deterministic");

const onlyTransport = buildProviderAttendanceAudit(
  participants,
  [transport("gpt", "debate", 2, "received", ["e-gpt-r1"], false, "chatgpt.com")],
  [],
  [],
);
const incomplete = onlyTransport.seats.find((seat) => seat.actorId === "gpt")?.turns[0];
assert(incomplete?.state === "response_captured", "page response alone must not be called a published/verified meeting turn");
assert(onlyTransport.verifiedTurns === 0, "transport-only evidence must not count as verified attendance");

console.log("✓ Provider attendance audit chain tests passed");

function argument(id: string, actorId: string, round: number, stance: string): CouncilEvent {
  return {
    id,
    sessionId,
    round,
    actorId,
    kind: "argument",
    stance,
    content: `${actorId} ${stance}`,
    confidence: 0.8,
    createdAt: `2026-08-15T00:00:0${round}.000Z`,
  };
}

function transport(
  actorId: string,
  phase: "sealed" | "debate" | "final",
  round: number,
  state: "sending" | "received" | "failed",
  snapshotEventIds: readonly string[],
  repairAttempt: boolean,
  host: string,
): ProviderTransportAuditRecord {
  return {
    sessionId,
    actorId,
    phase,
    round,
    state,
    snapshotEventIds,
    repairAttempt,
    host,
    tabId: actorId === "gpt" ? 1 : actorId === "claude" ? 2 : 3,
    observedAt: `2026-08-15T00:01:${String(round).padStart(2, "0")}.000Z`,
    ...(state === "received" ? { responseChars: 1234, elapsedMs: 1500 } : {}),
  };
}

function signal(
  actorId: string,
  phase: "sealed" | "debate" | "final",
  round: number,
  stage: ProviderExecutionAuditEvent["stage"],
  snapshotEventIds: readonly string[],
  attempt?: 1 | 2,
): ProviderExecutionAuditEvent {
  return {
    sessionId,
    actorId,
    providerId: participants.find((participant) => participant.id === actorId)?.provider ?? "test",
    providerName: participants.find((participant) => participant.id === actorId)?.name ?? actorId,
    phase,
    round,
    stage,
    snapshotEventIds,
    ...(attempt ? { attempt } : {}),
    observedAt: `2026-08-15T00:02:${String(round).padStart(2, "0")}.000Z`,
  };
}

function parsed(
  actorId: string,
  phase: "sealed" | "debate" | "final",
  round: number,
  attempt: 1 | 2,
  contributionKinds: ProviderExecutionAuditEvent["contributionKinds"],
  snapshotEventIds: readonly string[],
): ProviderExecutionAuditEvent {
  return {
    ...signal(actorId, phase, round, "structured_parsed", snapshotEventIds, attempt),
    ...(contributionKinds ? { contributionKinds } : {}),
  };
}
