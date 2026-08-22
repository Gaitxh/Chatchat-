import {
  mayAutomaticallyNavigateProviderTab,
  mayAutomaticallyResumeProviderTab,
  providerTabOwnership,
  replaceRuntimeProtectedProviderSeats,
  setRuntimeProviderSeatProtected,
} from "../src/extension/provider-tab-boundary.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const managed = { seatId: "managed", createdByChatChat: true };
const protectedManaged = { seatId: "protected", createdByChatChat: true, automationProtected: true };
const userOwned = { seatId: "user", createdByChatChat: false };
const legacy = { seatId: "legacy" };

replaceRuntimeProtectedProviderSeats([]);
assert(providerTabOwnership(managed) === "managed", "Only an explicit ChatChat-created receipt may classify a Provider tab as managed.");
assert(providerTabOwnership(protectedManaged) === "protected", "A ChatChat-created tab with explicit user revocation must retain provenance while losing automation authority.");
assert(providerTabOwnership(userOwned) === "user-owned", "An explicitly user-owned Provider tab must remain user-owned.");
assert(providerTabOwnership(legacy) === "user-owned", "Legacy records without ownership metadata must fail closed as user-owned.");

assert(mayAutomaticallyNavigateProviderTab(managed), "ChatChat-created clean Provider tabs may be navigated by bounded automatic session preparation.");
assert(!mayAutomaticallyNavigateProviderTab(protectedManaged), "A protected ChatChat-created tab must not be automatically navigated.");
assert(!mayAutomaticallyNavigateProviderTab(userOwned), "User-owned Provider tabs must never be automatically navigated.");
assert(!mayAutomaticallyNavigateProviderTab(legacy), "Missing ownership metadata must never grant automatic navigation authority.");

assert(mayAutomaticallyResumeProviderTab(managed), "ChatChat-created Provider tabs may resume bounded connection setup after hydration.");
assert(!mayAutomaticallyResumeProviderTab(protectedManaged), "A protected ChatChat-created tab must not receive background connection prompts.");
assert(!mayAutomaticallyResumeProviderTab(userOwned), "User-owned Provider tabs must not receive background connection prompts after hydration.");
assert(!mayAutomaticallyResumeProviderTab(legacy), "Legacy Provider tabs must require an explicit user action before reconnecting.");

// Runtime revocation must override stale React objects that still say automationProtected=false/undefined.
setRuntimeProviderSeatProtected(managed.seatId, true);
assert(providerTabOwnership(managed) === "protected", "Runtime protection must immediately override stale participant state.");
assert(!mayAutomaticallyNavigateProviderTab(managed), "Runtime-protected stale participants must lose automatic navigation immediately.");
assert(!mayAutomaticallyResumeProviderTab(managed), "Runtime-protected stale participants must lose background resume immediately.");
setRuntimeProviderSeatProtected(managed.seatId, false);
assert(providerTabOwnership(managed) === "managed", "Explicit authority restoration may re-enable a ChatChat-created clean tab.");

// Replacing the runtime snapshot must revoke exactly the latest protected seats.
replaceRuntimeProtectedProviderSeats([managed.seatId]);
assert(providerTabOwnership(managed) === "protected", "Runtime protection snapshot must be authoritative for the current browser session.");
replaceRuntimeProtectedProviderSeats([]);
assert(providerTabOwnership(managed) === "managed", "Clearing the latest protection snapshot restores only eligible ChatChat-created tabs.");

console.log("✓ ChatChat Provider tab ownership boundary tests passed");
console.log("✓ Automatic navigation/background reconnect authority is revocable without rewriting tab-creation provenance");
