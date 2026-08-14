import type { CouncilPhase } from "../core/types.js";

export const PROVIDER_TRANSPORT_AUDIT_EVENT = "chatchat:provider-transport";
export type ProviderExecutionMode = "synthetic-showcase" | "live-provider-tabs";
export type ProviderTransportAuditState = "sending" | "received" | "failed";

export interface ProviderTransportAuditRecord {
  sessionId: string;
  actorId: string;
  phase: CouncilPhase | "consultation";
  round: number;
  state: ProviderTransportAuditState;
  mode: ProviderExecutionMode;
  observedAt: string;
  snapshotEventIds: readonly string[];
  pinnedOpenIssueEventIds?: readonly string[];
  latestRoundEventIds?: readonly string[];
  repairAttempt: boolean;
  tabId: number;
  promptChars: number;
  responseChars?: number;
  elapsedMs?: number;
  error?: string;
  host?: string;
  title?: string;
}

const MAX_BUFFERED_RECORDS = 720;
const buffer: ProviderTransportAuditRecord[] = [];

export function recordProviderTransportAudit(record: ProviderTransportAuditRecord): void {
  const copy = cloneProviderTransportAudit(record);
  buffer.push(copy);
  if (buffer.length > MAX_BUFFERED_RECORDS) buffer.splice(0, buffer.length - MAX_BUFFERED_RECORDS);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<ProviderTransportAuditRecord>(PROVIDER_TRANSPORT_AUDIT_EVENT, {
      detail: copy,
    }));
  }
}

export function providerTransportAuditSnapshot(sessionId: string): ProviderTransportAuditRecord[] {
  return buffer
    .filter((record) => record.sessionId === sessionId)
    .map(cloneProviderTransportAudit);
}

export function cloneProviderTransportAudit(record: ProviderTransportAuditRecord): ProviderTransportAuditRecord {
  return {
    ...record,
    snapshotEventIds: [...record.snapshotEventIds],
    ...(record.pinnedOpenIssueEventIds ? { pinnedOpenIssueEventIds: [...record.pinnedOpenIssueEventIds] } : {}),
    ...(record.latestRoundEventIds ? { latestRoundEventIds: [...record.latestRoundEventIds] } : {}),
  };
}
