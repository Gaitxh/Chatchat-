// The browser side panel originally imported the stable Council wire API.
// Keep the same exported names at the extension boundary so the strict parser
// remains compatible while the runtime prompt/agent semantics are now an
// equal-participant consultation rather than a hierarchical council.
export {
  BrowserConsultationAgent as BrowserCouncilAgent,
  buildProviderConsultationPrompt as buildProviderCouncilPrompt,
} from "../provider-sdk/consultation-agent.js";

export { parseProviderCouncilResponse } from "../provider-sdk/council-agent.js";
