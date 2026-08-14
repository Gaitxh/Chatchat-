export interface LoginStateInspection {
  expectedOrigin: string;
  currentUrl: string;
  title?: string;
  passwordInputs?: number;
  loginControls?: number;
  composerCandidates?: number;
}

export type LoginState = "needs_login" | "not_login";

const AUTH_HOST_PATTERN = /(^|\.)(accounts\.google\.com|login\.microsoftonline\.com|auth0\.com|okta\.com|openai\.com)$/i;
const AUTH_TEXT_PATTERN = /(?:\blog\s*in\b|\bsign\s*in\b|\bsignin\b|\bauth(?:orize|entication)?\b|\boauth\b|\bsso\b|登录|登入|登陆)/i;

export function classifyLoginState(input: LoginStateInspection): LoginState {
  const expected = safeUrl(input.expectedOrigin);
  const current = safeUrl(input.currentUrl);
  const title = input.title ?? "";

  if (!expected || !current) return "not_login";

  const pathAndTitle = `${current.hostname} ${current.pathname} ${current.search} ${title}`;
  const crossOrigin = current.origin !== expected.origin;
  if (crossOrigin) {
    return AUTH_HOST_PATTERN.test(current.hostname) || AUTH_TEXT_PATTERN.test(pathAndTitle)
      ? "needs_login"
      : "not_login";
  }

  const passwordInputs = input.passwordInputs ?? 0;
  const loginControls = input.loginControls ?? 0;
  const composers = input.composerCandidates ?? 0;

  // A same-origin page that already exposes a usable AI composer should remain
  // usable even if the product also offers an optional account/sign-in control.
  if (composers > 0 && passwordInputs === 0) return "not_login";

  if (passwordInputs > 0) return "needs_login";
  if (AUTH_TEXT_PATTERN.test(pathAndTitle)) return "needs_login";
  if (loginControls > 0 && composers === 0) return "needs_login";

  return "not_login";
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
