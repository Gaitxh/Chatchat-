import type { AdapterRecipe } from "../provider-sdk/recipe.js";
import { adapterRecipeComplete } from "../provider-sdk/recipe.js";
import type { ProviderProofSnapshot } from "../validation/proof-pack.js";

export interface BrowserConsultationProofParticipant {
  seatId: string;
  providerId: string;
  origin: string;
}

export type BrowserConsultationProofState = "idle" | "running" | "pass" | "fail";

export interface CaptureBrowserConsultationProofInput {
  participants: readonly BrowserConsultationProofParticipant[];
  recipes: Readonly<Record<string, AdapterRecipe>>;
  tests: Readonly<Record<string, BrowserConsultationProofState>>;
  gates: Readonly<Record<string, BrowserConsultationProofState>>;
  providerHostSeatIds: readonly string[];
}

export interface CaptureReadyBrowserConsultationProofInput {
  participants: readonly BrowserConsultationProofParticipant[];
  recipes: Readonly<Record<string, AdapterRecipe>>;
  readySeatIds: readonly string[];
  providerHostSeatIds: readonly string[];
}

/**
 * Freeze privacy-safe Provider readiness metadata for current Browser Consultation
 * participants. READY in the current browser product means the automatic
 * connection handshake and structured Consultation Gate have both completed.
 */
export function captureReadyBrowserConsultationProviderProof(
  input: CaptureReadyBrowserConsultationProofInput,
): ProviderProofSnapshot[] {
  const healthy = new Set(input.providerHostSeatIds);
  const ready = new Set(input.readySeatIds);
  return input.participants.map((participant) => ({
    providerId: participant.providerId,
    adapterId: "extension.tab",
    host: publicHost(participant.origin),
    recipeReady: adapterRecipeComplete(input.recipes[participant.origin]),
    testPassed: ready.has(participant.seatId),
    councilGatePassed: ready.has(participant.seatId),
    providerHostHealthy: healthy.has(participant.seatId),
    seated: true,
  }));
}

/** Explicit state helper retained for lower-level browser adapter tests. */
export function captureBrowserConsultationProviderProof(
  input: CaptureBrowserConsultationProofInput,
): ProviderProofSnapshot[] {
  const healthy = new Set(input.providerHostSeatIds);
  return input.participants.map((participant) => ({
    providerId: participant.providerId,
    adapterId: "extension.tab",
    host: publicHost(participant.origin),
    recipeReady: adapterRecipeComplete(input.recipes[participant.origin]),
    testPassed: input.tests[participant.seatId] === "pass",
    councilGatePassed: input.gates[participant.seatId] === "pass",
    providerHostHealthy: healthy.has(participant.seatId),
    seated: true,
  }));
}

export function participantStillOnProviderOrigin(
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

/*
 * Compatibility aliases for archived tests/integrations created during the
 * Browser House naming era. New product code must use the Consultation names.
 */
export type BrowserHouseProofSeat = BrowserConsultationProofParticipant;
export type BrowserHouseProofState = BrowserConsultationProofState;
export interface CaptureBrowserHouseProofInput {
  seats: readonly BrowserHouseProofSeat[];
  recipes: Readonly<Record<string, AdapterRecipe>>;
  tests: Readonly<Record<string, BrowserHouseProofState>>;
  gates: Readonly<Record<string, BrowserHouseProofState>>;
  providerHostSeatIds: readonly string[];
}
export interface CaptureAdmittedBrowserHouseProofInput {
  seats: readonly BrowserHouseProofSeat[];
  recipes: Readonly<Record<string, AdapterRecipe>>;
  providerHostSeatIds: readonly string[];
}

/** @deprecated Use captureBrowserConsultationProviderProof. */
export function captureBrowserHouseProviderProof(
  input: CaptureBrowserHouseProofInput,
): ProviderProofSnapshot[] {
  return captureBrowserConsultationProviderProof({
    participants: input.seats,
    recipes: input.recipes,
    tests: input.tests,
    gates: input.gates,
    providerHostSeatIds: input.providerHostSeatIds,
  });
}

/** @deprecated Use captureReadyBrowserConsultationProviderProof. */
export function captureAdmittedBrowserHouseProviderProof(
  input: CaptureAdmittedBrowserHouseProofInput,
): ProviderProofSnapshot[] {
  return captureReadyBrowserConsultationProviderProof({
    participants: input.seats,
    recipes: input.recipes,
    readySeatIds: input.seats.map((seat) => seat.seatId),
    providerHostSeatIds: input.providerHostSeatIds,
  });
}

/** @deprecated Use participantStillOnProviderOrigin. */
export const seatStillOnProviderOrigin = participantStillOnProviderOrigin;

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
