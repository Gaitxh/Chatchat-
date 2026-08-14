import type { CouncilContext, CouncilEventKind } from "../core/types.js";
import type { ProviderProfile } from "./types.js";

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

export const NOOP_PROVIDER_EXECUTION_AUDIT: ProviderExecutionAuditSink = () => undefined;

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
