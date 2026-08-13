import {
  analyzeRecipeCandidate,
  analyzeSelectorPortability,
  exportRecipeCandidate,
  parseRecipeCandidate,
  recipeCandidateJson,
  recipeCandidateToAdapterRecipe,
} from "../src/provider-sdk/recipe-candidate.js";
import type { CompleteAdapterRecipe } from "../src/provider-sdk/recipe.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const localRecipe: CompleteAdapterRecipe = {
  profileId: "PRIVATE_PROFILE_KEY_123",
  composerSelector: "textarea[data-testid='prompt-textarea']",
  sendSelector: "button[aria-label='Send message']",
  responseSelector: "[data-message-author-role='assistant']",
  createdAt: "2026-08-13T00:00:00.000Z",
  updatedAt: "2026-08-13T00:00:00.000Z",
};

const candidate = exportRecipeCandidate({
  providerId: "openai-chatgpt",
  origin: "https://chatgpt.com/c/private-conversation",
  recipe: localRecipe,
  testedAt: "2026-08-13",
  notes: "Public layout note only.\nNo account data.",
});

assert(candidate.origin === "https://chatgpt.com", "Export should reduce a URL to its public origin.");
assert(candidate.notes === "Public layout note only. No account data.", "Notes should be flattened.");
const exported = recipeCandidateJson(candidate);
assert(!exported.includes("PRIVATE_PROFILE_KEY_123"), "Portable recipe export must not leak the local profile id/key.");
assert(!exported.includes("private-conversation"), "Portable recipe export must not leak Provider conversation paths.");
assert(!exported.includes("createdAt"), "Portable recipes should not export local recipe metadata.");

const parsed = parseRecipeCandidate(exported);
assert(parsed.providerId === "openai-chatgpt", "Exported candidates must round-trip through the strict parser.");

const imported = recipeCandidateToAdapterRecipe(parsed, {
  providerId: "openai-chatgpt",
  origin: "https://chatgpt.com/",
  profileId: "new-local-profile",
}, "2026-08-13T01:02:03.000Z");
assert(imported.profileId === "new-local-profile", "Import should bind to the receiving user's local profile only.");
assert(imported.createdAt === "2026-08-13T01:02:03.000Z", "Import should create fresh local recipe metadata.");
assert(!("testPassed" in imported), "AdapterRecipe import must not contain Test Speech trust state.");
assert(!("councilGatePassed" in imported), "AdapterRecipe import must not contain Council Gate trust state.");

const stableAnalysis = analyzeRecipeCandidate(candidate);
assert(stableAnalysis.level === "stable", "Semantic data/aria selectors should score as portable/stable.");
assert(stableAnalysis.score <= 20, "Stable semantic selectors should keep a low risk score.");

const brittle = analyzeSelectorPortability(
  "#root > div:nth-child(2) > div:nth-child(4) > section > div > div > button.a3f90c128dea55ff19b1",
);
assert(brittle.level === "brittle", "Deep positional/generated selectors should be visibly marked brittle.");
assert(brittle.warnings.some((warning) => warning.includes("nth-child")), "Brittle selector analysis should explain positional dependence.");
assert(brittle.warnings.some((warning) => warning.includes("generated")), "Brittle selector analysis should explain generated identifiers.");

for (const bad of [
  {
    ...candidate,
    composerSelector: "input[type=password]",
  },
  {
    ...candidate,
    composerSelector: "input[value='PRIVATE SECRET']",
  },
  {
    ...candidate,
    responseSelector: "div[data-account='alice@example.com']",
  },
  {
    ...candidate,
    sendSelector: "button[data-token='sk-abcdefghijklmno']",
  },
]) {
  let rejected = false;
  try { parseRecipeCandidate(bad); } catch { rejected = true; }
  assert(rejected, "Credential/account-bearing selectors must be rejected from community recipe candidates.");
}

let knownMismatch = false;
try {
  parseRecipeCandidate({ ...candidate, providerId: "google-gemini" });
} catch {
  knownMismatch = true;
}
assert(knownMismatch, "Known Provider origins must not be relabeled as a different providerId.");

let targetMismatch = false;
try {
  recipeCandidateToAdapterRecipe(candidate, {
    providerId: "openai-chatgpt",
    origin: "https://claude.ai",
    profileId: "target",
  });
} catch {
  targetMismatch = true;
}
assert(targetMismatch, "A candidate cannot be imported onto a different Provider origin.");

let extraField = false;
try {
  parseRecipeCandidate({ ...candidate, cookie: "PRIVATE_COOKIE" });
} catch {
  extraField = true;
}
assert(extraField, "Unknown fields must be rejected rather than silently preserved.");

let privateNotes = false;
try {
  parseRecipeCandidate({ ...candidate, notes: "Contact alice@example.com for this account." });
} catch {
  privateNotes = true;
}
assert(privateNotes, "Public recipe notes should reject obvious account identifiers.");

console.log("✓ ChatChat Recipe Candidate v1 tests passed");
