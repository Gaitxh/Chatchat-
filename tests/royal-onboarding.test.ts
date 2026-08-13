import {
  DEFAULT_ONBOARDING_STATE,
  deriveOnboardingAct,
  firstCouncilCelebration,
  selectedOriginPatterns,
  totalReadySeats,
  validationProgress,
  type OnboardingRuntimeSummary,
  type PersistedRoyalOnboardingState,
} from "../src/extension/onboarding-model.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const empty: OnboardingRuntimeSummary = {
  seatCount: 0,
  readySeatCount: 0,
  delegations: [],
  councilComplete: false,
  eventCount: 0,
  revisionCount: 0,
  minorityOpinionPresent: false,
};
assert(deriveOnboardingAct(DEFAULT_ONBOARDING_STATE, empty) === 1, "A new install should begin at the welcome act.");

const discovered: PersistedRoyalOnboardingState = {
  version: 1,
  completed: false,
  act: 2,
  dismissed: false,
};
assert(deriveOnboardingAct(discovered, empty) === 2, "Scanning alone must not fabricate a seat or validation progress.");

const attached: OnboardingRuntimeSummary = {
  ...empty,
  seatCount: 3,
  delegations: [
    { delegationId: "gpt", providerName: "ChatGPT", recipeProgress: 0, seatCount: 2, readyCount: 0 },
    { delegationId: "gemini", providerName: "Gemini", recipeProgress: 0, seatCount: 1, readyCount: 0 },
  ],
};
assert(deriveOnboardingAct(discovered, attached) === 4, "Attached but unverified seats belong in Teach/Test/Gate, never House Ready.");

const oneReady: OnboardingRuntimeSummary = {
  ...attached,
  readySeatCount: 1,
  delegations: [
    { delegationId: "gpt", providerName: "ChatGPT", recipeProgress: 3, seatCount: 2, readyCount: 1 },
    { delegationId: "gemini", providerName: "Gemini", recipeProgress: 3, seatCount: 1, readyCount: 0 },
  ],
};
assert(deriveOnboardingAct(discovered, oneReady) === 4, "One real ready seat is insufficient for a Council and must not advance the wizard.");

const twoReady: OnboardingRuntimeSummary = {
  ...oneReady,
  readySeatCount: 2,
  delegations: [
    { delegationId: "gpt", providerName: "ChatGPT", recipeProgress: 3, seatCount: 2, readyCount: 1 },
    { delegationId: "gemini", providerName: "Gemini", recipeProgress: 3, seatCount: 1, readyCount: 1 },
  ],
};
assert(deriveOnboardingAct(discovered, twoReady) === 5, "Two independently ready seats may advance to House admission.");
assert(totalReadySeats(twoReady.delegations) === 2, "Readiness totals must come from per-delegation ready seats.");

const firstCouncil: PersistedRoyalOnboardingState = {
  version: 1,
  completed: false,
  act: 6,
  dismissed: false,
};
assert(deriveOnboardingAct(firstCouncil, twoReady) === 6, "Choosing to prepare the first Council should not be pulled backwards to Act V.");

const complete: OnboardingRuntimeSummary = {
  ...twoReady,
  councilComplete: true,
  eventCount: 17,
  revisionCount: 1,
  minorityOpinionPresent: true,
};
assert(deriveOnboardingAct(firstCouncil, complete) === 7, "Only a completed Council with at least two ready seats may show the celebration act.");
const celebration = firstCouncilCelebration(complete);
assert(celebration.structuredEvents === 17, "Celebration event count must be runtime-derived.");
assert(celebration.changedMinds === 1, "Celebration changed-mind count must be runtime-derived.");
assert(celebration.minorityOpinionPresent, "Minority celebration must reflect the actual report state.");

const patterns = selectedOriginPatterns(
  [
    { tabId: 1, origin: "https://chatgpt.com" },
    { tabId: 2, origin: "https://chatgpt.com" },
    { tabId: 3, origin: "https://gemini.google.com" },
    { tabId: 4, origin: "https://chat.deepseek.com" },
  ],
  new Set([1, 3]),
);
assert(
  JSON.stringify(patterns) === JSON.stringify(["https://chatgpt.com/*", "https://gemini.google.com/*"]),
  "Permission request planning must include selected origins only and deduplicate them.",
);
assert(!patterns.includes("https://chat.deepseek.com/*"), "Unselected Providers must not appear in the permission request.");

assert(validationProgress({ delegationId: "x", providerName: "X", recipeProgress: 0, seatCount: 2, readyCount: 0 }) === 0, "No recipe/runtime proof means zero validation progress.");
assert(validationProgress({ delegationId: "x", providerName: "X", recipeProgress: 3, seatCount: 2, readyCount: 0 }) === 60, "Recipe 3/3 alone is useful progress but must remain below READY.");
assert(validationProgress({ delegationId: "x", providerName: "X", recipeProgress: 3, seatCount: 2, readyCount: 2 }) === 100, "A fully taught, fully ready delegation should reach 100%.");

const exportedPersistedKeys = Object.keys(DEFAULT_ONBOARDING_STATE).sort();
assert(
  JSON.stringify(exportedPersistedKeys) === JSON.stringify(["act", "completed", "dismissed", "version"]),
  "Persistent onboarding state must stay tiny and must not grow Provider/account/content fields accidentally.",
);

console.log("✓ ChatChat Royal Onboarding tests passed");
