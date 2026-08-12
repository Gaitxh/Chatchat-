import { detectProviderUrl, normalizeHttpUrl } from "../src/provider-sdk/catalog.js";
import { createProviderProfile } from "../src/provider-sdk/profile.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const chatgpt = detectProviderUrl("chatgpt.com");
assert(chatgpt.kind === "known", "ChatGPT should be recognized as a built-in provider.");
assert(chatgpt.providerId === "openai-chatgpt", "ChatGPT provider id should be stable.");
assert(chatgpt.normalizedUrl.startsWith("https://"), "Scheme-less URLs should default to HTTPS.");

const claude = detectProviderUrl("https://claude.ai/new");
assert(claude.adapterId === "web.claude", "Claude URL should select the Claude adapter id.");

const custom = detectProviderUrl("https://mycompany-ai.example.com/chat");
assert(custom.kind === "custom", "Unknown hosts should become custom provider profiles.");
assert(custom.adapterId === "custom.browser", "Unknown hosts should use the custom adapter placeholder.");

const knownProfile = createProviderProfile({ url: "https://gemini.google.com/app" });
assert(knownProfile.authState === "login_required", "Known web providers should wait for login.");
assert(knownProfile.seatState === "bench", "New advisors should wait on the bench before seating.");

const customProfile = createProviderProfile({ url: "https://ai.example.org" });
assert(customProfile.authState === "adapter_required", "Custom providers need an adapter before login.");
assert(customProfile.profileKey !== knownProfile.profileKey, "Every provider profile needs a unique isolation key.");

let rejected = false;
try {
  normalizeHttpUrl("file:///etc/passwd");
} catch {
  rejected = true;
}
assert(rejected, "Non-http(s) provider URLs must be rejected.");

console.log("✓ ChatChat provider-sdk tests passed");
