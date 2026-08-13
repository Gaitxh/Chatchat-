import { invoke } from "@tauri-apps/api/core";
import type { ProviderProfile } from "./types.js";
import type { TeachRole, TeachSelection } from "./recipe.js";

export async function startProviderTeach(
  profile: ProviderProfile,
  role: TeachRole,
): Promise<void> {
  requireTauri();
  await invoke("start_provider_teach", {
    request: {
      profileId: profile.profileId,
      expectedOrigin: profile.origin,
      role,
    },
  });
}

export async function readProviderTeachSelection(
  profile: ProviderProfile,
): Promise<TeachSelection | null> {
  requireTauri();
  return invoke<TeachSelection | null>("read_provider_teach", {
    request: {
      profileId: profile.profileId,
      expectedOrigin: profile.origin,
    },
  });
}

export async function cancelProviderTeach(profile: ProviderProfile): Promise<void> {
  requireTauri();
  await invoke("cancel_provider_teach", {
    request: {
      profileId: profile.profileId,
      expectedOrigin: profile.origin,
    },
  });
}

function requireTauri(): void {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    throw new Error("Teach Mode requires the ChatChat Tauri desktop app.");
  }
}
