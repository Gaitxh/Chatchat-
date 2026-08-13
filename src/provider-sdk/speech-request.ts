import { adapterRecipeComplete, type AdapterRecipe } from "./recipe.js";
import type { ProviderProfile } from "./types.js";

export const DEFAULT_TEST_SPEECH = "Reply with exactly: ChatChat participant channel ready.";

const MAX_TEST_SPEECH_CHARACTERS = 4_000;
const MAX_CONSULTATION_TURN_CHARACTERS = 24_000;

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
  return buildSpeechRequest(profile, recipe, message, MAX_TEST_SPEECH_CHARACTERS, "Test Speech");
}

export function buildAdapterConsultationSpeechRequest(
  profile: ProviderProfile,
  recipe: AdapterRecipe,
  message: string,
): AdapterSpeechRequest {
  return buildSpeechRequest(
    profile,
    recipe,
    message,
    MAX_CONSULTATION_TURN_CHARACTERS,
    "Consultation turn",
  );
}

export const buildAdapterCouncilSpeechRequest = buildAdapterConsultationSpeechRequest;

export function validateAdapterSpeechInput(recipe: AdapterRecipe, message: string): void {
  validateSpeechInput(recipe, message, MAX_TEST_SPEECH_CHARACTERS, "Test Speech");
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
