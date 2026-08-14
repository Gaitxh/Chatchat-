import { BUILT_IN_PROVIDER_MANIFESTS, detectProviderUrl } from "../provider-sdk/catalog.js";

export type AutomaticTeamDetection = ReturnType<typeof detectProviderUrl>;

export const DEFAULT_AUTOMATIC_PROVIDER_IDS = [
  "openai-chatgpt",
  "anthropic-claude",
  "google-gemini",
] as const;

export const DEFAULT_AUTOMATIC_TEAM_SIZE = 3;

/**
 * Keep already-open independent AI origins first when choosing the team. If fewer
 * than two are present, fill a small starter team automatically. Once two or more
 * real origins are already available, do not ask for extra Provider permissions
 * just to hit a cosmetic team size.
 *
 * Important: discovered tabs influence team selection only. ChatChat launches a
 * dedicated clean consultation tab for every selected Provider so it never sends
 * handshake or consultation prompts into a user's existing AI conversation.
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

/**
 * A discovered Provider may be sitting inside a valuable existing conversation.
 * Always launch from the Provider's clean start URL when one is known instead of
 * navigating or writing into the discovered tab itself.
 */
export function automaticTeamLaunchUrl(detection: AutomaticTeamDetection): string {
  return detection.manifest?.defaultUrl ?? detection.normalizedUrl;
}

export function automaticTeamPermissionDescriptor(
  plan: readonly AutomaticTeamDetection[],
): { origins: string[] } {
  return {
    origins: [...new Set(plan.map((detection) => `${detection.origin}/*`))],
  };
}
