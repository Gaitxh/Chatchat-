import {
  appendBoundedBrowserAuthorityReceipt,
  BROWSER_AUTHORITY_RECEIPTS_KEY,
  type BrowserAuthorityActionKind,
  type BrowserAuthorityReason,
  type BrowserAuthorityReceipt,
  type BrowserAuthorityTrigger,
} from "./browser-authority-ledger.js";

declare const chrome: any;

let writeQueue = Promise.resolve();

export async function recordBrowserAuthorityAction(input: {
  seatId: string;
  providerName: string;
  action: BrowserAuthorityActionKind;
  trigger: BrowserAuthorityTrigger;
  reason: BrowserAuthorityReason;
  occurredAt?: string;
}): Promise<void> {
  const receipt: BrowserAuthorityReceipt = {
    seatId: input.seatId,
    providerName: input.providerName,
    action: input.action,
    trigger: input.trigger,
    reason: input.reason,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    ownership: "managed",
  };

  const task = writeQueue.then(async () => {
    const store = chrome.storage.session ?? chrome.storage.local;
    const stored = await store.get(BROWSER_AUTHORITY_RECEIPTS_KEY);
    const current = Array.isArray(stored?.[BROWSER_AUTHORITY_RECEIPTS_KEY])
      ? stored[BROWSER_AUTHORITY_RECEIPTS_KEY] as BrowserAuthorityReceipt[]
      : [];
    const next = appendBoundedBrowserAuthorityReceipt(current, receipt);
    await store.set({ [BROWSER_AUTHORITY_RECEIPTS_KEY]: next });
  });
  writeQueue = task.then(() => undefined, () => undefined);
  return task;
}

export async function readBrowserAuthorityReceipts(): Promise<BrowserAuthorityReceipt[]> {
  const store = chrome.storage.session ?? chrome.storage.local;
  const stored = await store.get(BROWSER_AUTHORITY_RECEIPTS_KEY);
  const current = stored?.[BROWSER_AUTHORITY_RECEIPTS_KEY];
  return Array.isArray(current) ? current : [];
}
