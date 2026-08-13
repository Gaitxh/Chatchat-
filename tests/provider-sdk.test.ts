import {
  BUILT_IN_PROVIDER_MANIFESTS,
  detectProviderUrl,
  normalizeHttpUrl,
} from "../src/provider-sdk/catalog.js";
import { createProviderProfile } from "../src/provider-sdk/profile.js";
import { providerCouncilStartUrl } from "../src/provider-sdk/session-runtime.js";

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

const gemini = detectProviderUrl("https://gemini.google.com/app?hl=zh");
assert(gemini.adapterId === "web.gemini", "Gemini app URLs should remain recognized.");

const deepseek = detectProviderUrl("https://chat.deepseek.com/");
assert(deepseek.providerId === "deepseek-chat", "DeepSeek chat should remain recognized.");

const qwen = detectProviderUrl("https://chat.qwen.ai/");
assert(qwen.kind === "known", "Qwen Studio should be a first-class provider.");
assert(qwen.adapterId === "web.qwen", "Qwen should select the Qwen adapter id.");
assert(qwen.providerId === "qwen-chat", "Qwen provider id should remain stable.");

// These deliberately use synthetic path/query identifiers. Do not commit a user's
// real conversation/session id just to prove host-level provider recognition.
const yuanbao = detectProviderUrl(
  "https://yuanbao.tencent.com/chat/example-room/example-session",
);
assert(yuanbao.kind === "known", "Tencent Yuanbao should be a first-class provider.");
assert(yuanbao.adapterId === "web.yuanbao", "Yuanbao should select the Yuanbao adapter id.");
assert(yuanbao.providerId === "tencent-yuanbao", "Yuanbao provider id should be stable.");

const tongyi = detectProviderUrl(
  "https://tongyi.aliyun.com/?sessionId=example-session",
);
assert(tongyi.kind === "known", "Alibaba Tongyi should be a first-class provider.");
assert(tongyi.adapterId === "web.tongyi", "Tongyi should select the Tongyi adapter id.");
assert(tongyi.providerId === "alibaba-tongyi", "Tongyi provider id should be stable.");

const grok = detectProviderUrl("https://grok.com/");
assert(grok.kind === "known", "Grok should be a first-class provider.");
assert(grok.adapterId === "web.grok", "Grok should select the Grok adapter id.");
assert(grok.providerId === "xai-grok", "Grok provider id should be stable.");

assert(
  BUILT_IN_PROVIDER_MANIFESTS.length >= 8,
  "The built-in catalog should expose the expanded advisor roster including Qwen.",
);
assert(
  BUILT_IN_PROVIDER_MANIFESTS.every((manifest) => manifest.capabilities.councilTurns),
  "Every built-in catalog entry should use the same taught Browser Council Bridge contract.",
);

const custom = detectProviderUrl("https://mycompany-ai.example.com/chat");
assert(custom.kind === "custom", "Unknown hosts should become custom provider profiles.");
assert(custom.adapterId === "custom.browser", "Unknown hosts should use the generic taught browser adapter.");

const knownProfile = createProviderProfile({ url: "https://gemini.google.com/app" });
assert(knownProfile.authState === "login_required", "Known web providers should wait for local login and Council Gate.");
assert(knownProfile.seatState === "bench", "New advisors should wait on the bench before seating.");

const qwenProfile = createProviderProfile({ url: "https://chat.qwen.ai/c/example" });
assert(
  providerCouncilStartUrl(qwenProfile) === "https://chat.qwen.ai/",
  "Built-in Qwen Councils should start from the official Studio landing page instead of reopening an old conversation path.",
);

const yuanbaoProfile = createProviderProfile({
  url: "https://yuanbao.tencent.com/chat/example-room/example-session",
});
assert(
  providerCouncilStartUrl(yuanbaoProfile) === "https://yuanbao.tencent.com/",
  "Built-in Yuanbao Councils should start from the catalog landing page rather than reopening an old conversation.",
);

const tongyiProfile = createProviderProfile({
  url: "https://tongyi.aliyun.com/?sessionId=example-session",
});
assert(
  providerCouncilStartUrl(tongyiProfile) === "https://tongyi.aliyun.com/",
  "Built-in Tongyi Councils should strip a specific prior session from the fresh-session start URL.",
);

const grokProfile = createProviderProfile({ url: "https://grok.com/c/example" });
assert(
  providerCouncilStartUrl(grokProfile) === "https://grok.com/",
  "Built-in Grok Councils should use the catalog landing page for a fresh session.",
);

const customProfile = createProviderProfile({ url: "https://ai.example.org/new-chat" });
assert(customProfile.authState === "login_required", "Custom http(s) providers should be allowed into the same local Teach/Gate flow.");
assert(customProfile.adapterId === "custom.browser", "Custom profiles should retain the generic browser adapter id.");
assert(customProfile.profileKey !== knownProfile.profileKey, "Every provider profile needs a unique isolation key.");
assert(
  providerCouncilStartUrl(customProfile) === customProfile.url,
  "Custom providers should preserve the user's chosen new-chat landing page.",
);

let rejected = false;
try {
  normalizeHttpUrl("file:///etc/passwd");
} catch {
  rejected = true;
}
assert(rejected, "Non-http(s) provider URLs must be rejected.");

console.log("✓ ChatChat provider-sdk tests passed");
