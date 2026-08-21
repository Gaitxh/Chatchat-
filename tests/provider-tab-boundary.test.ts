import {
  mayAutomaticallyNavigateProviderTab,
  mayAutomaticallyResumeProviderTab,
  providerTabOwnership,
} from "../src/extension/provider-tab-boundary.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const managed = { createdByChatChat: true };
const userOwned = { createdByChatChat: false };
const legacy = {};

assert(providerTabOwnership(managed) === "managed", "Only an explicit ChatChat-created receipt may classify a Provider tab as managed.");
assert(providerTabOwnership(userOwned) === "user-owned", "An explicitly user-owned Provider tab must remain user-owned.");
assert(providerTabOwnership(legacy) === "user-owned", "Legacy records without ownership metadata must fail closed as user-owned.");

assert(mayAutomaticallyNavigateProviderTab(managed), "ChatChat-created clean Provider tabs may be navigated by bounded automatic session preparation.");
assert(!mayAutomaticallyNavigateProviderTab(userOwned), "User-owned Provider tabs must never be automatically navigated.");
assert(!mayAutomaticallyNavigateProviderTab(legacy), "Missing ownership metadata must never grant automatic navigation authority.");

assert(mayAutomaticallyResumeProviderTab(managed), "ChatChat-created Provider tabs may resume bounded connection setup after hydration.");
assert(!mayAutomaticallyResumeProviderTab(userOwned), "User-owned Provider tabs must not receive background connection prompts after hydration.");
assert(!mayAutomaticallyResumeProviderTab(legacy), "Legacy Provider tabs must require an explicit user action before reconnecting.");

console.log("✓ ChatChat Provider tab ownership boundary tests passed");
console.log("✓ Automatic navigation and background reconnect authority fail closed to ChatChat-created clean tabs only");
