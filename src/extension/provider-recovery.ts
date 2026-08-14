import type { ProviderPageInspection } from "./provider-page-inspection.js";

export type ProviderRecoveryFailure = "automatic_page_mapping_drift" | "not_recoverable";

export type ProviderRecoveryAction =
  | { kind: "navigate_clean_start"; url: string }
  | { kind: "none"; reason: "not_mapping_drift" | "already_attempted" | "login_owned_by_concierge" | "wrong_provider_origin" | "user_owned_tab" | "no_clean_start_url" };

const MAPPING_FAILURES = [
  "Automatic page setup could not identify the message input.",
  "Automatic page setup could not identify the send control.",
  "Automatic page setup found a send control, but it did not become usable after filling the message.",
  "Automatic page setup did not produce a complete browser recipe.",
] as const;

export function classifyProviderRecoveryFailure(detail: string | undefined): ProviderRecoveryFailure {
  const value = String(detail ?? "");
  return MAPPING_FAILURES.some((message) => value.includes(message))
    ? "automatic_page_mapping_drift"
    : "not_recoverable";
}

export function planProviderRecovery(input: {
  failure: ProviderRecoveryFailure;
  attempted: boolean;
  createdByChatChat: boolean;
  participantOrigin: string;
  startUrl?: string;
  inspection: ProviderPageInspection;
}): ProviderRecoveryAction {
  if (input.failure !== "automatic_page_mapping_drift") return { kind: "none", reason: "not_mapping_drift" };
  if (input.attempted) return { kind: "none", reason: "already_attempted" };
  if (input.inspection.requiresLogin) return { kind: "none", reason: "login_owned_by_concierge" };
  if (!input.inspection.urlMatchesProvider) return { kind: "none", reason: "wrong_provider_origin" };
  if (!input.createdByChatChat) return { kind: "none", reason: "user_owned_tab" };
  if (!input.startUrl) return { kind: "none", reason: "no_clean_start_url" };
  if (origin(input.startUrl) !== origin(input.participantOrigin)) return { kind: "none", reason: "wrong_provider_origin" };
  return { kind: "navigate_clean_start", url: input.startUrl };
}

function origin(value: string): string {
  try { return new URL(value).origin; } catch { return ""; }
}
