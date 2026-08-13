import { invoke } from "@tauri-apps/api/core";
import { adapterRecipeComplete, type AdapterRecipe } from "./recipe.js";
import type { ProviderProfile } from "./types.js";

export const DEFAULT_TEST_SPEECH =
  "Reply with exactly: ChatChat advisor channel ready.";

const MAX_TEST_SPEECH_CHARACTERS = 4_000;
const MAX_COUNCIL_TURN_CHARACTERS = 24_000;

export interface AdapterSpeechResult {
  ok: boolean;
  responseText: string;
  elapsedMs: number;
  baselineCount: number;
  responseCount: number;
  stablePolls: number;
  truncated: boolean;
}

export interface AdapterSpeechRequest {
  profileId: string;
  expectedOrigin: string;
  composerSelector: string;
  sendSelector: string;
  responseSelector: string;
  message: string;
}

export function buildAdapterSpeechRequest(
  profile: ProviderProfile,
  recipe: AdapterRecipe,
  message: string,
): AdapterSpeechRequest {
  return buildSpeechRequest(
    profile,
    recipe,
    message,
    MAX_TEST_SPEECH_CHARACTERS,
    "Test Speech",
  );
}

export function buildAdapterCouncilSpeechRequest(
  profile: ProviderProfile,
  recipe: AdapterRecipe,
  message: string,
): AdapterSpeechRequest {
  return buildSpeechRequest(
    profile,
    recipe,
    message,
    MAX_COUNCIL_TURN_CHARACTERS,
    "Council turn",
  );
}

export function validateAdapterSpeechInput(
  recipe: AdapterRecipe,
  message: string,
): void {
  validateSpeechInput(
    recipe,
    message,
    MAX_TEST_SPEECH_CHARACTERS,
    "Test Speech",
  );
}

export async function testProviderSpeech(
  profile: ProviderProfile,
  recipe: AdapterRecipe,
  message: string,
): Promise<AdapterSpeechResult> {
  requireTauriRuntime("Test Speech");
  return invoke<AdapterSpeechResult>("test_provider_speech", {
    request: buildAdapterSpeechRequest(profile, recipe, message),
  });
}

export async function runProviderCouncilSpeech(
  profile: ProviderProfile,
  recipe: AdapterRecipe,
  message: string,
): Promise<AdapterSpeechResult> {
  requireTauriRuntime("Real Council turns");
  return invoke<AdapterSpeechResult>("run_provider_council_turn", {
    request: buildAdapterCouncilSpeechRequest(profile, recipe, message),
  });
}

function buildSpeechRequest(
  profile: ProviderProfile,
  recipe: AdapterRecipe,
  message: string,
  maxCharacters: number,
  label: string,
): AdapterSpeechRequest {
  validateSpeechInput(recipe, message, maxCharacters, label);
  return {
    profileId: profile.profileId,
    expectedOrigin: profile.origin,
    composerSelector: recipe.composerSelector!,
    sendSelector: recipe.sendSelector!,
    responseSelector: recipe.responseSelector!,
    message: message.trim(),
  };
}

function validateSpeechInput(
  recipe: AdapterRecipe,
  message: string,
  maxCharacters: number,
  label: string,
): void {
  if (!adapterRecipeComplete(recipe)) {
    throw new Error(`${label} requires a complete 3/3 Adapter Recipe.`);
  }

  const trimmed = message.trim();
  if (!trimmed) throw new Error(`${label} message cannot be empty.`);
  if (trimmed.length > maxCharacters) {
    throw new Error(`${label} message is limited to ${maxCharacters.toLocaleString()} characters.`);
  }

  for (const [selectorLabel, selector] of [
    ["composer", recipe.composerSelector],
    ["send", recipe.sendSelector],
    ["response", recipe.responseSelector],
  ] as const) {
    if (!selector?.trim() || selector.length > 512) {
      throw new Error(`${selectorLabel} selector is missing or too long.`);
    }
  }
}

function requireTauriRuntime(label: string): void {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    throw new Error(`${label} requires the ChatChat Tauri desktop app.`);
  }
}
