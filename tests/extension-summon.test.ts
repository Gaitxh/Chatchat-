import { MAX_DELEGATION_SEATS, MAX_HOUSE_SEATS } from "../src/house/delegations.js";
import {
  defaultRepresentativeTabIds,
  planDefaultDelegationRepresentatives,
  planOpenAiTabsForHouse,
  summarizeDefaultRepresentatives,
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
assert(plan.candidates.length === 7, "All seven known AI tabs should remain discoverable.");
assert(plan.candidates[0]?.providerId === "openai-chatgpt", "Planning should be deterministic by tab id.");
assert(plan.candidates.some((item) => item.providerId === "google-gemini"), "Gemini should be discovered.");
assert(plan.candidates.some((item) => item.providerId === "tencent-yuanbao"), "Yuanbao should be discovered.");
assert(plan.candidates.some((item) => item.providerId === "alibaba-tongyi"), "Tongyi should be discovered.");
assert(plan.candidates.some((item) => item.providerId === "xai-grok"), "Grok should be discovered.");
assert(plan.candidates.some((item) => item.providerId === "qwen-chat"), "Qwen should be discovered.");
assert(plan.candidates.some((item) => item.providerId === "deepseek-chat"), "DeepSeek should be discovered.");
assert(plan.ignoredUnknownTabs === 1, "Unknown http(s) pages must not be auto-summoned.");
assert(!plan.candidates.some((item) => item.hostname === "example.com"), "Custom pages remain manual-invite only.");
assert(summarizeSummonPlan(plan).includes("ChatGPT ×1"), "Human discovery summary should describe delegations.");

const representatives = planDefaultDelegationRepresentatives(plan, []);
assert(representatives.representatives.length === 7, "With one open tab per model, each delegation should default to exactly one seat.");
assert(representatives.reserveCandidates.length === 0, "There should be no reserves when every delegation has only one tab.");
assert(summarizeDefaultRepresentatives(representatives.representatives).includes("Gemini ×1"), "Default representative summary should use one-seat language.");

const repeatedModels = planOpenAiTabsForHouse(
  [
    { id: 20, url: "https://chatgpt.com/c/a" },
    { id: 21, url: "https://chatgpt.com/c/b" },
    { id: 22, url: "https://chatgpt.com/c/c" },
    { id: 23, url: "https://gemini.google.com/app/a" },
    { id: 24, url: "https://gemini.google.com/app/b" },
  ],
  [],
);
const onePerDelegation = planDefaultDelegationRepresentatives(repeatedModels, []);
assert(onePerDelegation.representatives.length === 2, "Default Congress should preselect one representative per model delegation, not every open tab.");
assert(onePerDelegation.representatives.some((item) => item.tabId === 20), "The deterministic first ChatGPT tab should become the default representative.");
assert(onePerDelegation.representatives.some((item) => item.tabId === 23), "The deterministic first Gemini tab should become the default representative.");
assert(onePerDelegation.reserveCandidates.length === 3, "Additional same-model tabs should remain reserve candidates until the King raises the seat quota.");
const defaultIds = defaultRepresentativeTabIds(repeatedModels, []);
assert(defaultIds.size === 2 && defaultIds.has(20) && defaultIds.has(23), "Royal Onboarding should default every delegation quota to exactly one selected tab.");

const alreadySeated = [
  { tabId: 77, origin: "https://chatgpt.com", providerId: "openai-chatgpt" },
];
const repeatWithExisting = planOpenAiTabsForHouse(
  [
    { id: 30, url: "https://chatgpt.com/c/new-a" },
    { id: 31, url: "https://gemini.google.com/app/new" },
  ],
  alreadySeated,
);
const missingDelegationsOnly = planDefaultDelegationRepresentatives(repeatWithExisting, alreadySeated);
assert(!missingDelegationsOnly.representatives.some((item) => item.providerId === "openai-chatgpt"), "Bulk summon must not silently turn an existing ChatGPT ×1 delegation into ×2.");
assert(missingDelegationsOnly.reserveCandidates.some((item) => item.providerId === "openai-chatgpt"), "Additional ChatGPT tabs remain available as reserves for an explicit quota increase.");
assert(missingDelegationsOnly.representatives.some((item) => item.providerId === "google-gemini"), "An unrepresented Gemini delegation should still receive its default ×1 seat.");

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
assert(cappedDelegation.candidates.length === MAX_DELEGATION_SEATS, "Discovery must still respect the per-delegation seat cap.");
assert(cappedDelegation.ignoredDelegationLimit === 4, "Excess same-provider tabs should be counted rather than attached.");
const cappedDefault = planDefaultDelegationRepresentatives(cappedDelegation, []);
assert(cappedDefault.representatives.length === 1, "Even sixteen discoverable ChatGPT tabs default to ChatGPT ×1 in the Congress.");
assert(cappedDefault.reserveCandidates.length === MAX_DELEGATION_SEATS - 1, "The other same-model tabs remain explicit seat-quota reserves.");

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
assert(houseCapPlan.candidates.length === 1, "Only one new seat should fit into a nearly full Congress.");
assert(houseCapPlan.ignoredHouseLimit === 1, "Excess tabs must respect the global seat cap.");

console.log("✓ ChatChat extension representative-summon planner tests passed");
