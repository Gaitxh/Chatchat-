import { createId } from "../core/ids.js";
import { detectProviderUrl } from "./catalog.js";
import type { ProviderDetection, ProviderProfile } from "./types.js";

export interface CreateProviderProfileInput {
  url: string;
  displayName?: string;
}

export function createProviderProfile(
  input: CreateProviderProfileInput,
): ProviderProfile {
  const detection = detectProviderUrl(input.url);
  return profileFromDetection(detection, input.displayName);
}

export function profileFromDetection(
  detection: ProviderDetection,
  displayName?: string,
): ProviderProfile {
  const now = new Date().toISOString();
  const profileId = createId("provider");
  return {
    profileId,
    providerId: detection.providerId,
    adapterId: detection.adapterId,
    displayName: displayName?.trim() || detection.displayName,
    url: detection.normalizedUrl,
    origin: detection.origin,
    profileKey: createId("profile"),
    authState:
      detection.kind === "known" ? "login_required" : "adapter_required",
    seatState: "bench",
    createdAt: now,
    updatedAt: now,
  };
}

export function cloneProviderProfile(
  profile: ProviderProfile,
  changes: Partial<Pick<ProviderProfile, "displayName" | "authState" | "seatState" | "url">>,
): ProviderProfile {
  return {
    ...profile,
    ...changes,
    updatedAt: new Date().toISOString(),
  };
}
