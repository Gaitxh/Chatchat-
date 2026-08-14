export type ProviderConnectionFailureKind =
  | "login_required"
  | "stale_recipe"
  | "composer_missing"
  | "send_missing"
  | "response_timeout"
  | "protocol_failure"
  | "off_provider"
  | "unknown";

export type ProviderRecoveryStep =
  | "wait_for_login"
  | "fresh_session_rediscovery"
  | "advanced_repair";

export type ProviderRecoveryAttemptPhase =
  | "resetting"
  | "reconnecting"
  | "exhausted";

export type ProviderRecoveryConnectionState =
  | "idle"
  | "connecting"
  | "ready"
  | "failed";

export interface ProviderRecoveryPlanInput {
  failureKind: ProviderConnectionFailureKind;
  createdByChatChat: boolean;
  onExpectedOrigin: boolean;
  loginRequired: boolean;
  freshSessionAlreadyTried: boolean;
}

export interface ProviderRecoveryAttemptInput {
  phase: ProviderRecoveryAttemptPhase;
  connectionState: ProviderRecoveryConnectionState;
  resetWaitExpired?: boolean;
}

export interface ProviderRecoveryAttemptState {
  phase: ProviderRecoveryAttemptPhase | null;
  visible: boolean;
}

export function classifyProviderConnectionFailure(error: unknown): ProviderConnectionFailureKind {
  const value = error instanceof Error ? error.message : String(error ?? "");
  const text = value.toLowerCase();

  if (/waiting for (?:sign.?in|login)|needs? (?:sign.?in|login)|authentication required/.test(text)) {
    return "login_required";
  }
  if (/configured .*selector no longer matches|recipe.*(?:stale|invalid|incomplete)/.test(text)) {
    return "stale_recipe";
  }
  if (/could not confidently identify the ai message box|composer.*(?:missing|not found|unavailable)/.test(text)) {
    return "composer_missing";
  }
  if (/could not confidently identify the send button|send button.*(?:unavailable|not found|clickable)/.test(text)) {
    return "send_missing";
  }
  if (/did not return .* in time|timed out waiting|response.*timeout/.test(text)) {
    return "response_timeout";
  }
  if (/structured consultation output failed|consultation protocol|protocol.*(?:failed|not ready|rejected)/.test(text)) {
    return "protocol_failure";
  }
  if (/off.?provider|unexpected origin|provider origin/.test(text)) {
    return "off_provider";
  }
  return "unknown";
}

export function planProviderRecovery(input: ProviderRecoveryPlanInput): ProviderRecoveryStep {
  if (input.loginRequired || input.failureKind === "login_required") return "wait_for_login";

  const safeFreshSessionFailure = new Set<ProviderConnectionFailureKind>([
    "stale_recipe",
    "composer_missing",
    "send_missing",
    "response_timeout",
    "protocol_failure",
    "unknown",
  ]);

  if (
    input.createdByChatChat &&
    input.onExpectedOrigin &&
    !input.freshSessionAlreadyTried &&
    safeFreshSessionFailure.has(input.failureKind)
  ) {
    return "fresh_session_rediscovery";
  }

  return "advanced_repair";
}

/**
 * Advance one already-authorized self-healing attempt without ever granting a
 * second automatic reset. `exhausted` is sticky until the participant reaches
 * READY or leaves the room; this keeps retry prevention separate from the
 * user-visible "currently healing" state.
 */
export function advanceProviderRecoveryAttempt(
  input: ProviderRecoveryAttemptInput,
): ProviderRecoveryAttemptState {
  if (input.connectionState === "ready") {
    return { phase: null, visible: false };
  }

  if (input.phase === "exhausted") {
    return { phase: "exhausted", visible: false };
  }

  if (input.phase === "resetting") {
    if (input.resetWaitExpired || input.connectionState === "idle") {
      return { phase: "exhausted", visible: false };
    }
    if (input.connectionState === "connecting") {
      return { phase: "reconnecting", visible: true };
    }
    return { phase: "resetting", visible: true };
  }

  if (input.connectionState === "failed" || input.connectionState === "idle") {
    return { phase: "exhausted", visible: false };
  }

  if (input.connectionState === "connecting") {
    return { phase: "reconnecting", visible: true };
  }

  return { phase: "reconnecting", visible: true };
}
