import type { CouncilPhase } from "../core/types.js";
import { fingerprintProtocolJsonText } from "./protocol-fingerprint.js";

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
  latestRoundActorIds: string[];
  latestRoundSelectedActorIds: string[];
  latestRoundOmittedActorIds: string[];
  /** Fingerprint of the exact normalized CONSULTATION_EVENTS_JSON payload. */
  publicContextFingerprint?: string;
  observedAt: string;
}

const MAX_SELECTIONS = 320;
const selections = new Map<string, ProviderPromptMemorySelection>();

/**
 * Parse only explicit ChatChat protocol metadata from the exact RUN_SPEECH
 * string. This does not inspect Provider reasoning or infer memory from prose.
 * The public payload fingerprint stores only hash algorithm/hash/character-count,
 * never a second copy of the Prompt or Blackboard prose.
 */
export function parseProviderPromptMemorySelection(prompt: string): ProviderPromptMemorySelection | null {
  const phaseText = prompt.match(/PHASE:\s*(sealed|debate|final)/i)?.[1]?.toLowerCase() ?? "consultation";
  const phase = isPhase(phaseText) ? phaseText : "consultation";
  const round = Number(prompt.match(/ROUND:\s*(\d+)/i)?.[1] ?? "0");
  const sessionId = prompt.match(/SESSION_ID:\s*([^\n]+)/)?.[1]?.trim() ?? "";
  const actorId = prompt.match(/YOUR_ACTOR_ID:\s*([^\n]+)/)?.[1]?.trim() ?? "";
  if (!sessionId || !actorId || !Number.isFinite(round)) return null;
  const publicContextRaw = parseRawLine(prompt, "CONSULTATION_EVENTS_JSON");
  const publicContextFingerprint = publicContextRaw
    ? fingerprintProtocolJsonText(publicContextRaw)?.value
    : undefined;
  return {
    sessionId,
    actorId,
    phase,
    round,
    repairAttempt: /\nREPAIR ATTEMPT:\s*/i.test(prompt),
    snapshotEventIds: parseJsonLine(prompt, "PUBLIC_SNAPSHOT_EVENT_IDS_JSON"),
    pinnedOpenIssueEventIds: parseJsonLine(prompt, "PINNED_OPEN_ISSUE_EVENT_IDS_JSON"),
    pinnedIssueSourceEventIds: parseJsonLine(prompt, "PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON"),
    latestRoundEventIds: parseJsonLine(prompt, "LATEST_ROUND_EVENT_IDS_JSON"),
    latestRoundActorIds: parseJsonLine(prompt, "LATEST_ROUND_ACTOR_IDS_JSON"),
    latestRoundSelectedActorIds: parseJsonLine(prompt, "LATEST_ROUND_SELECTED_ACTOR_IDS_JSON"),
    latestRoundOmittedActorIds: parseJsonLine(prompt, "LATEST_ROUND_OMITTED_ACTOR_IDS_JSON"),
    ...(publicContextFingerprint ? { publicContextFingerprint } : {}),
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
    latestRoundActorIds: [...selection.latestRoundActorIds],
    latestRoundSelectedActorIds: [...selection.latestRoundSelectedActorIds],
    latestRoundOmittedActorIds: [...selection.latestRoundOmittedActorIds],
  };
}

function parseJsonLine(prompt: string, label: string): string[] {
  const raw = parseRawLine(prompt, label);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? [...new Set(parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim())))]
      : [];
  } catch {
    return [];
  }
}

function parseRawLine(prompt: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return prompt.match(new RegExp(`${escaped}:\\s*([^\\n]+)`))?.[1]?.trim() ?? null;
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
