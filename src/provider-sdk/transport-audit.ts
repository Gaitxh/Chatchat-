import type { CouncilPhase } from "../core/types.js";
import { providerPromptMemorySelectionFor } from "./prompt-memory-audit.js";

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
  /** True only when category metadata was parsed from the actual RUN_SPEECH prompt. */
  promptMemoryObserved?: true;
  pinnedOpenIssueEventIds?: readonly string[];
  pinnedIssueSourceEventIds?: readonly string[];
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
  // A lightweight prompt observer remembers metadata from the exact RUN_SPEECH
  // string. Enrich any later receipt for the same first/repair attempt from that
  // independent observation. The outgoing `sending` receipt is allowed to lack
  // this proof if the inner observer has not executed yet; received/failed will
  // carry it once the exact Prompt has passed through the browser API.
  const promptSelection = providerPromptMemorySelectionFor(record);
  const enriched: ProviderTransportAuditRecord = promptSelection
    ? {
        ...record,
        promptMemoryObserved: true,
        snapshotEventIds: [...promptSelection.snapshotEventIds],
        pinnedOpenIssueEventIds: [...promptSelection.pinnedOpenIssueEventIds],
        pinnedIssueSourceEventIds: [...promptSelection.pinnedIssueSourceEventIds],
        latestRoundEventIds: [...promptSelection.latestRoundEventIds],
      }
    : record;
  const copy = cloneProviderTransportAudit(enriched);
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
    ...(record.pinnedOpenIssueEventIds !== undefined
      ? { pinnedOpenIssueEventIds: [...record.pinnedOpenIssueEventIds] }
      : {}),
    ...(record.pinnedIssueSourceEventIds !== undefined
      ? { pinnedIssueSourceEventIds: [...record.pinnedIssueSourceEventIds] }
      : {}),
    ...(record.latestRoundEventIds !== undefined
      ? { latestRoundEventIds: [...record.latestRoundEventIds] }
      : {}),
  };
}
