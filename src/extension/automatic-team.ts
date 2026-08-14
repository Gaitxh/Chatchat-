import { BUILT_IN_PROVIDER_MANIFESTS, detectProviderUrl } from "../provider-sdk/catalog.js";

export type AutomaticTeamDetection = ReturnType<typeof detectProviderUrl>;

export const DEFAULT_AUTOMATIC_PROVIDER_IDS = [
  "openai-chatgpt",
  "anthropic-claude",
  "google-gemini",
] as const;

export const DEFAULT_AUTOMATIC_TEAM_SIZE = 3;

/**
 * Keep already-open independent AI origins first. If fewer than two are present,
 * fill a small starter team automatically. Once two or more real origins are
 * already available, do not ask for extra provider permissions just to hit a
 * cosmetic team size.
 */
export function buildAutomaticTeamPlan(
  discovered: readonly AutomaticTeamDetection[],
  maxParticipants: number,
): AutomaticTeamDetection[] {
  const safeMax = Math.max(2, Math.floor(maxParticipants));
  const byOrigin = new Map<string, AutomaticTeamDetection>();
  for (const item of discovered) {
    if (byOrigin.size >= safeMax) break;
    if (item.kind !== "known") continue;
    if (!byOrigin.has(item.origin)) byOrigin.set(item.origin, item);
  }

  if (byOrigin.size >= 2) return [...byOrigin.values()];

  for (const providerId of DEFAULT_AUTOMATIC_PROVIDER_IDS) {
    if (byOrigin.size >= Math.min(DEFAULT_AUTOMATIC_TEAM_SIZE, safeMax)) break;
    const manifest = BUILT_IN_PROVIDER_MANIFESTS.find((item) => item.providerId === providerId);
    if (!manifest) continue;
    const detection = detectProviderUrl(manifest.defaultUrl);
    if (!byOrigin.has(detection.origin)) byOrigin.set(detection.origin, detection);
  }

  return [...byOrigin.values()].slice(0, safeMax);
}

export function automaticTeamPermissionDescriptor(
  plan: readonly AutomaticTeamDetection[],
): { origins: string[] } {
  return {
    origins: [...new Set(plan.map((detection) => `${detection.origin}/*`))],
  };
}
