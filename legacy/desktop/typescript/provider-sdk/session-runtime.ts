import { invoke } from "@tauri-apps/api/core";
import { detectProviderUrl } from "./catalog.js";
import { adapterRecipeComplete, type AdapterRecipe } from "./recipe.js";
import type { ProviderProfile } from "./types.js";

export interface ProviderCouncilPrepareResult {
  url: string;
  readyState: string;
  elapsedMs: number;
}

interface ProviderCouncilPrepareRequest {
  profileId: string;
  expectedOrigin: string;
  startUrl: string;
  composerSelector: string;
}

export function providerCouncilSessionRuntimeAvailable(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function providerCouncilStartUrl(profile: ProviderProfile): string {
  try {
    const detection = detectProviderUrl(profile.url);
    // Built-in providers have a catalog-controlled root that is less likely to
    // reopen a specific old conversation. Custom providers keep the URL the
    // user intentionally supplied; users should invite their new-chat landing page.
    return detection.manifest?.defaultUrl ?? profile.url;
  } catch {
    return profile.url;
  }
}

export async function prepareProviderCouncilSession(
  profile: ProviderProfile,
  recipe: AdapterRecipe,
): Promise<ProviderCouncilPrepareResult> {
  if (!providerCouncilSessionRuntimeAvailable()) {
    throw new Error("Fresh Provider Council sessions require the ChatChat Tauri desktop app.");
  }
  if (!adapterRecipeComplete(recipe)) {
    throw new Error("Fresh Provider Council sessions require a complete 3/3 Adapter Recipe.");
  }

  const request: ProviderCouncilPrepareRequest = {
    profileId: profile.profileId,
    expectedOrigin: profile.origin,
    startUrl: providerCouncilStartUrl(profile),
    composerSelector: recipe.composerSelector!,
  };
  return invoke<ProviderCouncilPrepareResult>("prepare_provider_council_session", {
    request,
  });
}
