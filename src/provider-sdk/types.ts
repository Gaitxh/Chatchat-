import type { CouncilAgent, CouncilContext, CouncilContribution } from "../core/types.js";

export type ProviderAuthState =
  | "login_required"
  | "ready"
  | "adapter_required"
  | "error";

export type ProviderSeatState = "bench" | "seated";

export type ProviderProfileBackend = "sqlite" | "browser-local";

export interface ProviderAdapterCapabilities {
  webLogin: boolean;
  streaming: boolean;
  councilTurns: boolean;
}

export interface ProviderAdapterManifest {
  id: string;
  providerId: string;
  displayName: string;
  version: string;
  domains: readonly string[];
  defaultUrl: string;
  monogram: string;
  capabilities: ProviderAdapterCapabilities;
}

export interface ProviderDetection {
  kind: "known" | "custom";
  manifest: ProviderAdapterManifest | null;
  normalizedUrl: string;
  origin: string;
  hostname: string;
  displayName: string;
  providerId: string;
  adapterId: string;
}

export interface ProviderProfile {
  profileId: string;
  providerId: string;
  adapterId: string;
  displayName: string;
  url: string;
  origin: string;
  profileKey: string;
  authState: ProviderAuthState;
  seatState: ProviderSeatState;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderProfileStore {
  readonly backend: ProviderProfileBackend;
  list(): Promise<ProviderProfile[]>;
  save(profile: ProviderProfile): Promise<void>;
  remove(profileId: string): Promise<void>;
}

export interface ProviderAdapterSession {
  readonly profile: ProviderProfile;
  getAuthState(): Promise<ProviderAuthState>;
  createCouncilAgent(): Promise<CouncilAgent>;
}

/**
 * Community Provider Adapters implement this contract.
 *
 * v0.4 defines the contract and local profiles. Real website automation lands
 * in later versions, so built-in catalog entries do not yet provide sessions.
 */
export interface ProviderAdapter {
  readonly manifest: ProviderAdapterManifest;
  matches(url: URL): boolean;
  open(profile: ProviderProfile): Promise<ProviderAdapterSession>;
}

export interface ProviderCouncilTurn {
  context: CouncilContext;
  contributions: readonly CouncilContribution[];
}
