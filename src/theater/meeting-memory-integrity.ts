import type { ProviderMemoryCoverageModel } from "./provider-memory-coverage.js";
import type { ProviderMemoryGapModel } from "./provider-memory-gaps.js";

export type MeetingMemoryProtocolState =
  | "verified"
  | "bounded_coverage"
  | "selector_drift"
  | "peer_fairness_violation";

export type MeetingMemoryEvidenceStrength =
  | "none"
  | "actual_prompt"
  | "mixed"
  | "selector_audit";

export interface MeetingMemoryIntegrity {
  protocolState: MeetingMemoryProtocolState;
  evidenceStrength: MeetingMemoryEvidenceStrength;
  contextBudget: number;
  auditedTurns: number;
  actualPromptTurns: number;
  auditedRounds: number;
  pinnedRounds: number;
  peerMismatchRounds: number;
  selectorMismatchTurns: number;
  gapTurns: number;
  uniqueGapSourceEventIds: string[];
  gapSetMismatchRounds: number;
}

/**
 * Summarize memory-protocol facts without mixing them into stance alignment,
 * answer confidence, answer correctness or a synthetic composite score.
 */
export function deriveMeetingMemoryIntegrity(
  coverage: ProviderMemoryCoverageModel,
  gaps: ProviderMemoryGapModel,
): MeetingMemoryIntegrity {
  const peerMismatchRounds = coverage.rounds.filter((round) => !round.snapshotsConsistent).length;
  const gapSetMismatchRounds = gaps.rounds.filter((round) => !round.allSeatsSameGapSet).length;
  const protocolState: MeetingMemoryProtocolState =
    peerMismatchRounds > 0 || gapSetMismatchRounds > 0
      ? "peer_fairness_violation"
      : coverage.selectorMismatchTurnCount > 0
        ? "selector_drift"
        : gaps.gapTurnCount > 0
          ? "bounded_coverage"
          : "verified";

  return {
    protocolState,
    evidenceStrength: evidenceStrength(coverage),
    contextBudget: coverage.contextBudget,
    auditedTurns: coverage.turns.length,
    actualPromptTurns: coverage.actualPromptTurnCount,
    auditedRounds: coverage.rounds.length,
    pinnedRounds: coverage.roundsWithPinnedMemory,
    peerMismatchRounds,
    selectorMismatchTurns: coverage.selectorMismatchTurnCount,
    gapTurns: gaps.gapTurnCount,
    uniqueGapSourceEventIds: [...gaps.uniqueGapSourceEventIds],
    gapSetMismatchRounds,
  };
}

function evidenceStrength(coverage: ProviderMemoryCoverageModel): MeetingMemoryEvidenceStrength {
  if (!coverage.turns.length) return "none";
  if (coverage.actualPromptTurnCount === coverage.turns.length) return "actual_prompt";
  if (coverage.actualPromptTurnCount === 0) return "selector_audit";
  return "mixed";
}
