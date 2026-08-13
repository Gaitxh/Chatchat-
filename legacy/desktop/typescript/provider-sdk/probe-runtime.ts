import { invoke } from "@tauri-apps/api/core";
import type { ProviderProfile } from "./types.js";

export interface ProviderElementProbe {
  tag: string;
  id: string | null;
  role: string | null;
  ariaLabel: string | null;
  placeholder: string | null;
  dataTestId: string | null;
  inputType: string | null;
  contentEditable: boolean;
  disabled: boolean;
}

export interface ProviderPageProbe {
  ok: boolean;
  url: string;
  origin: string;
  title: string;
  readyState: string;
  composerCandidates: ProviderElementProbe[];
  actionCandidates: ProviderElementProbe[];
  counts: {
    forms: number;
    textareas: number;
    contentEditables: number;
    buttons: number;
  };
  probedAt: string;
  error?: string;
}

export async function probeProviderPage(
  profile: ProviderProfile,
): Promise<ProviderPageProbe> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    throw new Error("Provider page probing requires the ChatChat Tauri desktop app.");
  }
  if (profile.authState === "adapter_required") {
    throw new Error("Custom providers need an adapter before the managed probe can run.");
  }

  return invoke<ProviderPageProbe>("probe_provider_page", {
    request: {
      profileId: profile.profileId,
      expectedOrigin: profile.origin,
    },
  });
}
