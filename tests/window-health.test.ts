import {
  healthFromEvent,
  providerRuntimeMustBeInvalidated,
  providerWindowUsable,
  type ProviderWindowHealthEvent,
} from "../src/provider-sdk/window-health.js";
import type { ProviderProfile } from "../src/provider-sdk/types.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const readySeat: ProviderProfile = {
  profileId: "provider-health-1",
  providerId: "example",
  adapterId: "custom.browser",
  displayName: "Example AI",
  url: "https://example.ai/chat",
  origin: "https://example.ai",
  profileKey: "profile-health-1",
  authState: "ready",
  seatState: "seated",
  createdAt: "2026-08-13T00:00:00.000Z",
  updatedAt: "2026-08-13T00:00:00.000Z",
};

const healthyEvent: ProviderWindowHealthEvent = {
  profileId: readySeat.profileId,
  state: "provider",
  url: "https://example.ai/chat/new",
  onProviderHost: true,
  observedAt: "1",
};
const externalEvent: ProviderWindowHealthEvent = {
  profileId: readySeat.profileId,
  state: "external",
  url: "https://login.example-idp.com/oauth",
  onProviderHost: false,
  observedAt: "2",
};
const closedEvent: ProviderWindowHealthEvent = {
  profileId: readySeat.profileId,
  state: "closed",
  url: null,
  onProviderHost: false,
  observedAt: "3",
};

const healthy = healthFromEvent(healthyEvent);
assert(healthy.open, "A Provider-host page load should mark the WebView open.");
assert(healthy.onProviderHost, "A Provider-host page load should be usable for Council actions.");
assert(providerWindowUsable(healthy), "Healthy Provider-host windows should be usable.");
assert(!providerRuntimeMustBeInvalidated(readySeat, healthyEvent), "Healthy seats must not be evicted.");

const external = healthFromEvent(externalEvent);
assert(external.open, "An auth/external navigation may leave the window physically open.");
assert(!providerWindowUsable(external), "An off-host WebView must not be allowed to act as a Council channel.");
assert(providerRuntimeMustBeInvalidated(readySeat, externalEvent), "A READY/SEATED advisor leaving the Provider host must be evicted.");

const closed = healthFromEvent(closedEvent);
assert(!closed.open, "Destroyed Provider windows must be marked closed.");
assert(!providerWindowUsable(closed), "Closed Provider windows must never be usable.");
assert(providerRuntimeMustBeInvalidated(readySeat, closedEvent), "Closing a seated Provider window must revoke the seat.");

const benchProfile: ProviderProfile = {
  ...readySeat,
  authState: "login_required",
  seatState: "bench",
};
assert(!providerRuntimeMustBeInvalidated(benchProfile, externalEvent), "An already-benched login flow should not trigger redundant runtime demotion.");
assert(!providerRuntimeMustBeInvalidated(benchProfile, closedEvent), "An already-benched closed profile needs no extra demotion.");

console.log("✓ ChatChat Provider window-health tests passed");
