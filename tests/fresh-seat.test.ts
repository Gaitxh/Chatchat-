import {
  createFreshSeat,
  FreshSeatError,
  planFreshSeat,
  type FreshSeatIO,
  type FreshSeatParticipant,
} from "../src/extension/fresh-seat.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function rejects(operation: () => unknown, code?: FreshSeatError["code"]) {
  try { await operation(); }
  catch (error) {
    if (code) assert(error instanceof FreshSeatError && error.code === code, `Expected ${code}, got ${String(error)}`);
    return;
  }
  throw new Error(`Expected rejection${code ? `: ${code}` : ""}`);
}

const knownEntries = [
  ["https://chatgpt.com/c/private?model=old#thread", "https://chatgpt.com/"],
  ["https://claude.ai/chat/private", "https://claude.ai/new"],
  ["https://gemini.google.com/app/private", "https://gemini.google.com/app"],
  ["https://chat.deepseek.com/a/chat/s/private", "https://chat.deepseek.com/"],
  ["https://yuanbao.tencent.com/chat/private", "https://yuanbao.tencent.com/"],
  ["https://tongyi.aliyun.com/qianwen/private", "https://tongyi.aliyun.com/"],
  ["https://grok.com/c/private", "https://grok.com/"],
  ["https://qwen.ai/c/private", "https://chat.qwen.ai/"],
] as const;
for (const [source, expected] of knownEntries) {
  const plan = planFreshSeat(source);
  assert(plan.startUrl === expected, `Old conversation must resolve to ${expected}`);
  assert(plan.source.normalizedUrl !== plan.startUrl, "Source remains a discovery hint, not the seat URL");
  assert(plan.permissionOrigins.includes(new URL(source).origin), "Source permission origin is preserved");
  assert(plan.permissionOrigins.includes(new URL(expected).origin), "Canonical permission origin is included");
}
const aliases = planFreshSeat("https://qwen.ai/c/private");
assert(aliases.permissionOrigins.join(",") === "https://qwen.ai,https://chat.qwen.ai", "Alias permission must not replace target permission");

for (const input of ["", "javascript:alert(1)", "file:///tmp/chat", "chrome://settings", "https://", "https://user:secret@claude.ai/chat/old"]) {
  await rejects(() => planFreshSeat(input), "invalid-url");
}
await rejects(() => planFreshSeat("https://custom.example/chat/old"), "custom-confirmation-required");
await rejects(() => planFreshSeat("https://custom.example/"), "custom-confirmation-required");
await rejects(() => planFreshSeat("https://custom.example/new", { confirmedCustomUrl: "https://custom.example/other" }), "custom-confirmation-required");
const custom = "https://custom.example/new?mode=blank#/new";
const customPlan = planFreshSeat(custom, { confirmedCustomUrl: custom });
assert(customPlan.startUrl === custom && customPlan.destination.kind === "custom", "Explicit custom new-chat URLs remain usable, including hash routes");
await rejects(() => planFreshSeat("https://custom.example/#/chat/old", { confirmedCustomUrl: "https://custom.example/#/new" }), "custom-confirmation-required");

function fixture() {
  const original = { id: 7, url: "https://claude.ai/chat/user-conversation", title: "My private chat" };
  const tabs = new Map<number, { url: string }>([[original.id, { url: original.url }]]);
  const operations: { kind: string; tabId: number }[] = [];
  const opened: string[] = [];
  const permissions: string[][] = [];
  let participants: FreshSeatParticipant[] = [];
  let nextId = 100;
  const io: FreshSeatIO = {
    async readParticipants() { return [...participants]; },
    async writeParticipants(next) { participants = [...next]; },
    async requestPermissions(origins) { permissions.push([...origins]); },
    async createTab(url) { const id = nextId++; tabs.set(id, { url }); opened.push(url); return { id }; },
    async waitForTab(tabId) { operations.push({ kind: "wait", tabId }); },
    async getTab(tabId) {
      operations.push({ kind: "get", tabId });
      const tab = tabs.get(tabId);
      if (!tab) throw new Error("Missing tab");
      return { ...tab };
    },
    async removeTab(tabId) { operations.push({ kind: "remove", tabId }); tabs.delete(tabId); },
  };
  return { original, tabs, operations, opened, permissions, io, participants: () => participants };
}

const oldTab = fixture();
const sourcePlan = planFreshSeat(oldTab.original.url, { sourceTabId: oldTab.original.id });
const result = await createFreshSeat(sourcePlan, oldTab.io);
// The caller can now connect ONLY the returned, committed participant.
const connectionTargets = [result.participant.tabId];
assert(result.participant.tabId !== oldTab.original.id && result.participant.createdByChatChat, "Discovered/current tabs produce separate managed seats");
assert(oldTab.tabs.get(7)?.url === oldTab.original.url, "Original user conversation is never navigated");
assert(oldTab.operations.every((operation) => operation.tabId !== 7), "Add never reads, waits on, removes, injects into or handshakes with the source tab");
assert(connectionTargets.every((id) => id !== 7), "Only the new seat can receive the connection handshake");
assert(oldTab.opened[0] === "https://claude.ai/new", "Created tab uses the fresh entry, not the old conversation");
assert(result.participant.startUrl === "https://claude.ai/new", "Future session preparation keeps the planned entry");
await rejects(() => createFreshSeat(sourcePlan, oldTab.io), "duplicate-origin");
assert(oldTab.opened.length === 1, "A pre-existing seat must not create another tab");

const customSeat = fixture();
const customResult = await createFreshSeat(customPlan, customSeat.io);
assert(customResult.participant.providerId === "custom" && customResult.participant.startUrl === custom, "Custom seat keeps the user's confirmed new-chat entry for future preparation");

const denied = fixture();
denied.io.requestPermissions = async () => { throw new Error("Denied"); };
await rejects(() => createFreshSeat(sourcePlan, denied.io));
assert(denied.opened.length === 0 && denied.participants().length === 0, "Denied permission never opens a tab or persists a seat");

const failedCreate = fixture();
failedCreate.io.createTab = async () => { throw new Error("Create failed"); };
await rejects(() => createFreshSeat(sourcePlan, failedCreate.io));
assert(failedCreate.tabs.size === 1 && failedCreate.participants().length === 0, "Failed creation leaves only the original user tab");

for (const failure of ["load", "read", "persist", "redirect", "invalid-redirect"] as const) {
  const f = fixture();
  if (failure === "load") f.io.waitForTab = async () => { throw new Error("Load timeout"); };
  if (failure === "read") f.io.getTab = async () => { throw new Error("Tab disappeared"); };
  if (failure === "persist") f.io.writeParticipants = async () => { throw new Error("Storage failed"); };
  if (failure === "redirect") f.io.getTab = async () => ({ url: "https://other.example/new" });
  if (failure === "invalid-redirect") f.io.getTab = async () => ({ url: "chrome://settings" });
  await rejects(() => createFreshSeat(sourcePlan, f.io));
  assert(f.tabs.size === 1 && f.tabs.has(7), `${failure}: uncommitted new tab is closed; original tab survives`);
  assert(f.participants().length === 0, `${failure}: no failed seat is persisted`);
}

const lateDuplicate = fixture();
lateDuplicate.io.waitForTab = async () => {
  await lateDuplicate.io.writeParticipants([{ ...result.participant, tabId: 999, seatId: "competing-seat" }]);
};
await rejects(() => createFreshSeat(sourcePlan, lateDuplicate.io), "duplicate-origin");
assert(lateDuplicate.tabs.size === 1 && lateDuplicate.participants()[0]?.seatId === "competing-seat", "Duplicate recheck closes the redundant new tab and preserves the competing seat");

const concurrent = fixture();
const attempts = await Promise.allSettled([
  createFreshSeat(sourcePlan, concurrent.io), createFreshSeat(sourcePlan, concurrent.io),
]);
assert(attempts.filter((item) => item.status === "fulfilled").length === 1, "Concurrent Adds admit only one seat per origin");
assert(concurrent.opened.length === 1 && concurrent.participants().length === 1, "Concurrent duplicate is rejected before creating a second tab");

const independent = fixture();
await Promise.all([
  createFreshSeat(sourcePlan, independent.io),
  createFreshSeat(planFreshSeat("https://chatgpt.com/c/old"), independent.io),
]);
assert(independent.participants().length === 2, "Concurrent different providers cannot overwrite sibling seats");

const full = fixture();
await full.io.writeParticipants(Array.from({ length: 8 }, (_, index) => ({ ...result.participant, origin: `https://ai${index}.example` })));
await rejects(() => createFreshSeat(sourcePlan, full.io), "capacity");
assert(full.opened.length === 0, "Full room never leaks another tab");

const wrongId = fixture();
wrongId.io.createTab = async () => ({ id: 7 });
await rejects(() => createFreshSeat(sourcePlan, wrongId.io), "tab-create-failed");
assert(wrongId.operations.length === 0 && wrongId.tabs.has(7), "Even an unexpected create response cannot authorize touching the original tab");

const cleanup = fixture();
cleanup.io.waitForTab = async () => { throw new Error("Load failed"); };
cleanup.io.removeTab = async () => { throw new Error("Remove failed"); };
await rejects(() => createFreshSeat(sourcePlan, cleanup.io), "cleanup-failed");
assert(cleanup.participants().length === 0, "Cleanup failure is explicit and never becomes an admitted seat");

console.log("✓ Fresh-seat planning, source-tab isolation, custom confirmation, permissions, cleanup and duplicate tests passed");
