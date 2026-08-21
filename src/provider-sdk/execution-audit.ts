import type { CouncilContext, CouncilEventKind } from "../core/types.js";
import { selectProviderContextEvents } from "./context-selection.js";
import type { ProviderProfile } from "./types.js";

export const PROVIDER_EXECUTION_AUDIT_EVENT = "chatchat:provider-execution-audit";

export type ProviderExecutionAuditStage =
  | "turn_started"
  | "session_prepared"
  | "structured_parsed"
  | "repair_requested"
  | "structured_failed"
  | "fallback_emitted";

export interface ProviderExecutionAuditEvent {
  sessionId: string;
  actorId: string;
  providerId: string;
  providerName: string;
  phase: CouncilContext["phase"];
  round: number;
  stage: ProviderExecutionAuditStage;
  snapshotEventIds: readonly string[];
  /** Present on modern audit records, including when the selected arrays are empty. */
  contextSelectionObserved?: true;
  pinnedOpenIssueEventIds?: readonly string[];
  pinnedIssueSourceEventIds?: readonly string[];
  latestRoundEventIds?: readonly string[];
  latestRoundActorIds?: readonly string[];
  latestRoundSelectedActorIds?: readonly string[];
  latestRoundOmittedActorIds?: readonly string[];
  attempt?: 1 | 2;
  contributionKinds?: readonly CouncilEventKind[];
  error?: string;
  observedAt: string;
}

export type ProviderExecutionAuditSink = (
  event: ProviderExecutionAuditEvent,
) => void | Promise<void>;

const MAX_BUFFERED_EVENTS = 720;
const buffer: ProviderExecutionAuditEvent[] = [];

/**
 * BrowserConsultationAgent uses this by default. In Node/core tests there is no
 * window, so the event dispatch becomes a no-op while the contract remains the
 * same. Browser runs keep a bounded raw ledger so completion persistence can
 * freeze the exact parse/repair/fallback history without reading React state.
 */
export const BROWSER_PROVIDER_EXECUTION_AUDIT: ProviderExecutionAuditSink = (event) => {
  const copy = cloneProviderExecutionAudit(event);
  if (typeof window === "undefined") return;
  buffer.push(copy);
  if (buffer.length > MAX_BUFFERED_EVENTS) buffer.splice(0, buffer.length - MAX_BUFFERED_EVENTS);
  window.dispatchEvent(new CustomEvent<ProviderExecutionAuditEvent>(PROVIDER_EXECUTION_AUDIT_EVENT, {
    detail: copy,
  }));
};

export function providerExecutionAuditSnapshot(sessionId: string): ProviderExecutionAuditEvent[] {
  return buffer
    .filter((event) => event.sessionId === sessionId)
    .map(cloneProviderExecutionAudit);
}

export function providerAuditBase(
  profile: ProviderProfile,
  context: CouncilContext,
): Omit<ProviderExecutionAuditEvent, "stage" | "observedAt"> {
  const selection = selectProviderContextEvents(context.publicEvents);
  return {
    sessionId: context.sessionId,
    actorId: context.participant.id,
    providerId: profile.providerId,
    providerName: profile.displayName,
    phase: context.phase,
    round: context.round,
    snapshotEventIds: selection.events.map((event) => event.id),
    contextSelectionObserved: true,
    // Keep explicit empties on modern records. Otherwise a short modern meeting
    // with zero pins/omissions is indistinguishable from an older archive that
    // predates memory provenance.
    pinnedOpenIssueEventIds: [...selection.pinnedEventIds],
    pinnedIssueSourceEventIds: [...selection.pinnedIssueSourceEventIds],
    latestRoundEventIds: [...selection.latestRoundEventIds],
    latestRoundActorIds: [...selection.latestRoundActorIds],
    latestRoundSelectedActorIds: [...selection.latestRoundSelectedActorIds],
    latestRoundOmittedActorIds: [...selection.latestRoundOmittedActorIds],
  };
}

export function cloneProviderExecutionAudit(event: ProviderExecutionAuditEvent): ProviderExecutionAuditEvent {
  return {
    ...event,
    snapshotEventIds: [...event.snapshotEventIds],
    ...(event.pinnedOpenIssueEventIds !== undefined
      ? { pinnedOpenIssueEventIds: [...event.pinnedOpenIssueEventIds] }
      : {}),
    ...(event.pinnedIssueSourceEventIds !== undefined
      ? { pinnedIssueSourceEventIds: [...event.pinnedIssueSourceEventIds] }
      : {}),
    ...(event.latestRoundEventIds !== undefined
      ? { latestRoundEventIds: [...event.latestRoundEventIds] }
      : {}),
    ...(event.latestRoundActorIds !== undefined
      ? { latestRoundActorIds: [...event.latestRoundActorIds] }
      : {}),
    ...(event.latestRoundSelectedActorIds !== undefined
      ? { latestRoundSelectedActorIds: [...event.latestRoundSelectedActorIds] }
      : {}),
    ...(event.latestRoundOmittedActorIds !== undefined
      ? { latestRoundOmittedActorIds: [...event.latestRoundOmittedActorIds] }
      : {}),
    ...(event.contributionKinds ? { contributionKinds: [...event.contributionKinds] } : {}),
  };
}
