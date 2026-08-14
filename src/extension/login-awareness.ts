export type AutomaticConnectionState = "idle" | "connecting" | "ready" | "failed";

export type ConnectionExperienceState =
  | "preparing"
  | "connecting"
  | "login_required"
  | "recovering"
  | "ready"
  | "needs_attention";

export interface LoginPageProbe {
  url?: string;
  hostname?: string;
  title?: string;
  passwordInputs?: number;
  authActionPresent?: boolean;
  chatComposerPresent?: boolean;
}

export interface ConnectionExperienceInput {
  connectionState: AutomaticConnectionState;
  probe?: LoginPageProbe | null;
  recovering?: boolean;
}

const AUTH_PATH = /(?:^|\/)(?:login|log-in|signin|sign-in|auth|oauth|authorize|account|accounts)(?:\/|$|[?#])/i;
const AUTH_HOST = /^(?:accounts?|account|auth|login|signin|passport|id)\./i;
const AUTH_TITLE = /\b(?:sign[ -]?in|log[ -]?in|login|authenticate|authorization)\b|登录|登入|账号登录|账户登录/i;

export function likelyLoginPage(probe: LoginPageProbe | null | undefined): boolean {
  if (!probe) return false;
  if ((probe.passwordInputs ?? 0) > 0) return true;
  if (probe.authActionPresent && !probe.chatComposerPresent) return true;
  if (probe.title && AUTH_TITLE.test(probe.title)) return true;

  if (!probe.url) return false;
  try {
    const url = new URL(probe.url);
    if (AUTH_HOST.test(url.hostname)) return true;
    return AUTH_PATH.test(`${url.pathname}${url.search}${url.hash}`);
  } catch {
    return AUTH_PATH.test(probe.url);
  }
}

export function deriveConnectionExperience(
  input: ConnectionExperienceInput,
): ConnectionExperienceState {
  if (input.connectionState === "ready") return "ready";
  if (input.connectionState === "connecting") return "connecting";
  if (input.recovering) return "recovering";
  if (input.connectionState === "idle") return "preparing";
  return likelyLoginPage(input.probe) ? "login_required" : "needs_attention";
}
