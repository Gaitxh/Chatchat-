import { classifyLoginState } from "./login-state.js";

declare const chrome: any;

export const INSPECT_PROVIDER_PAGE = "INSPECT_PROVIDER_PAGE";

export interface ProviderPageInspection {
  url: string;
  title: string;
  urlMatchesProvider: boolean;
  passwordInputs: number;
  loginControls: number;
  composerCandidates: number;
  requiresLogin: boolean;
}

interface RawInspection {
  url: string;
  title: string;
  urlMatchesProvider: boolean;
  passwordInputs: number;
  loginControls: number;
  composerCandidates: number;
}

export async function inspectProviderPage(input: {
  tabId: number;
  providerName: string;
  expectedOrigin: string;
}): Promise<ProviderPageInspection> {
  const response = await chrome.runtime.sendMessage({
    type: INSPECT_PROVIDER_PAGE,
    tabId: input.tabId,
    expectedOrigin: input.expectedOrigin,
  });
  if (!response?.ok) throw new Error(response?.error ?? "Provider page inspection failed.");
  const raw = response.result as RawInspection;
  const login = classifyLoginState({
    providerName: input.providerName,
    pageUrl: raw.url,
    pageTitle: raw.title,
    passwordInputs: raw.passwordInputs,
    loginControls: raw.loginControls,
    composerCandidates: raw.composerCandidates,
  });
  return { ...raw, requiresLogin: login.requiresLogin };
}
