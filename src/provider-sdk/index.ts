import { BrowserProviderProfileStore } from "./browser-profile-store.js";
import { BrowserAdapterRecipeStore } from "./browser-recipe-store.js";
import { TauriSqliteProviderProfileStore } from "./tauri-profile-store.js";
import { TauriSqliteAdapterRecipeStore } from "./tauri-recipe-store.js";
import type { AdapterRecipeStore } from "./recipe.js";
import type { ProviderProfileStore } from "./types.js";

export * from "./catalog.js";
export * from "./council-agent.js";
export * from "./login-runtime.js";
export * from "./probe-runtime.js";
export * from "./profile.js";
export * from "./recipe.js";
export * from "./speech.js";
export * from "./teach-runtime.js";
export * from "./types.js";

export async function createProviderProfileStore(): Promise<ProviderProfileStore> {
  if (isTauriRuntime()) {
    try { return await TauriSqliteProviderProfileStore.open(); }
    catch (error) { console.warn("ChatChat could not open SQLite provider profiles; falling back to browser-local storage.", error); }
  }
  return new BrowserProviderProfileStore();
}

export async function createAdapterRecipeStore(): Promise<AdapterRecipeStore> {
  if (isTauriRuntime()) {
    try { return await TauriSqliteAdapterRecipeStore.open(); }
    catch (error) { console.warn("ChatChat could not open SQLite adapter recipes; falling back to browser-local storage.", error); }
  }
  return new BrowserAdapterRecipeStore();
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
