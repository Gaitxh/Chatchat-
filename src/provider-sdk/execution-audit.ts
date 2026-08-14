import type { CouncilContext, CouncilEventKind } from "../core/types.js";
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
  attempt?: 1 | 2;
  contributionKinds?: readonly CouncilEventKind[];
  error?: string;
  observedAt: string;
}

export type ProviderExecutionAuditSink = (
  event: ProviderExecutionAuditEvent,
) => void | Promise<void>;

/**
 * BrowserConsultationAgent uses this by default. In Node/core tests there is no
 * window, so the same code becomes a no-op without a second runtime contract.
 */
export const BROWSER_PROVIDER_EXECUTION_AUDIT: ProviderExecutionAuditSink = (event) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ProviderExecutionAuditEvent>(PROVIDER_EXECUTION_AUDIT_EVENT, {
    detail: cloneProviderExecutionAudit(event),
  }));
};

export function providerAuditBase(
  profile: ProviderProfile,
  context: CouncilContext,
): Omit<ProviderExecutionAuditEvent, "stage" | "observedAt"> {
  return {
    sessionId: context.sessionId,
    actorId: context.participant.id,
    providerId: profile.providerId,
    providerName: profile.displayName,
    phase: context.phase,
    round: context.round,
    snapshotEventIds: context.publicEvents.map((event) => event.id),
  };
}

export function cloneProviderExecutionAudit(event: ProviderExecutionAuditEvent): ProviderExecutionAuditEvent {
  return {
    ...event,
    snapshotEventIds: [...event.snapshotEventIds],
    ...(event.contributionKinds ? { contributionKinds: [...event.contributionKinds] } : {}),
  };
}
