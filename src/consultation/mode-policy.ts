import type { CouncilConsultationMode } from "../core/types.js";

export interface ConsultationModeRunPolicy {
  maxRounds: number;
  minDebateRounds: number;
  convergenceThreshold: number;
}

const POLICIES: Record<CouncilConsultationMode, ConsultationModeRunPolicy> = {
  balanced: { maxRounds: 3, minDebateRounds: 1, convergenceThreshold: 0.75 },
  explore: { maxRounds: 3, minDebateRounds: 2, convergenceThreshold: 1 },
  decide: { maxRounds: 3, minDebateRounds: 1, convergenceThreshold: 0.75 },
  verify: { maxRounds: 3, minDebateRounds: 2, convergenceThreshold: 0.9 },
  stress_test: { maxRounds: 4, minDebateRounds: 2, convergenceThreshold: 0.9 },
};

export function consultationModeRunPolicy(
  mode: CouncilConsultationMode | undefined,
): ConsultationModeRunPolicy {
  return POLICIES[mode ?? "balanced"];
}
