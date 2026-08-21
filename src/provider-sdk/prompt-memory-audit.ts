import type { CouncilPhase } from "../core/types.js";

export interface ProviderPromptMemorySelection {
  sessionId: string;
  actorId: string;
  phase: CouncilPhase | "consultation";
  round: number;
  repairAttempt: boolean;
  snapshotEventIds: string[];
  pinnedOpenIssueEventIds: string[];
  pinnedIssueSourceEventIds: string[];
  latestRoundEventIds: string[];
  /**
   * Equality fingerprint of the exact serialized CONSULTATION_EVENTS_JSON text
   * that appeared in this RUN_SPEECH Prompt. This is deliberately
   * non-cryptographic and must never be presented as a signature,
   * authenticity proof, or correctness signal.
   */
  publicPayloadFingerprint: string | null;
  publicPayloadEventCount: number | null;
  observedAt: string;
}

const MAX_SELECTIONS = 320;
const selections = new Map<string, ProviderPromptMemorySelection>();

/**
 * Parse only explicit ChatChat protocol metadata from the exact RUN_SPEECH
 * string. This does not inspect Provider reasoning or infer memory from prose.
 */
export function parseProviderPromptMemorySelection(prompt: string): ProviderPromptMemorySelection | null {
  const phaseText = prompt.match(/PHASE:\s*(sealed|debate|final)/i)?.[1]?.toLowerCase() ?? "consultation";
  const phase = isPhase(phaseText) ? phaseText : "consultation";
  const round = Number(prompt.match(/ROUND:\s*(\d+)/i)?.[1] ?? "0");
  const sessionId = prompt.match(/SESSION_ID:\s*([^\n]+)/)?.[1]?.trim() ?? "";
  const actorId = prompt.match(/YOUR_ACTOR_ID:\s*([^\n]+)/)?.[1]?.trim() ?? "";
  if (!sessionId || !actorId || !Number.isFinite(round)) return null;

  const publicPayloadRaw = parseJsonRawLine(prompt, "CONSULTATION_EVENTS_JSON");
  const publicPayload = parseRawJson(publicPayloadRaw);
  return {
    sessionId,
    actorId,
    phase,
    round,
    repairAttempt: /\nREPAIR ATTEMPT:\s*/i.test(prompt),
    snapshotEventIds: parseJsonLine(prompt, "PUBLIC_SNAPSHOT_EVENT_IDS_JSON"),
    pinnedOpenIssueEventIds: parseJsonLine(prompt, "PINNED_OPEN_ISSUE_EVENT_IDS_JSON"),
    // In the mode-aware prompt this line lives in CHATCHAT_PINNED_OPEN_ISSUES
    // only when a source actually had to be restored. Absence therefore means
    // an observed modern zero-pin Prompt, not a guessed legacy value.
    pinnedIssueSourceEventIds: parseJsonLine(prompt, "PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON"),
    latestRoundEventIds: parseJsonLine(prompt, "LATEST_ROUND_EVENT_IDS_JSON"),
    // Fingerprint the exact JSON text after the protocol label, not a parsed
    // then re-stringified value. That way a wrapper/compaction/serialization
    // change cannot be normalized away before equality is audited.
    publicPayloadFingerprint: Array.isArray(publicPayload) && publicPayloadRaw !== null
      ? equalityFingerprint(publicPayloadRaw)
      : null,
    publicPayloadEventCount: Array.isArray(publicPayload) ? publicPayload.length : null,
    observedAt: new Date().toISOString(),
  };
}

export function rememberProviderPromptMemorySelection(prompt: string): ProviderPromptMemorySelection | null {
  const selection = parseProviderPromptMemorySelection(prompt);
  if (!selection) return null;
  selections.set(selectionKey(selection), cloneProviderPromptMemorySelection(selection));
  trimSelections();
  return selection;
}

export function providerPromptMemorySelectionFor(
  value: Pick<ProviderPromptMemorySelection, "sessionId" | "actorId" | "phase" | "round" | "repairAttempt">,
): ProviderPromptMemorySelection | null {
  const found = selections.get(selectionKey(value));
  return found ? cloneProviderPromptMemorySelection(found) : null;
}

export function cloneProviderPromptMemorySelection(selection: ProviderPromptMemorySelection): ProviderPromptMemorySelection {
  return {
    ...selection,
    snapshotEventIds: [...selection.snapshotEventIds],
    pinnedOpenIssueEventIds: [...selection.pinnedOpenIssueEventIds],
    pinnedIssueSourceEventIds: [...selection.pinnedIssueSourceEventIds],
    latestRoundEventIds: [...selection.latestRoundEventIds],
  };
}

function parseJsonLine(prompt: string, label: string): string[] {
  const parsed = parseRawJson(parseJsonRawLine(prompt, label));
  return Array.isArray(parsed)
    ? [...new Set(parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim())))]
    : [];
}

/**
 * Return only the JSON text on the same protocol line. `[ \t]*` is deliberate:
 * `\s*` could cross a newline and accidentally consume the next field when a
 * malformed label has no value.
 */
function parseJsonRawLine(prompt: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const raw = prompt.match(new RegExp(`${escaped}:[ \\t]*([^\\r\\n]+)`))?.[1];
  return raw ?? null;
}

function parseRawJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * 64-bit FNV-1a over UTF-8 bytes. Equality aid only — still deliberately not
 * a cryptographic signature, MAC, authenticity proof, or tamper-proof receipt.
 */
function equalityFingerprint(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `eq64:${hash.toString(16).padStart(16, "0")}`;
}

function selectionKey(
  value: Pick<ProviderPromptMemorySelection, "sessionId" | "actorId" | "phase" | "round" | "repairAttempt">,
): string {
  return `${value.sessionId}|${value.actorId}|${value.phase}|${value.round}|${value.repairAttempt ? "repair" : "first"}`;
}

function trimSelections(): void {
  while (selections.size > MAX_SELECTIONS) {
    const first = selections.keys().next().value as string | undefined;
    if (!first) return;
    selections.delete(first);
  }
}

function isPhase(value: string): value is CouncilPhase {
  return value === "sealed" || value === "debate" || value === "final";
}
