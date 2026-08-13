import {
  buildCoalitionAnalysis,
  canonicalStance,
} from "../extension/coalitions.js";

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const advisors = [
  seat("gpt-1", "GPT-1", "openai-chatgpt", "gpt", "GPT"),
  seat("gpt-2", "GPT-2", "openai-chatgpt", "gpt", "GPT"),
  seat("qwen-1", "Qwen-1", "alibaba-tongyi", "qwen", "Qwen"),
  seat("qwen-2", "Qwen-2", "alibaba-tongyi", "qwen", "Qwen"),
  seat("gemini-1", "Gemini-1", "google-gemini", "gemini", "Gemini"),
];

const positions = [
  position("gpt-1", "Tauri", 0.8),
  position("gpt-2", "Electron", 0.72),
  position("qwen-1", "Tauri", 0.84),
  position("qwen-2", "Tauri", 0.79),
  position("gemini-1", "Tauri with caveat", 0.67),
];

const analysis = buildCoalitionAnalysis(positions, advisors);

assert(analysis.houseSize === 5, "House size should count final seat positions.");
assert(analysis.coalitions.length === 3, "Conservative stance grouping should keep three coalitions.");

const tauri = analysis.coalitions.find(
  (coalition) => coalition.normalizedStance === "tauri",
);
assert(tauri?.seats === 3, "Tauri coalition should contain GPT-1 and both Qwen seats.");
assert(Math.abs(tauri.houseShare - 0.6) < 1e-9, "Tauri coalition should own 60% of the House.");
assert(tauri.delegationCount === 2, "Tauri coalition should be cross-delegation, not a provider bloc.");
assert(analysis.majorityCoalitionId === tauri.id, "A >50% coalition should be marked as the majority coalition.");

const gptSplit = analysis.splitDelegations.find(
  (item) => item.delegationId === "gpt",
);
assert(gptSplit?.coalitionIds.length === 2, "GPT delegation should be recognized as split across two coalitions.");
assert(
  !analysis.splitDelegations.some((item) => item.delegationId === "qwen"),
  "Qwen should remain cohesive when both seats share one final stance.",
);

assert(
  canonicalStance("  `Tauri`  ") === "tauri",
  "Conservative normalization may trim wrapping quote/backtick noise.",
);
assert(
  canonicalStance("Tauri with caveat") !== canonicalStance("Tauri"),
  "Coalition analysis must not use semantic guesswork to force similar-looking stances together.",
);

console.log("✓ ChatChat AI House coalition tests passed");

function seat(id, name, providerId, groupId, groupName) {
  return {
    id,
    name,
    providerId,
    delegationId: groupId,
    delegationName: groupName,
  };
}

function position(actorId, stance, confidence) {
  return {
    actorId,
    stance,
    confidence,
    content: "test",
    caveats: [],
  };
}
