import {
  automaticTeamLaunchUrl,
  automaticTeamPermissionDescriptor,
  buildAutomaticTeamPlan,
} from "../src/extension/automatic-team.js";
import { createSerializedRecordMutation } from "../src/extension/serialized-record-mutation.js";
import { detectProviderUrl } from "../src/provider-sdk/catalog.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const emptyPlan = buildAutomaticTeamPlan([], 8);
assert(emptyPlan.length === 3, "No discovered AI tabs should produce a small three-provider starter team.");
assert(
  emptyPlan.map((item) => item.providerId).join(",") === "openai-chatgpt,anthropic-claude,google-gemini",
  "The starter team should remain deterministic and diverse.",
);

const oneDiscovered = buildAutomaticTeamPlan([
  detectProviderUrl("https://chat.deepseek.com/"),
], 8);
assert(oneDiscovered.length === 3, "One discovered AI should be kept and automatically filled to a starter team.");
assert(oneDiscovered[0]?.providerId === "deepseek-chat", "An already-open AI must stay first in the automatic team.");
assert(new Set(oneDiscovered.map((item) => item.origin)).size === oneDiscovered.length, "Automatic planning must never duplicate an AI origin.");

const alreadyEnough = buildAutomaticTeamPlan([
  detectProviderUrl("https://chatgpt.com/"),
  detectProviderUrl("https://gemini.google.com/app"),
], 8);
assert(alreadyEnough.length === 2, "Two discovered AI origins are enough; ChatChat should not request extra provider permissions just for team size.");

const duplicated = buildAutomaticTeamPlan([
  detectProviderUrl("https://chatgpt.com/"),
  detectProviderUrl("https://chatgpt.com/?temporary-chat=true"),
  detectProviderUrl("https://claude.ai/"),
], 8);
assert(duplicated.length === 2, "Duplicate tabs from one provider origin must not create extra automatic seats.");

const descriptor = automaticTeamPermissionDescriptor(oneDiscovered);
assert(descriptor.origins.length === 3, "Permission descriptor should contain one origin per planned participant.");
assert(descriptor.origins.every((origin) => origin.endsWith("/*")), "Permission origins must use host match patterns.");
assert(new Set(descriptor.origins).size === descriptor.origins.length, "Permission origins must be de-duplicated.");

const privateThread = detectProviderUrl("https://chatgpt.com/c/private-conversation-123");
assert(
  automaticTeamLaunchUrl(privateThread) === "https://chatgpt.com/",
  "Automatic assembly must launch ChatGPT from its clean start URL instead of reusing a discovered private thread.",
);

const claudeThread = detectProviderUrl("https://claude.ai/chat/private-conversation-456");
assert(
  automaticTeamLaunchUrl(claudeThread) === "https://claude.ai/",
  "Automatic assembly must launch Claude from its clean start URL instead of writing into an existing conversation.",
);

const geminiThread = detectProviderUrl("https://gemini.google.com/app/1234567890");
assert(
  automaticTeamLaunchUrl(geminiThread) === "https://gemini.google.com/app",
  "Automatic assembly must launch Gemini from its clean start URL instead of writing into an existing conversation.",
);

let record: Record<string, string> = {};
let activeStorageOperations = 0;
let maxActiveStorageOperations = 0;
const mutation = createSerializedRecordMutation<string>(
  async () => {
    activeStorageOperations += 1;
    maxActiveStorageOperations = Math.max(maxActiveStorageOperations, activeStorageOperations);
    await delay(3);
    const snapshot = { ...record };
    activeStorageOperations -= 1;
    return snapshot;
  },
  async (next) => {
    activeStorageOperations += 1;
    maxActiveStorageOperations = Math.max(maxActiveStorageOperations, activeStorageOperations);
    await delay(2);
    record = { ...next };
    activeStorageOperations -= 1;
  },
);

await Promise.all([
  mutation.upsert("chatgpt", "READY"),
  mutation.upsert("claude", "READY"),
  mutation.upsert("gemini", "READY"),
]);
assert(
  Object.keys(record).sort().join(",") === "chatgpt,claude,gemini",
  "Three providers completing at the same time must preserve all record keys instead of last-write-wins data loss.",
);
assert(
  maxActiveStorageOperations === 1,
  "Serialized record mutation must prevent overlapping read/merge/write critical sections.",
);

await mutation.merge({ deepseek: "CONNECTING", qwen: "READY" });
await mutation.remove("deepseek");
assert(record.qwen === "READY" && !("deepseek" in record), "Merge/remove mutations should share the same serialized record boundary.");

console.log("✓ ChatChat zero-config automatic team planning tests passed");
console.log("✓ ChatChat automatic team never hijacks an existing AI conversation");
console.log("✓ Concurrent provider state mutations cannot overwrite sibling READY records");

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
