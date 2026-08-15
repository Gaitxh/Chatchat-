const SESSION = /(?:^|\n)SESSION_ID:\s*([^\n]+)/;
const PHASE = /(?:^|\n)PHASE:\s*([^\n]+)/;
const ROUND = /(?:^|\n)ROUND:\s*(\d+)/;
const ACTOR = /(?:^|\n)YOUR_ACTOR_ID:\s*([^\n]+)/;
const SNAPSHOT = /(?:^|\n)PUBLIC_SNAPSHOT_EVENT_IDS_JSON:\s*([^\n]+)/;
const REPAIR = /(?:^|\n)REPAIR ATTEMPT:\s*/i;

export interface FinalPromptReceipt {
  schemaVersion: 1;
  sessionId: string;
  actorId: string;
  round: number;
  /** Exact initial Final prompt sent through RUN_SPEECH. Local-only protocol input, never Provider output. */
  promptText: string;
  promptChars: number;
  promptFingerprint: string;
  snapshotEventIds: string[];
  observedAt: string;
}

export interface FinalPromptReceiptValidation {
  valid: boolean;
  issues: string[];
  parsedSessionId?: string;
  parsedActorId?: string;
  parsedRound?: number;
  parsedSnapshotEventIds: string[];
  currentFingerprint: string;
}

/**
 * Freeze the actual initial Final prompt string. This intentionally stores the
 * protocol input itself instead of attempting a future approximate rebuild from
 * partial context fields. It contains user proposal/public meeting/tool inputs
 * already sent by ChatChat, but no Provider response or hidden reasoning.
 */
export function createFinalPromptReceipt(
  promptText: string,
  observedAt = new Date().toISOString(),
): FinalPromptReceipt {
  const parsed = parsePromptIdentity(promptText);
  if (parsed.phase !== "final") throw new Error("Final Prompt Receipt only accepts PHASE: final prompts.");
  if (REPAIR.test(promptText)) throw new Error("Final Prompt Receipt must freeze the initial Final prompt, not a repair attempt.");
  if (!parsed.sessionId || !parsed.actorId || !parsed.round) throw new Error("Final prompt is missing required ChatChat execution identity fields.");
  if (!parsed.hasSnapshotLine) throw new Error("Final prompt is missing PUBLIC_SNAPSHOT_EVENT_IDS_JSON.");
  return {
    schemaVersion: 1,
    sessionId: parsed.sessionId,
    actorId: parsed.actorId,
    round: parsed.round,
    promptText,
    promptChars: promptText.length,
    promptFingerprint: promptFingerprint(promptText),
    snapshotEventIds: parsed.snapshotEventIds,
    observedAt,
  };
}

/** Detect local corruption/drift before any recovery operation is considered. */
export function validateFinalPromptReceipt(receipt: FinalPromptReceipt): FinalPromptReceiptValidation {
  const parsed = parsePromptIdentity(receipt.promptText);
  const issues: string[] = [];
  const currentFingerprint = promptFingerprint(receipt.promptText);
  if (receipt.schemaVersion !== 1) issues.push("unsupported_schema_version");
  if (parsed.phase !== "final") issues.push("not_final_phase");
  if (REPAIR.test(receipt.promptText)) issues.push("repair_prompt_not_original_final");
  if (parsed.sessionId !== receipt.sessionId) issues.push("session_id_mismatch");
  if (parsed.actorId !== receipt.actorId) issues.push("actor_id_mismatch");
  if (parsed.round !== receipt.round) issues.push("round_mismatch");
  if (!parsed.hasSnapshotLine) issues.push("snapshot_line_missing");
  if (!sameStrings(parsed.snapshotEventIds, receipt.snapshotEventIds)) issues.push("snapshot_ids_mismatch");
  if (receipt.promptChars !== receipt.promptText.length) issues.push("prompt_length_mismatch");
  if (currentFingerprint !== receipt.promptFingerprint) issues.push("prompt_fingerprint_mismatch");
  return {
    valid: issues.length === 0,
    issues,
    ...(parsed.sessionId ? { parsedSessionId: parsed.sessionId } : {}),
    ...(parsed.actorId ? { parsedActorId: parsed.actorId } : {}),
    ...(parsed.round ? { parsedRound: parsed.round } : {}),
    parsedSnapshotEventIds: parsed.snapshotEventIds,
    currentFingerprint,
  };
}

export function parseFinalPromptSnapshotEventIds(promptText: string): string[] {
  return parsePromptIdentity(promptText).snapshotEventIds;
}

/**
 * Stable corruption/drift fingerprint, not a security signature. FNV-1a 64-bit
 * is synchronous and identical in browser/Node without external dependencies.
 */
export function promptFingerprint(value: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

function parsePromptIdentity(promptText: string): {
  sessionId?: string;
  phase?: string;
  round?: number;
  actorId?: string;
  snapshotEventIds: string[];
  hasSnapshotLine: boolean;
} {
  const sessionId = promptText.match(SESSION)?.[1]?.trim();
  const phase = promptText.match(PHASE)?.[1]?.trim().toLowerCase();
  const roundText = promptText.match(ROUND)?.[1];
  const actorId = promptText.match(ACTOR)?.[1]?.trim();
  const snapshotText = promptText.match(SNAPSHOT)?.[1];
  const snapshotEventIds = parseSnapshotIds(snapshotText);
  return {
    ...(sessionId ? { sessionId } : {}),
    ...(phase ? { phase } : {}),
    ...(roundText ? { round: Number(roundText) } : {}),
    ...(actorId ? { actorId } : {}),
    snapshotEventIds,
    hasSnapshotLine: snapshotText !== undefined,
  };
}

function parseSnapshotIds(value: string | undefined): string[] {
  if (value === undefined) return [];
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error("PUBLIC_SNAPSHOT_EVENT_IDS_JSON is not valid JSON."); }
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
    throw new Error("PUBLIC_SNAPSHOT_EVENT_IDS_JSON must be an array of event IDs.");
  }
  return [...parsed];
}

function sameStrings(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}
