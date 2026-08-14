import type { ProviderExecutionAuditEvent } from "../provider-sdk/execution-audit.js";

export interface ProviderContextMemoryTurn {
  key: string;
  sessionId: string;
  actorId: string;
  actorName: string;
  phase: ProviderExecutionAuditEvent["phase"];
  round: number;
  snapshotEventIds: string[];
  pinnedOpenIssueEventIds?: string[];
  latestRoundEventIds?: string[];
  observedAt: string;
  legacySelectionAudit: boolean;
}

export interface ProviderContextMemoryModel {
  turns: ProviderContextMemoryTurn[];
  pinnedTurnCount: number;
  legacyTurnCount: number;
}

/**
 * One deterministic memory-selection receipt per Provider turn. Selection is
 * recorded at turn_started, so later parse/repair/fallback stages cannot create
 * duplicate memory cards or retroactively change what the Provider saw.
 */
export function deriveProviderContextMemory(
  events: readonly ProviderExecutionAuditEvent[],
): ProviderContextMemoryModel {
  const byKey = new Map<string, ProviderContextMemoryTurn>();
  for (const event of events) {
    if (event.stage !== "turn_started") continue;
    const key = `${event.sessionId}|${event.actorId}|${event.phase}|${event.round}`;
    const pinned = event.pinnedOpenIssueEventIds;
    const latest = event.latestRoundEventIds;
    byKey.set(key, {
      key,
      sessionId: event.sessionId,
      actorId: event.actorId,
      actorName: event.providerName,
      phase: event.phase,
      round: event.round,
      snapshotEventIds: [...event.snapshotEventIds],
      ...(pinned ? { pinnedOpenIssueEventIds: [...pinned] } : {}),
      ...(latest ? { latestRoundEventIds: [...latest] } : {}),
      observedAt: event.observedAt,
      legacySelectionAudit: pinned === undefined || latest === undefined,
    });
  }
  const turns = [...byKey.values()].sort((a, b) =>
    a.round - b.round
      || phaseRank(a.phase) - phaseRank(b.phase)
      || a.actorName.localeCompare(b.actorName)
      || a.observedAt.localeCompare(b.observedAt),
  );
  return {
    turns,
    pinnedTurnCount: turns.filter((turn) => (turn.pinnedOpenIssueEventIds?.length ?? 0) > 0).length,
    legacyTurnCount: turns.filter((turn) => turn.legacySelectionAudit).length,
  };
}

function phaseRank(phase: ProviderExecutionAuditEvent["phase"]): number {
  if (phase === "sealed") return 0;
  if (phase === "debate") return 1;
  return 2;
}
