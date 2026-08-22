import {
  appendBoundedBrowserAuthorityReceipt,
  deriveBrowserAuthoritySummary,
  mayDispatchProviderRetryUnderBrowserAuthority,
  sanitizeBrowserAuthorityReceipt,
  type BrowserAuthorityReceipt,
} from "../src/extension/browser-authority-ledger.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const now = "2026-08-22T08:40:00.000Z";
const managed: BrowserAuthorityReceipt = {
  seatId: "extension:openai-chatgpt:101",
  providerName: "ChatGPT",
  action: "fresh_session_navigation",
  trigger: "automatic",
  reason: "fresh_consultation",
  occurredAt: now,
  ownership: "managed",
};

const hostile = {
  ...managed,
  url: "https://chatgpt.com/private/thread",
  hostname: "chatgpt.com",
  origin: "https://chatgpt.com",
  prompt: "secret proposal",
  responseText: "private model response",
  cookie: "session=secret",
  token: "secret-token",
  account: "person@example.com",
} as BrowserAuthorityReceipt & Record<string, unknown>;
const sanitized = sanitizeBrowserAuthorityReceipt(hostile);
const serialized = JSON.stringify(sanitized);
for (const leaked of ["private/thread", "secret proposal", "private model response", "session=secret", "secret-token", "person@example.com"]) {
  assert(!serialized.includes(leaked), `allowlist sanitizer must discard browser/account content: ${leaked}`);
}
assert(Object.keys(sanitized).sort().join(",") === ["action", "occurredAt", "ownership", "providerName", "reason", "seatId", "trigger"].sort().join(","), "receipt shape must stay allowlisted");

let bounded: BrowserAuthorityReceipt[] = [];
for (let index = 0; index < 5; index += 1) {
  bounded = appendBoundedBrowserAuthorityReceipt(bounded, {
    ...managed,
    occurredAt: `2026-08-22T08:40:0${index}.000Z`,
  }, 3);
}
assert(bounded.length === 3, "authority ledger must honor its hard receipt bound");
assert(bounded[0]!.occurredAt.endsWith("02.000Z") && bounded[2]!.occurredAt.endsWith("04.000Z"), "bounded ledger must retain the newest receipts");

const participants = [
  { seatId: managed.seatId, providerName: "ChatGPT", createdByChatChat: true },
  { seatId: "extension:anthropic-claude:202", providerName: "Claude", createdByChatChat: true, automationProtected: true },
  { seatId: "user:gemini:303", providerName: "Gemini", createdByChatChat: false },
  { seatId: "legacy:deepseek:404", providerName: "DeepSeek" },
];
const summary = deriveBrowserAuthoritySummary(participants, [
  managed,
  { ...managed, action: "managed_tab_created", trigger: "explicit_user", reason: "invite_ai" },
  { ...managed, action: "automation_protected", trigger: "explicit_user", reason: "user_protection" },
]);
assert(summary.managedSeats === 1, "only an unprotected explicit ChatChat-created seat is managed");
assert(summary.protectedSeats === 3, "user-protected, user-owned, and missing legacy metadata must all deny background automation");
assert(summary.automaticActions === 1 && summary.explicitActions === 2, "authority changes must stay distinguishable from automatic browser actions");
assert(summary.protectedProviders.join(",") === "Claude,Gemini,DeepSeek", "all non-managed Provider names should stay visible in the protected summary");

const managedSeat = participants[0]!;
const protectedManagedSeat = participants[1]!;
const userOwnedSeat = participants[2]!;
const legacySeat = participants[3]!;
assert(mayDispatchProviderRetryUnderBrowserAuthority(managedSeat, "provider-tab-loaded"), "managed seat may automatically resume after its Provider page loads");
assert(mayDispatchProviderRetryUnderBrowserAuthority(managedSeat, "recovery"), "managed seat may run bounded recovery retry");
assert(!mayDispatchProviderRetryUnderBrowserAuthority(protectedManagedSeat, "provider-tab-loaded"), "user-protected ChatChat-created tab must reject background login/page-load resume");
assert(!mayDispatchProviderRetryUnderBrowserAuthority(protectedManagedSeat, "recovery"), "user-protected ChatChat-created tab must reject automatic recovery retry");
assert(mayDispatchProviderRetryUnderBrowserAuthority(protectedManagedSeat, "manual"), "explicit user retry remains allowed after automation revocation");
assert(!mayDispatchProviderRetryUnderBrowserAuthority(userOwnedSeat, "provider-tab-loaded"), "user-owned tab must reject background login/page-load resume");
assert(!mayDispatchProviderRetryUnderBrowserAuthority(userOwnedSeat, "recovery"), "user-owned tab must reject automatic recovery retry");
assert(!mayDispatchProviderRetryUnderBrowserAuthority(legacySeat, "provider-tab-loaded"), "legacy missing ownership metadata must fail closed for automatic resume");
assert(mayDispatchProviderRetryUnderBrowserAuthority(userOwnedSeat, "manual"), "explicit user retry remains allowed on a user-owned tab");

let rejected = false;
try {
  sanitizeBrowserAuthorityReceipt({ ...managed, ownership: "user-owned" as "managed" });
} catch {
  rejected = true;
}
assert(rejected, "a user-owned automatic-action receipt must fail closed instead of legitimizing the action");

console.log("✓ Browser Authority receipts are bounded, allowlisted, and ChatChat-created-provenance only");
console.log("✓ Managed automation is explicitly revocable while manual user action remains allowed");
