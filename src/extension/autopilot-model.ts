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

function errorText(value: unknown): string {
  return value instanceof Error ? value.message : String(value ?? "");
}
