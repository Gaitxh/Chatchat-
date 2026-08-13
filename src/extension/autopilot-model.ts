export const AUTO_PILOT_READY_TOKEN = "CHATCHAT_READY";

export type AutoPilotFailureKind =
  | "permission"
  | "page_not_ready"
  | "site_changed"
  | "protocol_failed"
  | "timeout"
  | "unknown";

export interface AutoPilotDiagnosis {
  kind: AutoPilotFailureKind;
  retryAutomatically: boolean;
}

/**
 * AUTO_SETUP watches the rendered page for CHATCHAT_READY. The complete
 * token is deliberately absent from the user's own message so the DOM
 * detector cannot confuse the newly-rendered prompt with the AI reply.
 */
export function buildAutoPilotConnectionPrompt(): string {
  return [
    "ChatChat automatic connection check.",
    "Reply with exactly one token and nothing else.",
    "Build that token by joining CHATCHAT, one underscore character, and READY.",
    "Do not add spaces, punctuation, markdown, or explanation.",
  ].join(" ");
}

export function diagnoseAutoPilotFailure(error: unknown): AutoPilotDiagnosis {
  const text = errorText(error).toLocaleLowerCase();

  if (/permission|not allowed|denied|host access/.test(text)) {
    return { kind: "permission", retryAutomatically: false };
  }
  if (/protocol|structured|parser|stance ready|did not declare|chatchat_council_json/.test(text)) {
    return { kind: "protocol_failed", retryAutomatically: false };
  }
  if (/timed out|timeout|did not return|waiting for/.test(text)) {
    return { kind: "timeout", retryAutomatically: true };
  }
  if (/message box|composer|send button|reply area|response area|selector|editable/.test(text)) {
    return { kind: "site_changed", retryAutomatically: false };
  }
  if (/loading|not ready|document/.test(text)) {
    return { kind: "page_not_ready", retryAutomatically: true };
  }
  return { kind: "unknown", retryAutomatically: false };
}

export function autoPilotFailureMessage(kind: AutoPilotFailureKind, locale: "en" | "zh-CN"): string {
  const zh = locale === "zh-CN";
  if (kind === "permission") {
    return zh
      ? "ChatChat 还没有这个 AI 网站的访问权限。重新连接并允许网站访问即可。"
      : "ChatChat does not have access to this AI site yet. Reconnect it and allow site access.";
  }
  if (kind === "page_not_ready") {
    return zh
      ? "这个 AI 页面还没准备好。保持页面打开，等它加载完成后再试一次。"
      : "This AI page is not ready yet. Keep it open, let it finish loading, then retry.";
  }
  if (kind === "timeout") {
    return zh
      ? "这个 AI 页面响应得比较慢。保持页面打开后点一次“重新自动连接”。"
      : "This AI page is responding slowly. Keep it open and retry the automatic connection.";
  }
  if (kind === "site_changed") {
    return zh
      ? "ChatChat 没能自动认出这个页面。先确认这个 AI 已经可以正常聊天；仍失败时再打开“高级修复”。"
      : "ChatChat could not recognize this page automatically. Make sure the AI can chat normally; use Advanced repair only if retry still fails.";
  }
  if (kind === "protocol_failed") {
    return zh
      ? "页面已经连通，但这次 AI 没按协商协议完成握手。重试通常即可；失败时它会保持未就绪，不会伪造通过。"
      : "The page is connected, but the AI did not complete the consultation handshake this time. Retry; ChatChat will keep it unready rather than fake a pass.";
  }
  return zh
    ? "自动连接没有完成。打开这个 AI 标签页确认它已经可以正常聊天，然后再试一次；你不需要理解页面选择器。"
    : "Automatic connection did not finish. Open the AI tab, confirm it can chat normally, and retry; you do not need to understand page selectors.";
}

function errorText(value: unknown): string {
  return value instanceof Error ? value.message : String(value ?? "");
}
