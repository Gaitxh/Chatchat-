// Compatibility layer for older imports. The active product is the equal-
// participant Browser Consultation flow; there is no desktop transport here.
export {
  BrowserConsultationAgent as BrowserCouncilAgent,
  buildProviderConsultationPrompt as buildProviderCouncilPrompt,
} from "./consultation-agent.js";

export {
  parseProviderConsultationResponse as parseProviderCouncilResponse,
} from "./consultation-protocol.js";

export type {
  ProviderConsultationTransportResult as ProviderCouncilTransportResult,
  ProviderConsultationTransport as ProviderCouncilTransport,
  ProviderConsultationSessionPreparer as ProviderCouncilSessionPreparer,
} from "./consultation-protocol.js";

export interface CouncilBridgeVerificationResult {
  ok: true;
  contributionCount: number;
  elapsedMs: number;
}
