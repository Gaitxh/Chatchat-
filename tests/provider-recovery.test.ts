import {
  RECOVERABLE_AUTO_SETUP_FAILURES,
  classifyProviderRecoveryFailure,
  planProviderRecovery,
} from "../src/extension/provider-recovery.js";
import type { ProviderPageInspection } from "../src/extension/provider-page-inspection.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

for (const failure of RECOVERABLE_AUTO_SETUP_FAILURES) {
  assert(
    classifyProviderRecoveryFailure(failure) === "automatic_page_mapping_drift",
    `current AUTO_SETUP mapping failure should be recoverable: ${failure}`,
  );
}

for (const failure of [
  "The AI page did not return the automatic ChatChat connection reply in time.",
  "Automatic connection handshake did not return CHATCHAT_READY.",
  "Consultation protocol returned valid structured data but did not declare stance READY.",
  "Provider tab did not answer ChatChat.",
  "Network error",
]) {
  assert(
    classifyProviderRecoveryFailure(failure) === "not_recoverable",
    `transport/protocol failure must never trigger navigation: ${failure}`,
  );
}

const usable: ProviderPageInspection = {
  currentUrl: "https://claude.ai/new",
  title: "Claude",
  urlMatchesProvider: true,
  passwordInputs: 0,
  loginControls: 0,
  composerCandidates: 1,
  loginState: "not_login",
};

const safe = planProviderRecovery({
  failure: "automatic_page_mapping_drift",
  createdByChatChat: true,
  participantOrigin: "https://claude.ai",
  startUrl: "https://claude.ai/",
  inspection: usable,
});
assert(safe.kind === "navigate_clean_start" && safe.url === "https://claude.ai/", "ChatChat-owned same-origin mapping drift should get exactly one clean-start recovery opportunity.");

const userOwned = planProviderRecovery({
  failure: "automatic_page_mapping_drift",
  createdByChatChat: false,
  participantOrigin: "https://claude.ai",
  startUrl: "https://claude.ai/",
  inspection: usable,
});
assert(userOwned.kind === "none" && userOwned.reason === "user_owned_tab", "ChatChat must never navigate a user's own Provider conversation.");

const login = planProviderRecovery({
  failure: "automatic_page_mapping_drift",
  createdByChatChat: true,
  participantOrigin: "https://gemini.google.com",
  startUrl: "https://gemini.google.com/app",
  inspection: {
    ...usable,
    currentUrl: "https://accounts.google.com/v3/signin/identifier",
    urlMatchesProvider: false,
    composerCandidates: 0,
    loginState: "needs_login",
  },
});
assert(login.kind === "none" && login.reason === "login_owned_by_concierge", "Login Concierge must own authentication instead of self-healing navigation.");

const wrongOrigin = planProviderRecovery({
  failure: "automatic_page_mapping_drift",
  createdByChatChat: true,
  participantOrigin: "https://claude.ai",
  startUrl: "https://claude.ai/",
  inspection: { ...usable, currentUrl: "https://example.com/", urlMatchesProvider: false },
});
assert(wrongOrigin.kind === "none" && wrongOrigin.reason === "wrong_provider_origin", "Unexpected cross-origin pages must fail closed.");

const unsafeStart = planProviderRecovery({
  failure: "automatic_page_mapping_drift",
  createdByChatChat: true,
  participantOrigin: "https://claude.ai",
  startUrl: "https://example.com/",
  inspection: usable,
});
assert(unsafeStart.kind === "none" && unsafeStart.reason === "no_clean_start_url", "Recovery start URL must remain on the participant Provider origin.");

const unrelated = planProviderRecovery({
  failure: "not_recoverable",
  createdByChatChat: true,
  participantOrigin: "https://claude.ai",
  startUrl: "https://claude.ai/",
  inspection: usable,
});
assert(unrelated.kind === "none" && unrelated.reason === "not_mapping_drift", "Non-mapping failures must never self-heal by navigation.");

console.log("✓ ChatChat bounded Provider self-healing policy tests passed");
