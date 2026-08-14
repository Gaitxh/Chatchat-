import {
  deriveConnectionExperience,
  likelyLoginPage,
} from "../src/extension/login-awareness.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

assert(likelyLoginPage({ url: "https://chatgpt.com/auth/login" }), "auth/login URL should be recognized");
assert(likelyLoginPage({ url: "https://accounts.google.com/v3/signin" }), "account host should be recognized");
assert(likelyLoginPage({ url: "https://claude.ai/", passwordInputs: 1 }), "password input should be a strong login signal");
assert(likelyLoginPage({ url: "https://example.ai/", authActionPresent: true, chatComposerPresent: false }), "auth action without a composer should be treated as login-like");
assert(!likelyLoginPage({ url: "https://chatgpt.com/", authActionPresent: false, chatComposerPresent: true }), "an active chat composer must not be classified as login");

assert(deriveConnectionExperience({ connectionState: "idle" }) === "preparing", "idle should be humanized as preparing");
assert(deriveConnectionExperience({ connectionState: "connecting" }) === "connecting", "connecting should stay connecting");
assert(deriveConnectionExperience({ connectionState: "failed", recovering: true }) === "recovering", "navigation-triggered retry should be visible as recovering");
assert(deriveConnectionExperience({ connectionState: "failed", probe: { url: "https://auth.openai.com/" } }) === "login_required", "failed auth page should ask for login");
assert(deriveConnectionExperience({ connectionState: "failed", probe: { url: "https://chatgpt.com/", chatComposerPresent: true } }) === "needs_attention", "non-login failures should not be mislabeled as login");
assert(deriveConnectionExperience({ connectionState: "ready", recovering: true }) === "ready", "READY must win over transient recovery state");

console.log("✓ ChatChat login-aware connection state tests passed");
