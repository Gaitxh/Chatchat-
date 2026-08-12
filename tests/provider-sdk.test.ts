import { detectProviderUrl, normalizeHttpUrl } from "../src/provider-sdk/catalog.js";
import { createProviderProfile } from "../src/provider-sdk/profile.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const chatgpt = detectProviderUrl("chatgpt.com");
assert(chatgpt.kind === "known", "ChatGPT should be recognized as a built-in provider.");
assert(chatgpt.providerId === "openai-chatgpt", "ChatGPT provider id should be stable.");
assert(chatgpt.normalizedUrl.startsWith("https://"), "Scheme-less URLs should default to HTTPS.");
assert(chatgpt.manifest?.capabilities.councilTurns === true, "Built-in web providers should advertise the taught v0.9 Council Bridge.");

const claude = detectProviderUrl("https://claude.ai/new");
assert(claude.adapterId === "web.claude", "Claude URL should select the Claude adapter id.");

const custom = detectProviderUrl("https://mycompany-ai.example.com/chat");
assert(custom.kind === "custom", "Unknown hosts should become custom provider profiles.");
assert(custom.adapterId === "custom.browser", "Unknown hosts should use the generic taught browser adapter.");

const knownProfile = createProviderProfile({ url: "https://gemini.google.com/app" });
assert(knownProfile.authState === "login_required", "Known web providers should wait for local login and Council Gate.");
assert(knownProfile.seatState === "bench", "New advisors should wait on the bench before seating.");

const customProfile = createProviderProfile({ url: "https://ai.example.org" });
assert(customProfile.authState === "login_required", "Custom http(s) providers should be allowed into the same local Teach/Gate flow.");
assert(customProfile.adapterId === "custom.browser", "Custom profiles should retain the generic browser adapter id.");
assert(customProfile.profileKey !== knownProfile.profileKey, "Every provider profile needs a unique isolation key.");

let rejected = false;
try {
  normalizeHttpUrl("file:///etc/passwd");
} catch {
  rejected = true;
}
assert(rejected, "Non-http(s) provider URLs must be rejected.");

console.log("✓ ChatChat provider-sdk tests passed");
