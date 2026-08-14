import type { CouncilEvent, CouncilParticipant, CouncilPhase } from "../core/types.js";
import type { ProviderExecutionAuditEvent } from "../provider-sdk/execution-audit.js";

export type ProviderTransportAuditState = "sending" | "received" | "failed";

export interface ProviderTransportAuditRecord {
  sessionId: string;
  actorId: string;
  phase: CouncilPhase | "consultation";
  round: number;
  state: ProviderTransportAuditState;
  observedAt: string;
  snapshotEventIds: readonly string[];
  pinnedOpenIssueEventIds?: readonly string[];
  latestRoundEventIds?: readonly string[];
  repairAttempt: boolean;
  tabId?: number;
  host?: string;
  title?: string;
  promptChars?: number;
  responseChars?: number;
  elapsedMs?: number;
  error?: string;
}

export type ProviderTurnAuditState =
  | "started"
  | "prompt_sent"
  | "response_captured"
  | "structured_parsed"
  | "published"
  | "repaired"
  | "fallback"
  | "failed";

export interface ProviderTurnAttendanceAudit {
  key: string;
  sessionId: string;
  actorId: string;
  participantName: string;
  providerId: string;
  phase: CouncilPhase;
  round: number;
  state: ProviderTurnAuditState;
  snapshotEventIds: string[];
  pinnedOpenIssueEventIds?: string[];
  latestRoundEventIds?: string[];
  publishedEventIds: string[];
  contributionKinds: string[];
  repairRequested: boolean;
  repairSucceeded: boolean;
  fallbackEmitted: boolean;
  transportReceived: boolean;
  transportFailed: boolean;
  tabId?: number;
  host?: string;
  elapsedMs?: number;
  responseChars?: number;
  error?: string;
}

export interface ProviderSeatAttendanceAudit {
  actorId: string;
  participantName: string;
  providerId: string;
  host?: string;
  turns: ProviderTurnAttendanceAudit[];
  verifiedTurns: number;
  repairedTurns: number;
  fallbackTurns: number;
  failedTurns: number;
}

export interface ProviderAttendanceAuditModel {
  sessionId: string | null;
  seats: ProviderSeatAttendanceAudit[];
  totalTurns: number;
  verifiedTurns: number;
  repairedTurns: number;
  fallbackTurns: number;
  failedTurns: number;
}

export function buildProviderAttendanceAudit(
  participants: readonly CouncilParticipant[],
  transports: readonly ProviderTransportAuditRecord[],
  execution: readonly ProviderExecutionAuditEvent[],
  publicEvents: readonly CouncilEvent[],
): ProviderAttendanceAuditModel {
  const sessionId = latestSessionId(transports, execution, publicEvents);
  if (!sessionId) {
    return {
      sessionId: null,
      seats: participants.map((participant) => emptySeat(participant)),
      totalTurns: 0,
      verifiedTurns: 0,
      repairedTurns: 0,
      fallbackTurns: 0,
      failedTurns: 0,
    };
  }

  const participantById = new Map(participants.map((participant) => [participant.id, participant] as const));
  const keys = new Set<string>();
  for (const item of transports) {
    if (item.sessionId === sessionId && isMeetingPhase(item.phase)) keys.add(turnKey(item.actorId, item.phase, item.round));
  }
  for (const item of execution) {
    if (item.sessionId === sessionId) keys.add(turnKey(item.actorId, item.phase, item.round));
  }
  for (const event of publicEvents) {
    if (event.sessionId === sessionId) keys.add(turnKey(event.actorId, phaseForEvent(event), event.round));
  }

  const turns = [...keys]
    .map((key) => buildTurn(key, sessionId, participantById, transports, execution, publicEvents))
    .filter((turn): turn is ProviderTurnAttendanceAudit => Boolean(turn))
    .sort((a, b) => a.round - b.round || phaseRank(a.phase) - phaseRank(b.phase) || a.participantName.localeCompare(b.participantName));

  const seatIds = new Set([...participants.map((participant) => participant.id), ...turns.map((turn) => turn.actorId)]);
  const seats = [...seatIds].map((actorId) => {
    const participant = participantById.get(actorId) ?? {
      id: actorId,
      name: actorId,
      provider: "unknown",
    };
    const seatTurns = turns.filter((turn) => turn.actorId === actorId);
    const host = seatTurns.find((turn) => turn.host)?.host;
    return {
      actorId,
      participantName: participant.name,
      providerId: participant.provider,
      ...(host ? { host } : {}),
      turns: seatTurns,
      verifiedTurns: seatTurns.filter((turn) => turn.state === "published" || turn.state === "repaired").length,
      repairedTurns: seatTurns.filter((turn) => turn.state === "repaired").length,
      fallbackTurns: seatTurns.filter((turn) => turn.state === "fallback").length,
      failedTurns: seatTurns.filter((turn) => turn.state === "failed").length,
    } satisfies ProviderSeatAttendanceAudit;
  });

  return {
    sessionId,
    seats,
    totalTurns: turns.length,
    verifiedTurns: turns.filter((turn) => turn.state === "published" || turn.state === "repaired").length,
    repairedTurns: turns.filter((turn) => turn.state === "repaired").length,
    fallbackTurns: turns.filter((turn) => turn.state === "fallback").length,
    failedTurns: turns.filter((turn) => turn.state === "failed").length,
  };
}

function buildTurn(
  key: string,
  sessionId: string,
  participants: ReadonlyMap<string, CouncilParticipant>,
  transports: readonly ProviderTransportAuditRecord[],
  execution: readonly ProviderExecutionAuditEvent[],
  publicEvents: readonly CouncilEvent[],
): ProviderTurnAttendanceAudit | null {
  const [actorId, phaseText, roundText] = key.split("|");
  if (!actorId || !phaseText || !isMeetingPhase(phaseText)) return null;
  const round = Number(roundText);
  if (!Number.isFinite(round)) return null;
  const phase = phaseText;
  const participant = participants.get(actorId);
  const turnTransports = transports.filter((item) =>
    item.sessionId === sessionId && item.actorId === actorId && item.phase === phase && item.round === round,
  );
  const turnExecution = execution.filter((item) =>
    item.sessionId === sessionId && item.actorId === actorId && item.phase === phase && item.round === round,
  );
  const published = publicEvents.filter((event) =>
    event.sessionId === sessionId && event.actorId === actorId && event.round === round && phaseForEvent(event) === phase,
  );

  const received = [...turnTransports].reverse().find((item) => item.state === "received");
  const failedTransport = [...turnTransports].reverse().find((item) => item.state === "failed");
  const initial = turnTransports.find((item) => !item.repairAttempt) ?? turnTransports[0];
  const parsed = [...turnExecution].reverse().find((item) => item.stage === "structured_parsed");
  const started = turnExecution.find((item) => item.stage === "turn_started") ?? turnExecution[0];
  const repairRequested = turnExecution.some((item) => item.stage === "repair_requested") || turnTransports.some((item) => item.repairAttempt);
  const repairSucceeded = Boolean(parsed?.attempt === 2 && published.length);
  const fallback = [...turnExecution].reverse().find((item) => item.stage === "fallback_emitted");
  const structuredFailed = [...turnExecution].reverse().find((item) => item.stage === "structured_failed");

  const state: ProviderTurnAuditState = fallback
    ? "fallback"
    : structuredFailed || (failedTransport && !parsed)
      ? "failed"
      : repairSucceeded
        ? "repaired"
        : published.length && parsed
          ? "published"
          : parsed
            ? "structured_parsed"
            : received
              ? "response_captured"
              : turnTransports.some((item) => item.state === "sending")
                ? "prompt_sent"
                : "started";

  const error = fallback?.error ?? structuredFailed?.error ?? failedTransport?.error;
  const host = received?.host ?? initial?.host;
  const tabId = received?.tabId ?? initial?.tabId;
  const elapsedMs = received?.elapsedMs;
  const responseChars = received?.responseChars;
  const selectionAudit = parsed ?? started;
  const pinnedOpenIssueEventIds = [...(initial?.pinnedOpenIssueEventIds ?? selectionAudit?.pinnedOpenIssueEventIds ?? [])];
  const latestRoundEventIds = [...(initial?.latestRoundEventIds ?? selectionAudit?.latestRoundEventIds ?? [])];

  return {
    key: `${sessionId}|${key}`,
    sessionId,
    actorId,
    participantName: participant?.name ?? received?.title ?? actorId,
    providerId: participant?.provider ?? "unknown",
    phase,
    round,
    state,
    snapshotEventIds: [...(initial?.snapshotEventIds ?? selectionAudit?.snapshotEventIds ?? [])],
    ...(pinnedOpenIssueEventIds.length ? { pinnedOpenIssueEventIds } : {}),
    ...(latestRoundEventIds.length ? { latestRoundEventIds } : {}),
    publishedEventIds: published.map((event) => event.id),
    contributionKinds: [...(parsed?.contributionKinds ?? fallback?.contributionKinds ?? [])],
    repairRequested,
    repairSucceeded,
    fallbackEmitted: Boolean(fallback),
    transportReceived: Boolean(received),
    transportFailed: Boolean(failedTransport),
    ...(tabId != null ? { tabId } : {}),
    ...(host ? { host } : {}),
    ...(elapsedMs != null ? { elapsedMs } : {}),
    ...(responseChars != null ? { responseChars } : {}),
    ...(error ? { error } : {}),
  };
}

function latestSessionId(
  transports: readonly ProviderTransportAuditRecord[],
  execution: readonly ProviderExecutionAuditEvent[],
  publicEvents: readonly CouncilEvent[],
): string | null {
  const candidates: Array<{ sessionId: string; observedAt: string }> = [];
  for (const item of transports) candidates.push({ sessionId: item.sessionId, observedAt: item.observedAt });
  for (const item of execution) candidates.push({ sessionId: item.sessionId, observedAt: item.observedAt });
  for (const event of publicEvents) candidates.push({ sessionId: event.sessionId, observedAt: event.createdAt });
  candidates.sort((a, b) => a.observedAt.localeCompare(b.observedAt));
  return candidates.at(-1)?.sessionId ?? null;
}

function emptySeat(participant: CouncilParticipant): ProviderSeatAttendanceAudit {
  return {
    actorId: participant.id,
    participantName: participant.name,
    providerId: participant.provider,
    turns: [],
    verifiedTurns: 0,
    repairedTurns: 0,
    fallbackTurns: 0,
    failedTurns: 0,
  };
}

function turnKey(actorId: string, phase: CouncilPhase, round: number): string {
  return `${actorId}|${phase}|${round}`;
}

function phaseForEvent(event: CouncilEvent): CouncilPhase {
  if (event.kind === "final_position") return "final";
  return event.round === 1 ? "sealed" : "debate";
}

function isMeetingPhase(value: string): value is CouncilPhase {
  return value === "sealed" || value === "debate" || value === "final";
}

function phaseRank(phase: CouncilPhase): number {
  if (phase === "sealed") return 0;
  if (phase === "debate") return 1;
  return 2;
}
