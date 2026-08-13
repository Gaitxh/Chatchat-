import { invoke } from "@tauri-apps/api/core";
import type { ProviderProfile } from "./types.js";

export interface ProviderLoginWindowResult {
  label: string;
  reused: boolean;
}

export function providerLoginRuntimeAvailable(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function openProviderLoginWindow(
  profile: ProviderProfile,
): Promise<ProviderLoginWindowResult> {
  if (!providerLoginRuntimeAvailable()) {
    throw new Error("Provider login windows require the ChatChat Tauri desktop app.");
  }
  if (profile.authState === "adapter_required") {
    throw new Error("This custom provider needs an adapter before ChatChat can open its managed login flow.");
  }

  return invoke<ProviderLoginWindowResult>("open_provider_login", {
    request: {
      profileId: profile.profileId,
      profileKey: profile.profileKey,
      url: profile.url,
      displayName: profile.displayName,
    },
  });
}

export async function closeProviderLoginWindow(profileId: string): Promise<void> {
  if (!providerLoginRuntimeAvailable()) return;
  await invoke("close_provider_login", { profileId });
}
