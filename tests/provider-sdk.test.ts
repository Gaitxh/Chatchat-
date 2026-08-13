import {
  BUILT_IN_PROVIDER_MANIFESTS,
  detectProviderUrl,
  normalizeHttpUrl,
} from "../src/provider-sdk/catalog.js";
import { providerConsultationStartUrl } from "../src/provider-sdk/fresh-session.js";
import { createProviderProfile } from "../src/provider-sdk/profile.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const chatgpt = detectProviderUrl("chatgpt.com");
assert(chatgpt.kind === "known", "ChatGPT should be recognized as a built-in provider.");
assert(chatgpt.providerId === "openai-chatgpt", "ChatGPT provider id should be stable.");
assert(chatgpt.normalizedUrl.startsWith("https://"), "Scheme-less URLs should default to HTTPS.");
assert(chatgpt.manifest?.capabilities.councilTurns === true, "Built-in web providers should advertise the taught structured consultation bridge.");

const claude = detectProviderUrl("https://claude.ai/new");
assert(claude.adapterId === "web.claude", "Claude URL should select the Claude adapter id.");
const gemini = detectProviderUrl("https://gemini.google.com/app?hl=zh");
assert(gemini.adapterId === "web.gemini", "Gemini app URLs should remain recognized.");
const deepseek = detectProviderUrl("https://chat.deepseek.com/");
assert(deepseek.providerId === "deepseek-chat", "DeepSeek chat should remain recognized.");
const qwen = detectProviderUrl("https://chat.qwen.ai/");
assert(qwen.kind === "known" && qwen.adapterId === "web.qwen" && qwen.providerId === "qwen-chat", "Qwen should remain first-class.");

const yuanbao = detectProviderUrl("https://yuanbao.tencent.com/chat/example-room/example-session");
assert(yuanbao.kind === "known" && yuanbao.providerId === "tencent-yuanbao", "Tencent Yuanbao should remain first-class.");
const tongyi = detectProviderUrl("https://tongyi.aliyun.com/?sessionId=example-session");
assert(tongyi.kind === "known" && tongyi.providerId === "alibaba-tongyi", "Alibaba Tongyi should remain first-class.");
const grok = detectProviderUrl("https://grok.com/");
assert(grok.kind === "known" && grok.providerId === "xai-grok", "Grok should remain first-class.");

assert(BUILT_IN_PROVIDER_MANIFESTS.length >= 8, "The built-in catalog should expose the expanded participant roster.");
assert(BUILT_IN_PROVIDER_MANIFESTS.every((manifest) => manifest.capabilities.councilTurns), "Every built-in catalog entry should use the structured browser consultation contract.");

const custom = detectProviderUrl("https://mycompany-ai.example.com/chat");
assert(custom.kind === "custom" && custom.adapterId === "custom.browser", "Unknown hosts should use the generic taught browser adapter.");

const knownProfile = createProviderProfile({ url: "https://gemini.google.com/app" });
assert(knownProfile.authState === "login_required" && knownProfile.seatState === "bench", "New providers should wait for local verification before participating.");

for (const [url, expected] of [
  ["https://chat.qwen.ai/c/example", "https://chat.qwen.ai/"],
  ["https://yuanbao.tencent.com/chat/example-room/example-session", "https://yuanbao.tencent.com/"],
  ["https://tongyi.aliyun.com/?sessionId=example-session", "https://tongyi.aliyun.com/"],
  ["https://grok.com/c/example", "https://grok.com/"],
] as const) {
  const profile = createProviderProfile({ url });
  assert(providerConsultationStartUrl(profile) === expected, `Built-in provider ${url} should start from its catalog landing page.`);
}

const customProfile = createProviderProfile({ url: "https://ai.example.org/new-chat" });
assert(customProfile.authState === "login_required", "Custom http(s) providers should be allowed into the local Teach/Gate flow.");
assert(customProfile.adapterId === "custom.browser", "Custom profiles should retain the generic browser adapter id.");
assert(customProfile.profileKey !== knownProfile.profileKey, "Every provider profile needs a unique isolation key.");
assert(providerConsultationStartUrl(customProfile) === customProfile.url, "Custom providers should preserve the user's chosen new-chat landing page.");

let rejected = false;
try { normalizeHttpUrl("file:///etc/passwd"); } catch { rejected = true; }
assert(rejected, "Non-http(s) provider URLs must be rejected.");

console.log("✓ ChatChat provider-sdk tests passed");
