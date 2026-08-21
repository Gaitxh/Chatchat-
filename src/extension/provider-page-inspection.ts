import { classifyLoginState, type LoginState } from "./login-state.js";

declare const chrome: any;

export interface ProviderPageInspection {
  currentUrl: string;
  title: string;
  urlMatchesProvider: boolean;
  passwordInputs: number;
  loginControls: number;
  composerCandidates: number;
  loginState: LoginState;
}

interface PageSignals {
  passwordInputs: number;
  loginControls: number;
  composerCandidates: number;
}

const EMPTY_SIGNALS: PageSignals = {
  passwordInputs: 0,
  loginControls: 0,
  composerCandidates: 0,
};

/**
 * Inspect only bounded page-shape metadata. No prompt text, response text,
 * account identifiers, cookies, tokens or credentials cross this boundary.
 */
export async function inspectProviderPage(input: {
  tabId: number;
  expectedOrigin: string;
}): Promise<ProviderPageInspection> {
  const tab = await chrome.tabs.get(input.tabId);
  const currentUrl = String(tab?.url ?? "");
  const title = String(tab?.title ?? "");
  const urlMatchesProvider = sameOrigin(currentUrl, input.expectedOrigin);
  const signals = urlMatchesProvider
    ? await inspectSameOriginPage(input.tabId).catch(() => EMPTY_SIGNALS)
    : EMPTY_SIGNALS;
  const loginState = classifyLoginState({
    expectedOrigin: input.expectedOrigin,
    currentUrl,
    title,
    ...signals,
  });

  return {
    currentUrl,
    title,
    urlMatchesProvider,
    ...signals,
    loginState,
  };
}

async function inspectSameOriginPage(tabId: number): Promise<PageSignals> {
  const [{ result } = {}] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const visible = (element: Element) => {
        if (!(element instanceof HTMLElement)) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 2
          && rect.height > 2
          && style.display !== "none"
          && style.visibility !== "hidden"
          && Number(style.opacity || "1") > 0.01;
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

  return {
    passwordInputs: Number(result?.passwordInputs ?? 0),
    loginControls: Number(result?.loginControls ?? 0),
    composerCandidates: Number(result?.composerCandidates ?? 0),
  };
}

function sameOrigin(left: string, right: string): boolean {
  try {
    return new URL(left).origin === new URL(right).origin;
  } catch {
    return false;
  }
}
