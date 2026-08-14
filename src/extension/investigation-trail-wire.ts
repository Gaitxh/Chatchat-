import type { PendingInvestigationFollowUp } from "../history/investigation-trail.js";

export const INVESTIGATION_FOLLOW_UP_STAGED_EVENT = "chatchat:investigation-follow-up-staged";
export const INVESTIGATION_FOLLOW_UP_CLEAR_EVENT = "chatchat:investigation-follow-up-clear";
export const INVESTIGATION_FOLLOW_UP_CHANGED_EVENT = "chatchat:investigation-follow-up-changed";
export const INVESTIGATION_TRAIL_UPDATED_EVENT = "chatchat:investigation-trail-updated";

export interface InvestigationFollowUpChangedDetail {
  pending: PendingInvestigationFollowUp | null;
}

export function stageInvestigationFollowUp(pending: PendingInvestigationFollowUp): void {
  window.dispatchEvent(new CustomEvent<PendingInvestigationFollowUp>(INVESTIGATION_FOLLOW_UP_STAGED_EVENT, {
    detail: pending,
  }));
}

export function clearInvestigationFollowUp(): void {
  window.dispatchEvent(new Event(INVESTIGATION_FOLLOW_UP_CLEAR_EVENT));
}

export function announceInvestigationFollowUpChanged(
  pending: PendingInvestigationFollowUp | null,
): void {
  window.dispatchEvent(new CustomEvent<InvestigationFollowUpChangedDetail>(INVESTIGATION_FOLLOW_UP_CHANGED_EVENT, {
    detail: { pending },
  }));
}

export function announceInvestigationTrailUpdated(): void {
  window.dispatchEvent(new Event(INVESTIGATION_TRAIL_UPDATED_EVENT));
}
