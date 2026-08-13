import { BrowserProviderProfileStore } from "./browser-profile-store.js";
import { BrowserAdapterRecipeStore } from "./browser-recipe-store.js";
import type { AdapterRecipeStore } from "./recipe.js";
import type { ProviderProfileStore } from "./types.js";

export * from "./catalog.js";
export * from "./consultation-agent.js";
export * from "./consultation-protocol.js";
export * from "./council-agent.js";
export * from "./council-parser.js";
export * from "./fresh-session.js";
export * from "./profile.js";
export * from "./recipe.js";
export * from "./recipe-candidate.js";
export * from "./session-runtime.js";
export * from "./speech.js";
export * from "./speech-request.js";
export * from "./types.js";
export * from "./window-health.js";

export async function createProviderProfileStore(): Promise<ProviderProfileStore> {
  return new BrowserProviderProfileStore();
}

export async function createAdapterRecipeStore(): Promise<AdapterRecipeStore> {
  return new BrowserAdapterRecipeStore();
}
