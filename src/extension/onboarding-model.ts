export type RoyalOnboardingAct = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface OnboardingDelegationReadiness {
  delegationId: string;
  providerName: string;
  recipeProgress: number;
  seatCount: number;
  readyCount: number;
}

export interface OnboardingRuntimeSummary {
  seatCount: number;
  readySeatCount: number;
  delegations: OnboardingDelegationReadiness[];
  councilComplete: boolean;
  eventCount: number;
  revisionCount: number;
  minorityOpinionPresent: boolean;
}

export interface PersistedRoyalOnboardingState {
  version: 1;
  completed: boolean;
  act: RoyalOnboardingAct;
  dismissed: boolean;
}

export const DEFAULT_ONBOARDING_STATE: PersistedRoyalOnboardingState = {
  version: 1,
  completed: false,
  act: 1,
  dismissed: false,
};

/**
 * Runtime truth may advance the guide, but never skips validation gates.
 *
 * Acts:
 * 1 Welcome
 * 2 Discover/select
 * 3 Summoning in progress
 * 4 Teach/Test/Gate
 * 5 House admitted
 * 6 First Council
 * 7 First Council complete
 */
export function deriveOnboardingAct(
  persisted: PersistedRoyalOnboardingState,
  runtime: OnboardingRuntimeSummary,
): RoyalOnboardingAct {
  if (runtime.councilComplete && runtime.readySeatCount >= 2) return 7;
  if (runtime.readySeatCount >= 2) return Math.max(persisted.act, 5) as RoyalOnboardingAct;
  if (runtime.seatCount > 0) return Math.max(Math.min(persisted.act, 4), 4) as RoyalOnboardingAct;
  return persisted.act;
}

export function totalReadySeats(delegations: readonly OnboardingDelegationReadiness[]): number {
  return delegations.reduce((sum, item) => sum + item.readyCount, 0);
}

export function validationProgress(delegation: OnboardingDelegationReadiness): number {
  const recipe = Math.max(0, Math.min(3, delegation.recipeProgress));
  const seatRuntime = delegation.seatCount > 0
    ? Math.min(2, (delegation.readyCount / delegation.seatCount) * 2)
    : 0;
  return Math.round(((recipe + seatRuntime) / 5) * 100);
}

export function selectedOriginPatterns(
  candidates: readonly { tabId: number; origin: string }[],
  selectedTabIds: ReadonlySet<number>,
): string[] {
  return [...new Set(
    candidates
      .filter((candidate) => selectedTabIds.has(candidate.tabId))
      .map((candidate) => `${candidate.origin}/*`),
  )].sort();
}

export function firstCouncilCelebration(runtime: OnboardingRuntimeSummary) {
  return {
    structuredEvents: Math.max(0, runtime.eventCount),
    changedMinds: Math.max(0, runtime.revisionCount),
    minorityOpinionPresent: runtime.minorityOpinionPresent,
  };
}
