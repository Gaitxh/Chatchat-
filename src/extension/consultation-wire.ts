// Compatibility names for the stable browser wire shape. Product semantics
// live in the equal-participant Consultation layer.
export {
  BrowserConsultationAgent as BrowserCouncilAgent,
  buildProviderConsultationPrompt as buildProviderCouncilPrompt,
} from "../provider-sdk/consultation-agent.js";

export {
  parseProviderConsultationResponse as parseProviderCouncilResponse,
} from "../provider-sdk/consultation-protocol.js";
