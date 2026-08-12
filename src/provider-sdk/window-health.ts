import type { ProviderProfile } from "./types.js";

export type ProviderWindowHealthState =
  | "provider"
  | "external"
  | "closed";

export interface ProviderWindowHealthEvent {
  profileId: string;
  state: ProviderWindowHealthState;
  url: string | null;
  onProviderHost: boolean;
  observedAt: string;
}

export interface ProviderWindowHealth {
  open: boolean;
  onProviderHost: boolean;
  state: ProviderWindowHealthState;
  url: string | null;
  observedAt: string;
}

export function healthFromEvent(
  event: ProviderWindowHealthEvent,
): ProviderWindowHealth {
  return {
    open: event.state !== "closed",
    onProviderHost: event.state === "provider" && event.onProviderHost,
    state: event.state,
    url: event.url,
    observedAt: event.observedAt,
  };
}

export function providerRuntimeMustBeInvalidated(
  profile: ProviderProfile,
  event: ProviderWindowHealthEvent,
): boolean {
  if (profile.authState !== "ready" && profile.seatState !== "seated") {
    return false;
  }
  return event.state === "closed" || !event.onProviderHost;
}

export function providerWindowUsable(
  health: ProviderWindowHealth | undefined,
): boolean {
  return Boolean(health?.open && health.onProviderHost);
}
