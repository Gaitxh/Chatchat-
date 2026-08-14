import type {
  CouncilConsultationMode,
  CouncilRunOptions,
} from "../core/types.js";
import { consultationModeRunPolicy } from "./mode-policy.js";

export function applyConsultationModePolicy(
  mode: CouncilConsultationMode,
  options: CouncilRunOptions = {},
): CouncilRunOptions {
  const policy = consultationModeRunPolicy(mode);
  return {
    ...options,
    mode,
    maxRounds: policy.maxRounds,
    minDebateRounds: policy.minDebateRounds,
    convergenceThreshold: policy.convergenceThreshold,
  };
}
