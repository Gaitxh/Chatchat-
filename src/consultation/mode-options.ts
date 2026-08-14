import type {
  CouncilConsultationMode,
  CouncilParticipant,
  CouncilRunOptions,
} from "../core/types.js";
import { consultationModeRunPolicy } from "./mode-policy.js";
import { consultationResearchLaneAssignments } from "./research-lanes.js";

export function applyConsultationModePolicy(
  mode: CouncilConsultationMode,
  options: CouncilRunOptions = {},
  participants: readonly CouncilParticipant[] = [],
): CouncilRunOptions {
  const policy = consultationModeRunPolicy(mode);
  const generatedLanes = consultationResearchLaneAssignments(mode, participants);
  const researchLaneAssignments = options.researchLaneAssignments ?? generatedLanes;
  return {
    ...options,
    mode,
    maxRounds: policy.maxRounds,
    minDebateRounds: policy.minDebateRounds,
    convergenceThreshold: policy.convergenceThreshold,
    ...(Object.keys(researchLaneAssignments).length ? { researchLaneAssignments } : {}),
  };
}