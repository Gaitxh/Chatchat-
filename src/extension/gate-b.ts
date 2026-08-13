import type { AdapterRecipe } from "../provider-sdk/recipe.js";
import { adapterRecipeComplete } from "../provider-sdk/recipe.js";
import type { ProviderProofSnapshot } from "../validation/proof-pack.js";

export interface BrowserHouseProofSeat {
  seatId: string;
  providerId: string;
  origin: string;
}

export type BrowserHouseProofState = "idle" | "running" | "pass" | "fail";

export interface CaptureBrowserHouseProofInput {
  seats: readonly BrowserHouseProofSeat[];
  recipes: Readonly<Record<string, AdapterRecipe>>;
  tests: Readonly<Record<string, BrowserHouseProofState>>;
  gates: Readonly<Record<string, BrowserHouseProofState>>;
  providerHostSeatIds: readonly string[];
}

/**
 * Converts the exact Browser House seats that participated in a Council into
 * the shared Gate B provider-proof vocabulary.
 *
 * No tab ids, display names, selectors, responses, or account data survive
 * this adapter. The shared Royal Proof Pack performs the final verdict logic.
 */
export function captureBrowserHouseProviderProof(
  input: CaptureBrowserHouseProofInput,
): ProviderProofSnapshot[] {
  const healthy = new Set(input.providerHostSeatIds);
  return input.seats.map((seat) => ({
    providerId: seat.providerId,
    adapterId: "extension.tab",
    host: publicHost(seat.origin),
    recipeReady: adapterRecipeComplete(input.recipes[seat.origin]),
    testPassed: input.tests[seat.seatId] === "pass",
    councilGatePassed: input.gates[seat.seatId] === "pass",
    providerHostHealthy: healthy.has(seat.seatId),
    seated: true,
  }));
}

export function seatStillOnProviderOrigin(
  expectedOrigin: string,
  currentUrl: string | undefined,
): boolean {
  if (!currentUrl) return false;
  try {
    const expected = new URL(expectedOrigin);
    const current = new URL(currentUrl);
    if (!/^https?:$/.test(current.protocol)) return false;
    return (
      current.protocol === expected.protocol &&
      current.hostname.toLocaleLowerCase() === expected.hostname.toLocaleLowerCase() &&
      effectivePort(current) === effectivePort(expected)
    );
  } catch {
    return false;
  }
}

function publicHost(origin: string): string {
  try {
    return new URL(origin).hostname.toLocaleLowerCase();
  } catch {
    return "invalid-host";
  }
}

function effectivePort(url: URL): string {
  if (url.port) return url.port;
  return url.protocol === "https:" ? "443" : url.protocol === "http:" ? "80" : "";
}
