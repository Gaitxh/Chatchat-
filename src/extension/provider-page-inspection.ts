import { classifyLoginState, type LoginState } from "./login-state.js";

declare const chrome: any;

export interface ProviderPageSignals {
  passwordInputs: number;
  loginControls: number;
  composerCandidates: number;
}

export interface ProviderPageInspection extends ProviderPageSignals {
  tabId: number;
  onExpectedOrigin: boolean;
  loginState: LoginState;
}

const EMPTY_SIGNALS: ProviderPageSignals = {
  passwordInputs: 0,
  loginControls: 0,
  composerCandidates: 0,
};

/**
 * Inspect only bounded, derived page metadata needed for connection recovery.
 * Raw URL/title are used transiently inside this classifier and are not
 * returned to recovery/concierge callers. No prompt text, model response,
 * sidebar/chat history, account identifier, cookie, token or credential value
 * is returned.
 */
export async function inspectProviderPage(
  tabId: number,
  expectedOrigin: string,
): Promise<ProviderPageInspection | null> {
  let tab: { url?: string; title?: string };
  try {
    tab = await chrome.tabs.get(tabId);
  } catch {
    return null;
  }

  const currentUrl = String(tab?.url ?? "");
  if (!currentUrl) return null;
  const onExpectedOrigin = sameOrigin(expectedOrigin, currentUrl);
  const signals = onExpectedOrigin
    ? await inspectSameOriginSignals(tabId)
    : EMPTY_SIGNALS;
  const title = String(tab?.title ?? "");

  return {
    tabId,
    onExpectedOrigin,
    ...signals,
    loginState: classifyLoginState({
      expectedOrigin,
      currentUrl,
      title,
      ...signals,
    }),
  };
}

async function inspectSameOriginSignals(tabId: number): Promise<ProviderPageSignals> {
  try {
    const result = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const visible = (element: Element) => {
          if (!(element instanceof HTMLElement)) return false;
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return (
            rect.width > 2 &&
            rect.height > 2 &&
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity || "1") > 0.01
          );
        };
        const label = (element: Element) => [
          element.getAttribute("aria-label"),
          element.getAttribute("title"),
          element.textContent,
        ].filter(Boolean).join(" ").slice(0, 500);
        const passwordInputs = [...document.querySelectorAll('input[type="password"]')]
          .filter(visible).length;
        const loginControls = [...document.querySelectorAll("button,a,[role='button']")]
          .filter(visible)
          .filter((element) => /log\s*in|sign\s*in|continue\s+with|登录|登入|登陆/i.test(label(element))).length;
        const composerCandidates = [...document.querySelectorAll("textarea,[contenteditable='true'],input")]
          .filter(visible)
          .filter((element) => {
            if (!(element instanceof HTMLInputElement)) return true;
            return !["password", "email", "search", "tel", "url", "hidden", "file"].includes(element.type);
          }).length;
        return { passwordInputs, loginControls, composerCandidates };
      },
    });
    const value = result?.[0]?.result as ProviderPageSignals | undefined;
    return value ?? EMPTY_SIGNALS;
  } catch {
    return EMPTY_SIGNALS;
  }
}

function sameOrigin(expectedOrigin: string, currentUrl: string): boolean {
  try {
    return new URL(expectedOrigin).origin === new URL(currentUrl).origin;
  } catch {
    return false;
  }
}
