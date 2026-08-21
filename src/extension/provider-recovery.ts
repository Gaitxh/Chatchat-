import type { ProviderPageInspection } from "./provider-page-inspection.js";

export type ProviderRecoveryFailure = "automatic_page_mapping_drift" | "not_recoverable";

export type ProviderRecoveryAction =
  | { kind: "navigate_clean_start"; url: string }
  | {
      kind: "none";
      reason:
        | "not_mapping_drift"
        | "login_owned_by_concierge"
        | "wrong_provider_origin"
        | "user_owned_tab"
        | "no_clean_start_url";
    };

export const RECOVERABLE_AUTO_SETUP_FAILURES = [
  "ChatChat could not confidently identify the AI message box automatically.",
  "ChatChat found the message box but could not confidently identify the send button.",
  "The detected send button did not become clickable after ChatChat filled the message box.",
  "Automatic page setup did not produce a complete browser recipe.",
] as const;

export function classifyProviderRecoveryFailure(detail: string | undefined): ProviderRecoveryFailure {
  const value = String(detail ?? "");
  return RECOVERABLE_AUTO_SETUP_FAILURES.some((message) => value.includes(message))
    ? "automatic_page_mapping_drift"
    : "not_recoverable";
}

export function planProviderRecovery(input: {
  failure: ProviderRecoveryFailure;
  createdByChatChat: boolean;
  participantOrigin: string;
  startUrl: string | undefined;
  inspection: ProviderPageInspection;
}): ProviderRecoveryAction {
  if (input.failure !== "automatic_page_mapping_drift") {
    return { kind: "none", reason: "not_mapping_drift" };
  }
  if (input.inspection.loginState === "needs_login") {
    return { kind: "none", reason: "login_owned_by_concierge" };
  }
  if (!input.inspection.urlMatchesProvider) {
    return { kind: "none", reason: "wrong_provider_origin" };
  }
  if (!input.createdByChatChat) {
    return { kind: "none", reason: "user_owned_tab" };
  }
  if (!input.startUrl || !sameOrigin(input.startUrl, input.participantOrigin)) {
    return { kind: "none", reason: "no_clean_start_url" };
  }
  return { kind: "navigate_clean_start", url: input.startUrl };
}

function sameOrigin(left: string, right: string): boolean {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}
