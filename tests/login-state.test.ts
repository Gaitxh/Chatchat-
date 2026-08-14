import { classifyLoginState } from "../src/extension/login-state.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

assert(
  classifyLoginState({
    expectedOrigin: "https://gemini.google.com",
    currentUrl: "https://accounts.google.com/v3/signin/identifier",
    title: "Sign in – Google accounts",
  }) === "needs_login",
  "Google account redirects should be treated as login, not provider breakage.",
);

assert(
  classifyLoginState({
    expectedOrigin: "https://claude.ai",
    currentUrl: "https://claude.ai/login?returnTo=%2Fnew",
    title: "Log in to Claude",
  }) === "needs_login",
  "Same-origin login routes should be recognized.",
);

assert(
  classifyLoginState({
    expectedOrigin: "https://chatgpt.com",
    currentUrl: "https://chatgpt.com/",
    title: "ChatGPT",
    passwordInputs: 1,
    loginControls: 2,
    composerCandidates: 0,
  }) === "needs_login",
  "A password form without an AI composer should be recognized as login.",
);

assert(
  classifyLoginState({
    expectedOrigin: "https://chatgpt.com",
    currentUrl: "https://chatgpt.com/",
    title: "ChatGPT",
    passwordInputs: 0,
    loginControls: 0,
    composerCandidates: 1,
  }) === "not_login",
  "A normal AI conversation page must not be mislabeled as login.",
);

assert(
  classifyLoginState({
    expectedOrigin: "https://claude.ai",
    currentUrl: "https://claude.ai/new",
    title: "Claude",
    passwordInputs: 0,
    loginControls: 1,
    composerCandidates: 1,
  }) === "not_login",
  "A page that already exposes a composer should not be treated as login just because it has an account control.",
);

console.log("✓ ChatChat login-state classification tests passed");
