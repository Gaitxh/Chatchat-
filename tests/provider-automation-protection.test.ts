import {
  mayAutomaticallyNavigateProviderTab,
  mayAutomaticallyResumeProviderTab,
  providerTabOwnership,
  replaceRuntimeProtectedProviderSeats,
} from "../src/extension/provider-tab-boundary.js";
import { setProviderAutomationProtected } from "../src/extension/provider-automation-protection.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const key = "chatchat.consultation.participants.v1";
let writes = 0;
let memory: Record<string, unknown> = {
  [key]: [
    {
      seatId: "managed-seat",
      providerName: "ChatGPT",
      createdByChatChat: true,
      tabId: 101,
      url: "https://chatgpt.com/private-thread",
      automatic: true,
    },
    {
      seatId: "user-seat",
      providerName: "Claude",
      createdByChatChat: false,
      tabId: 202,
      url: "https://claude.ai/private-thread",
    },
  ],
};

const area = {
  async get(requested: string) {
    return { [requested]: memory[requested] };
  },
  async set(values: Record<string, unknown>) {
    writes += 1;
    memory = { ...memory, ...values };
  },
};
(globalThis as typeof globalThis & { chrome?: unknown }).chrome = {
  storage: { session: area, local: area },
};

replaceRuntimeProtectedProviderSeats([]);
const staleManaged = { seatId: "managed-seat", createdByChatChat: true };
assert(providerTabOwnership(staleManaged) === "managed", "fixture should begin managed");

const protectedResult = await setProviderAutomationProtected("managed-seat", true);
assert(protectedResult.changed && protectedResult.protected, "explicit Protect should persist a real authority transition");
assert(protectedResult.participant?.createdByChatChat === true, "Protect must preserve immutable ChatChat-created provenance");
assert(protectedResult.participant?.automationProtected === true, "Protect should persist the current revocation state");
assert(providerTabOwnership(staleManaged) === "protected", "runtime override must revoke stale in-memory objects immediately");
assert(!mayAutomaticallyNavigateProviderTab(staleManaged), "fresh-session navigation must stop immediately after Protect");
assert(!mayAutomaticallyResumeProviderTab(staleManaged), "background connection resume must stop immediately after Protect");
const protectedStored = (memory[key] as Array<Record<string, unknown>>)[0]!;
assert(protectedStored.createdByChatChat === true && protectedStored.automationProtected === true, "stored participant must separate provenance from authority state");
assert(protectedStored.url === "https://chatgpt.com/private-thread", "Protect must preserve the existing participant record rather than recreating or closing the tab");

const duplicateProtect = await setProviderAutomationProtected("managed-seat", true);
assert(!duplicateProtect.changed && duplicateProtect.reason === "unchanged", "repeated Protect must be idempotent");

const userAttempt = await setProviderAutomationProtected("user-seat", false);
assert(!userAttempt.changed && userAttempt.reason === "not_chatchat_created", "user-owned tabs can never be upgraded into managed automation");
assert(providerTabOwnership({ seatId: "user-seat", createdByChatChat: false }) === "user-owned", "user-owned provenance must remain immutable");

const restoreResult = await setProviderAutomationProtected("managed-seat", false);
assert(restoreResult.changed && !restoreResult.protected, "explicit Allow automation may restore only an eligible ChatChat-created tab");
assert(restoreResult.participant?.createdByChatChat === true, "restoration must still preserve creation provenance");
assert(restoreResult.participant?.automationProtected === false, "restoration should persist the current authority state");
assert(providerTabOwnership(staleManaged) === "managed", "runtime authority should be restored immediately after explicit user action");
assert(mayAutomaticallyNavigateProviderTab(staleManaged), "fresh-session navigation may resume only after explicit restoration");
assert(mayAutomaticallyResumeProviderTab(staleManaged), "background connection resume may resume only after explicit restoration");
assert(writes === 2, "only the real protect + restore transitions should write participant storage");

console.log("✓ Provider automation protection preserves provenance while revoking and restoring current authority");
console.log("✓ Protect is immediate/idempotent and user-owned tabs can never be promoted to managed automation");
