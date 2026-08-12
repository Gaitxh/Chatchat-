import { BrowserProviderProfileStore } from "./browser-profile-store.js";
import { TauriSqliteProviderProfileStore } from "./tauri-profile-store.js";
import type { ProviderProfileStore } from "./types.js";

export * from "./catalog.js";
export * from "./profile.js";
export * from "./types.js";

export async function createProviderProfileStore(): Promise<ProviderProfileStore> {
  if (isTauriRuntime()) {
    try {
      return await TauriSqliteProviderProfileStore.open();
    } catch (error) {
      console.warn(
        "ChatChat could not open SQLite provider profiles; falling back to browser-local storage.",
        error,
      );
    }
  }
  return new BrowserProviderProfileStore();
}

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
