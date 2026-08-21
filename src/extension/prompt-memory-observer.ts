import { rememberProviderPromptMemorySelection } from "../provider-sdk/prompt-memory-audit.js";
import { rememberProviderPublicDeck } from "../provider-sdk/public-deck-audit.js";

declare const chrome: any;

const MARKER = "__chatchatPromptMemoryObserverV1" as const;

type ObservedSendMessage = ((tabId: number, payload: any, ...rest: any[]) => Promise<any>) & {
  [MARKER]?: true;
};

installPromptMemoryObserver();

/**
 * Read-only observer for the exact ChatChat RUN_SPEECH string.
 *
 * This wrapper must never mutate the payload, response, ordering, timeout or
 * retry behavior. Its only job is to remember explicit ChatChat memory metadata
 * and the exact serialized public Blackboard deck so transport receipts and
 * fairness audits can prove what was actually sent rather than relying only on
 * selector intent.
 */
function installPromptMemoryObserver(): void {
  const tabs = typeof chrome !== "undefined" ? chrome?.tabs : undefined;
  if (!tabs || typeof tabs.sendMessage !== "function") return;
  const existing = tabs.sendMessage as ObservedSendMessage;
  if (existing[MARKER]) return;
  const original = tabs.sendMessage.bind(tabs);

  const wrapped = (async (tabId: number, payload: any, ...rest: any[]) => {
    if (
      payload?.__chatchat
      && payload.type === "RUN_SPEECH"
      && typeof payload.prompt === "string"
      && !isHandshakePrompt(payload.prompt)
    ) {
      const prompt = String(payload.prompt);
      rememberProviderPromptMemorySelection(prompt);
      rememberProviderPublicDeck(prompt);
    }
    return original(tabId, payload, ...rest);
  }) as ObservedSendMessage;

  wrapped[MARKER] = true;
  try {
    tabs.sendMessage = wrapped;
  } catch {
    // A non-writable browser API must never break consultation execution.
  }
}

function isHandshakePrompt(prompt: string): boolean {
  return /automatic connection handshake|connection test|Protocol handshake only/i.test(prompt);
}
