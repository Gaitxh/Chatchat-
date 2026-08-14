import type { CouncilConsultationMode } from "../core/types.js";

export const PROPOSAL_MODE_STORAGE_KEY = "chatchat.consultation.mode.v1";
export const PROPOSAL_MODE_SELECT_EVENT = "chatchat:proposal-mode-select";
export const PROPOSAL_MODE_CHANGED_EVENT = "chatchat:proposal-mode-changed";

export interface ProposalModeSelectionDetail {
  mode: CouncilConsultationMode;
  source?: "user" | "next-move" | "restore";
}

export function isConsultationMode(value: unknown): value is CouncilConsultationMode {
  return value === "balanced"
    || value === "explore"
    || value === "decide"
    || value === "verify"
    || value === "stress_test";
}

export function requestProposalMode(
  mode: CouncilConsultationMode,
  source: ProposalModeSelectionDetail["source"] = "user",
): void {
  window.dispatchEvent(new CustomEvent<ProposalModeSelectionDetail>(PROPOSAL_MODE_SELECT_EVENT, {
    detail: { mode, source },
  }));
}

export function announceProposalMode(
  mode: CouncilConsultationMode,
  source: ProposalModeSelectionDetail["source"] = "user",
): void {
  window.dispatchEvent(new CustomEvent<ProposalModeSelectionDetail>(PROPOSAL_MODE_CHANGED_EVENT, {
    detail: { mode, source },
  }));
}
