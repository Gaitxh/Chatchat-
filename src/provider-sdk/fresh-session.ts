import { detectProviderUrl } from "./catalog.js";
import type { ProviderProfile } from "./types.js";

/**
 * Resolve the page a Provider should use when starting a new consultation.
 * Built-in providers use their catalog root to avoid reopening a specific old
 * conversation. Custom providers keep the URL the user intentionally supplied.
 */
export function providerConsultationStartUrl(profile: ProviderProfile): string {
  try {
    const detection = detectProviderUrl(profile.url);
    return detection.manifest?.defaultUrl ?? profile.url;
  } catch {
    return profile.url;
  }
}

// Compatibility alias while older documentation/tests migrate from Council wording.
export const providerCouncilStartUrl = providerConsultationStartUrl;
