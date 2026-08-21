import type { CouncilPhase } from "../core/types.js";
import { fingerprintProtocolJsonText } from "./protocol-fingerprint.js";

export interface ProviderPromptMemorySelection {
  sessionId: string;
  actorId: string;
  phase: CouncilPhase | "consultation";
  round: number;
  repairAttempt: boolean;
  /** Metadata declared by PUBLIC_SNAPSHOT_EVENT_IDS_JSON. */
  declaredSnapshotEventIds: string[];
  /** Event ids parsed from the actual CONSULTATION_EVENTS_JSON payload. */
  actualPublicEventIds: string[];
  snapshotMetadataMatchesPayload: boolean;
  pinnedOpenIssueEventIds: string[];
  pinnedIssueSourceEventIds: string[];
  latestRoundEventIds: string[];
  latestRoundSelectedActorIds: string[];
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
 *
 * Crucially, PUBLIC_SNAPSHOT_EVENT_IDS_JSON is not allowed to certify itself.
 * We independently parse ids from CONSULTATION_EVENTS_JSON and retain both lines
 * of evidence. The actual public payload is the final truth for what a Provider
 * could see; metadata parity is audited separately.
 */
export function parseProviderPromptMemorySelection(prompt: string): ProviderPromptMemorySelection | null {
  const phaseText = prompt.match(/PHASE:\s*(sealed|debate|final)/i)?.[1]?.toLowerCase() ?? "consultation";
  const phase = isPhase(phaseText) ? phaseText : "consultation";
  const round = Number(prompt.match(/ROUND:\s*(\d+)/i)?.[1] ?? "0");
  const sessionId = prompt.match(/SESSION_ID:\s*([^\n]+)/)?.[1]?.trim() ?? "";
  const actorId = prompt.match(/YOUR_ACTOR_ID:\s*([^\n]+)/)?.[1]?.trim() ?? "";
  if (!sessionId || !actorId || !Number.isFinite(round)) return null;

  const declaredSnapshotEventIds = parseJsonLine(prompt, "PUBLIC_SNAPSHOT_EVENT_IDS_JSON");
  const publicContextRaw = parseRawLine(prompt, "CONSULTATION_EVENTS_JSON");
  const publicContextFingerprint = publicContextRaw
    ? fingerprintProtocolJsonText(publicContextRaw)?.value
    : undefined;
  const publicEvents = parseJsonArrayOfRecords(publicContextRaw);
  const actualPublicEventIds = unique(publicEvents.flatMap((event) =>
    typeof event.id === "string" && event.id.trim() ? [event.id] : [],
  ));
  const latestRoundEventIds = parseJsonLine(prompt, "LATEST_ROUND_EVENT_IDS_JSON");
  const latestSet = new Set(latestRoundEventIds);
  const latestRoundSelectedActorIds = unique(publicEvents.flatMap((event) =>
    typeof event.id === "string" && latestSet.has(event.id) && typeof event.actorId === "string"
      ? [event.actorId]
      : [],
  ));

  return {
    sessionId,
    actorId,
    phase,
    round,
    repairAttempt: /\nREPAIR ATTEMPT:\s*/i.test(prompt),
    declaredSnapshotEventIds,
    actualPublicEventIds,
    snapshotMetadataMatchesPayload: sameOrderedIds(declaredSnapshotEventIds, actualPublicEventIds),
    pinnedOpenIssueEventIds: parseJsonLine(prompt, "PINNED_OPEN_ISSUE_EVENT_IDS_JSON"),
    pinnedIssueSourceEventIds: parseJsonLine(prompt, "PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON"),
    latestRoundEventIds,
    latestRoundSelectedActorIds,
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
    declaredSnapshotEventIds: [...selection.declaredSnapshotEventIds],
    actualPublicEventIds: [...selection.actualPublicEventIds],
    pinnedOpenIssueEventIds: [...selection.pinnedOpenIssueEventIds],
    pinnedIssueSourceEventIds: [...selection.pinnedIssueSourceEventIds],
    latestRoundEventIds: [...selection.latestRoundEventIds],
    latestRoundSelectedActorIds: [...selection.latestRoundSelectedActorIds],
  };
}

function parseJsonLine(prompt: string, label: string): string[] {
  const raw = parseRawLine(prompt, label);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? unique(parsed.filter((item): item is string => typeof item === "string" && Boolean(item.trim())))
      : [];
  } catch {
    return [];
  }
}

function parseJsonArrayOfRecords(raw: string | null): Array<Record<string, unknown>> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
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

function sameOrderedIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
