// The browser Side Panel keeps the stable structured wire shape while its
// participant semantics come from the equal-AI Consultation layer.
export {
  BrowserConsultationAgent as BrowserCouncilAgent,
  buildProviderConsultationPrompt as buildProviderCouncilPrompt,
} from "../provider-sdk/consultation-agent.js";

// Import the parser through a path that is not rewritten by the extension
// consultation alias. This avoids a circular re-export while preserving the
// strict, already-tested CHATCHAT_COUNCIL_JSON validation contract.
export { parseProviderCouncilResponse } from "../provider-sdk/council-parser.js";
