import { MAX_DELEGATION_SEATS, MAX_HOUSE_SEATS } from "../src/house/delegations.js";
import {
  planOpenAiTabsForHouse,
  summarizeSummonPlan,
} from "../src/extension/summon-plan.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const browserTabs = [
  { id: 8, url: "https://chat.deepseek.com/", title: "DeepSeek" },
  { id: 2, url: "https://chatgpt.com/c/abc", title: "ChatGPT" },
  { id: 7, url: "https://grok.com/", title: "Grok" },
  { id: 4, url: "https://yuanbao.tencent.com/chat/some-session", title: "Yuanbao" },
  { id: 3, url: "https://gemini.google.com/app?hl=zh", title: "Gemini" },
  { id: 5, url: "https://tongyi.aliyun.com/?sessionId=private", title: "Tongyi" },
  { id: 6, url: "https://chat.qwen.ai/", title: "Qwen" },
  { id: 9, url: "https://example.com/private-ai", title: "Unknown AI" },
  { id: 10, url: "chrome://settings", title: "Chrome settings" },
];

const plan = planOpenAiTabsForHouse(browserTabs, []);
assert(plan.candidates.length === 7, "All seven known AI tabs should be eligible for one-click summoning.");
assert(plan.candidates[0]?.providerId === "openai-chatgpt", "Planning should be deterministic by tab id.");
assert(plan.candidates.some((item) => item.providerId === "google-gemini"), "Gemini should be discovered.");
assert(plan.candidates.some((item) => item.providerId === "tencent-yuanbao"), "Yuanbao should be discovered.");
assert(plan.candidates.some((item) => item.providerId === "alibaba-tongyi"), "Tongyi should be discovered.");
assert(plan.candidates.some((item) => item.providerId === "xai-grok"), "Grok should be discovered.");
assert(plan.candidates.some((item) => item.providerId === "qwen-chat"), "Qwen should be discovered.");
assert(plan.candidates.some((item) => item.providerId === "deepseek-chat"), "DeepSeek should be discovered.");
assert(plan.ignoredUnknownTabs === 1, "Unknown http(s) pages must not be auto-summoned.");
assert(!plan.candidates.some((item) => item.hostname === "example.com"), "Custom pages remain manual-invite only.");
assert(summarizeSummonPlan(plan).includes("ChatGPT ×1"), "Human summary should describe discovered delegations.");

const duplicatePlan = planOpenAiTabsForHouse(browserTabs, [
  { tabId: 2, origin: "https://chatgpt.com", providerId: "openai-chatgpt" },
]);
assert(!duplicatePlan.candidates.some((item) => item.tabId === 2), "Already-seated tabs must not be summoned twice.");
assert(duplicatePlan.ignoredDuplicateTabs === 1, "Duplicate tabs should be reported.");

const manyGptTabs = Array.from({ length: MAX_DELEGATION_SEATS + 4 }, (_, index) => ({
  id: 100 + index,
  url: `https://chatgpt.com/c/${index}`,
}));
const cappedDelegation = planOpenAiTabsForHouse(manyGptTabs, []);
assert(cappedDelegation.candidates.length === MAX_DELEGATION_SEATS, "Bulk summon must respect the per-delegation seat cap.");
assert(cappedDelegation.ignoredDelegationLimit === 4, "Excess same-provider tabs should be counted rather than attached.");

const nearlyFullHouse = Array.from({ length: MAX_HOUSE_SEATS - 1 }, (_, index) => ({
  tabId: 1000 + index,
  origin: `https://existing-${index}.example`,
  providerId: `provider-${index}`,
}));
const houseCapPlan = planOpenAiTabsForHouse(
  [
    { id: 9001, url: "https://chatgpt.com/" },
    { id: 9002, url: "https://claude.ai/" },
  ],
  nearlyFullHouse,
);
assert(houseCapPlan.candidates.length === 1, "Only one new seat should fit into a nearly full House.");
assert(houseCapPlan.ignoredHouseLimit === 1, "Excess tabs must respect the global House cap.");

console.log("✓ ChatChat extension bulk-summon planner tests passed");
