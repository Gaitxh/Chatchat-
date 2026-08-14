import type { CouncilEvent, CouncilPhase } from "../core/types.js";
import type { ProviderExecutionAuditEvent } from "../provider-sdk/execution-audit.js";

export const PROVIDER_EXECUTION_AUDIT_EVENT = "chatchat:provider-execution-audit";
export const PROVIDER_PUBLICATION_AUDIT_EVENT = "chatchat:provider-publication-audit";

export interface ProviderExecutionAuditDetail extends ProviderExecutionAuditEvent {
  tabId: number;
  host: string;
}

export interface ProviderPublicationAuditDetail {
  sessionId: string;
  actorId: string;
  phase: CouncilPhase;
  round: number;
  eventId: string;
  eventKind: CouncilEvent["kind"];
  observedAt: string;
}

export function publishProviderExecutionAudit(detail: ProviderExecutionAuditDetail): void {
  window.dispatchEvent(new CustomEvent<ProviderExecutionAuditDetail>(PROVIDER_EXECUTION_AUDIT_EVENT, { detail }));
}

export function publishProviderEventAudit(event: CouncilEvent): void {
  const phase: CouncilPhase = event.kind === "final_position"
    ? "final"
    : event.round === 1
      ? "sealed"
      : "debate";
  const detail: ProviderPublicationAuditDetail = {
    sessionId: event.sessionId,
    actorId: event.actorId,
    phase,
    round: event.round,
    eventId: event.id,
    eventKind: event.kind,
    observedAt: new Date().toISOString(),
  };
  window.dispatchEvent(new CustomEvent<ProviderPublicationAuditDetail>(PROVIDER_PUBLICATION_AUDIT_EVENT, { detail }));
}
