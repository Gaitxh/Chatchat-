import {
  classifyProviderRecoveryFailure,
  planProviderRecovery,
} from "../src/extension/provider-recovery.js";
import type { ProviderPageInspection } from "../src/extension/provider-page-inspection.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const mappingFailures = [
  "Automatic page setup could not identify the message input.",
  "Automatic page setup could not identify the send control.",
  "Automatic page setup found a send control, but it did not become usable after filling the message.",
  "Automatic page setup did not produce a complete browser recipe.",
];
for (const detail of mappingFailures) {
  assert(classifyProviderRecoveryFailure(detail) === "automatic_page_mapping_drift", `Current mapping failure must be recoverable: ${detail}`);
}

for (const detail of [
  "Automatic connection handshake did not return CHATCHAT_READY.",
  "Consultation Protocol Gate did not return READY.",
  "Structured response did not declare READY.",
  "Timed out waiting for Provider response.",
  "Network request failed.",
]) {
  assert(classifyProviderRecoveryFailure(detail) === "not_recoverable", `Non-mapping failure must never trigger page reset: ${detail}`);
}

const healthyInspection: ProviderPageInspection = {
  url: "https://chatgpt.com/c/clean",
  title: "ChatGPT",
  urlMatchesProvider: true,
  passwordInputs: 0,
  loginControls: 0,
  composerCandidates: 1,
  requiresLogin: false,
};

const allowed = planProviderRecovery({
  failure: "automatic_page_mapping_drift",
  attempted: false,
  createdByChatChat: true,
  participantOrigin: "https://chatgpt.com",
  startUrl: "https://chatgpt.com/",
  inspection: healthyInspection,
});
assert(allowed.kind === "navigate_clean_start" && allowed.url === "https://chatgpt.com/", "ChatChat-owned clean tab with mapping drift gets one fresh start.");

assert(planProviderRecovery({
  failure: "not_recoverable",
  attempted: false,
  createdByChatChat: true,
  participantOrigin: "https://chatgpt.com",
  startUrl: "https://chatgpt.com/",
  inspection: healthyInspection,
}).kind === "none", "Protocol/network failures must not be disguised as page drift.");

assert(planProviderRecovery({
  failure: "automatic_page_mapping_drift",
  attempted: true,
  createdByChatChat: true,
  participantOrigin: "https://chatgpt.com",
  startUrl: "https://chatgpt.com/",
  inspection: healthyInspection,
}).kind === "none", "Same recovery episode gets at most one navigation.");

assert(planProviderRecovery({
  failure: "automatic_page_mapping_drift",
  attempted: false,
  createdByChatChat: false,
  participantOrigin: "https://chatgpt.com",
  startUrl: "https://chatgpt.com/",
  inspection: healthyInspection,
}).kind === "none", "User-owned Provider tabs are never automatically navigated.");

assert(planProviderRecovery({
  failure: "automatic_page_mapping_drift",
  attempted: false,
  createdByChatChat: true,
  participantOrigin: "https://chatgpt.com",
  startUrl: "https://chatgpt.com/",
  inspection: { ...healthyInspection, requiresLogin: true, passwordInputs: 1, composerCandidates: 0 },
}).kind === "none", "Login pages remain owned by Login Concierge.");

assert(planProviderRecovery({
  failure: "automatic_page_mapping_drift",
  attempted: false,
  createdByChatChat: true,
  participantOrigin: "https://chatgpt.com",
  startUrl: "https://chatgpt.com/",
  inspection: { ...healthyInspection, urlMatchesProvider: false, url: "https://example.com/" },
}).kind === "none", "Off-origin tabs fail closed.");

assert(planProviderRecovery({
  failure: "automatic_page_mapping_drift",
  attempted: false,
  createdByChatChat: true,
  participantOrigin: "https://chatgpt.com",
  inspection: healthyInspection,
}).kind === "none", "Recovery requires an explicit clean Provider start URL.");

assert(planProviderRecovery({
  failure: "automatic_page_mapping_drift",
  attempted: false,
  createdByChatChat: true,
  participantOrigin: "https://chatgpt.com",
  startUrl: "https://claude.ai/new",
  inspection: healthyInspection,
}).kind === "none", "Clean start URL must stay on the participant Provider origin.");

console.log("✓ ChatChat Provider recovery boundary tests passed");
