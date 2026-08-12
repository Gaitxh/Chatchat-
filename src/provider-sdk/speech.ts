import { invoke } from "@tauri-apps/api/core";
import { adapterRecipeComplete, type AdapterRecipe } from "./recipe.js";
import type { ProviderProfile } from "./types.js";

export const DEFAULT_TEST_SPEECH =
  "Reply with exactly: ChatChat advisor channel ready.";

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
  validateAdapterSpeechInput(recipe, message);
  return {
    profileId: profile.profileId,
    expectedOrigin: profile.origin,
    composerSelector: recipe.composerSelector!,
    sendSelector: recipe.sendSelector!,
    responseSelector: recipe.responseSelector!,
    message: message.trim(),
  };
}

export function validateAdapterSpeechInput(
  recipe: AdapterRecipe,
  message: string,
): void {
  if (!adapterRecipeComplete(recipe)) {
    throw new Error("Test Speech requires a complete 3/3 Adapter Recipe.");
  }

  const trimmed = message.trim();
  if (!trimmed) throw new Error("Test Speech message cannot be empty.");
  if (trimmed.length > 4_000) {
    throw new Error("Test Speech message is limited to 4,000 characters.");
  }

  for (const [label, selector] of [
    ["composer", recipe.composerSelector],
    ["send", recipe.sendSelector],
    ["response", recipe.responseSelector],
  ] as const) {
    if (!selector?.trim() || selector.length > 512) {
      throw new Error(`${label} selector is missing or too long.`);
    }
  }
}

export async function testProviderSpeech(
  profile: ProviderProfile,
  recipe: AdapterRecipe,
  message: string,
): Promise<AdapterSpeechResult> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    throw new Error("Test Speech requires the ChatChat Tauri desktop app.");
  }

  return invoke<AdapterSpeechResult>("test_provider_speech", {
    request: buildAdapterSpeechRequest(profile, recipe, message),
  });
}
