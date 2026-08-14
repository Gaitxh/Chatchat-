import {
  advanceProviderRecoveryAttempt,
  classifyProviderConnectionFailure,
  planProviderRecovery,
} from "../src/extension/provider-recovery.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

assert(classifyProviderConnectionFailure(new Error("Configured composer selector no longer matches the Provider page.")) === "stale_recipe", "stale selectors should be classified as stale recipe");
assert(classifyProviderConnectionFailure(new Error("ChatChat could not confidently identify the AI message box automatically.")) === "composer_missing", "missing composer should be explicit");
assert(classifyProviderConnectionFailure(new Error("ChatChat found the message box but could not confidently identify the send button.")) === "send_missing", "missing send control should be explicit");
assert(classifyProviderConnectionFailure(new Error("The AI page did not return CHATCHAT_READY in time.")) === "response_timeout", "connection response timeout should be explicit");
assert(classifyProviderConnectionFailure(new Error("Structured consultation output failed twice.")) === "protocol_failure", "protocol/parser failure should be explicit");

assert(planProviderRecovery({ failureKind: "composer_missing", createdByChatChat: true, onExpectedOrigin: true, loginRequired: false, freshSessionAlreadyTried: false }) === "fresh_session_rediscovery", "ChatChat-created clean tabs may safely get one fresh-session recovery");
assert(planProviderRecovery({ failureKind: "composer_missing", createdByChatChat: false, onExpectedOrigin: true, loginRequired: false, freshSessionAlreadyTried: false }) === "advanced_repair", "user-owned tabs must never be navigated for recovery");
assert(planProviderRecovery({ failureKind: "off_provider", createdByChatChat: true, onExpectedOrigin: false, loginRequired: false, freshSessionAlreadyTried: false }) === "advanced_repair", "off-origin tabs must fail closed");
assert(planProviderRecovery({ failureKind: "unknown", createdByChatChat: true, onExpectedOrigin: true, loginRequired: true, freshSessionAlreadyTried: false }) === "wait_for_login", "Provider login must be owned by Login Concierge, not fresh-session recovery");
assert(planProviderRecovery({ failureKind: "response_timeout", createdByChatChat: true, onExpectedOrigin: true, loginRequired: false, freshSessionAlreadyTried: true }) === "advanced_repair", "fresh-session recovery must be bounded to one attempt");

const initialReset = advanceProviderRecoveryAttempt({ phase: "resetting", connectionState: "failed" });
assert(initialReset.phase === "resetting" && initialReset.visible, "the one-shot reset should be visibly self-healing while waiting for auto-resume");

const reconnecting = advanceProviderRecoveryAttempt({ phase: "resetting", connectionState: "connecting" });
assert(reconnecting.phase === "reconnecting" && reconnecting.visible, "the existing automatic connector should keep the self-healing state visible while reconnecting");

const exhausted = advanceProviderRecoveryAttempt({ phase: "reconnecting", connectionState: "failed" });
assert(exhausted.phase === "exhausted" && !exhausted.visible, "a failed post-reset reconnect must stop claiming that self-healing is still running");

const stickyExhausted = advanceProviderRecoveryAttempt({ phase: "exhausted", connectionState: "connecting" });
assert(stickyExhausted.phase === "exhausted" && !stickyExhausted.visible, "later manual/login retries must not be relabeled as self-healing or authorize another reset");

const resetTimeout = advanceProviderRecoveryAttempt({ phase: "resetting", connectionState: "failed", resetWaitExpired: true });
assert(resetTimeout.phase === "exhausted" && !resetTimeout.visible, "a reset that never reaches the automatic connector must stop showing an endless healing state");

const recovered = advanceProviderRecoveryAttempt({ phase: "reconnecting", connectionState: "ready" });
assert(recovered.phase === null && !recovered.visible, "READY should retire the recovery attempt completely");

console.log("✓ ChatChat Provider self-healing recovery ladder tests passed");
