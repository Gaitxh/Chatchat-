import {
  createFinalPromptReceipt,
  parseFinalPromptSnapshotEventIds,
  validateFinalPromptReceipt,
} from "../src/consultation/final-prompt-receipt.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const prompt = [
  "CHATCHAT_SHARED_MEETING_OBJECTIVE",
  "CONSULTATION_MODE: balanced",
  "RESEARCH_LANE: primary_sources",
  "END_CHATCHAT_SHARED_MEETING_OBJECTIVE",
  "",
  "SESSION_ID: exact-final-session",
  "PHASE: final",
  "ROUND: 4",
  "YOUR_ACTOR_ID: gemini",
  'PUBLIC_SNAPSHOT_EVENT_IDS_JSON: ["e1","e2","e3"]',
  'USER_PROPOSAL_JSON: "Which option?"',
  'CONSULTATION_EVENTS_JSON: [{"id":"e1"}]',
  'TOOL_FACTS_JSON: [{"id":"tool-1","sourceState":"reachable"}]',
  "<CHATCHAT_COUNCIL_JSON>",
  '{"contributions":[ ... ]}',
  "</CHATCHAT_COUNCIL_JSON>",
].join("\n");

const receipt = createFinalPromptReceipt(prompt, "2026-08-15T10:00:00.000Z");
assert(receipt.sessionId === "exact-final-session" && receipt.actorId === "gemini" && receipt.round === 4, "Receipt must bind exact Final execution identity");
assert(receipt.promptText === prompt && receipt.promptChars === prompt.length, "Receipt must freeze the exact initial Final prompt text, not reconstruct it later");
assert(receipt.snapshotEventIds.join(",") === "e1,e2,e3", "Receipt must preserve exact ordered public snapshot IDs embedded in the prompt");
assert(receipt.promptFingerprint.length === 16, "Receipt should carry a stable local corruption/drift fingerprint");
assert(validateFinalPromptReceipt(receipt).valid, "Fresh Final prompt receipt should self-validate");
assert(parseFinalPromptSnapshotEventIds(prompt).join(",") === "e1,e2,e3", "Snapshot parser should read the actual prompt line");

const tampered = { ...receipt, promptText: receipt.promptText.replace("tool-1", "tool-CHANGED") };
const tamperedValidation = validateFinalPromptReceipt(tampered);
assert(!tamperedValidation.valid && tamperedValidation.issues.includes("prompt_length_mismatch") === false, "Same-length prompt tamper should still fail validation without relying on length");
assert(tamperedValidation.issues.includes("prompt_fingerprint_mismatch"), "Prompt fingerprint must detect local prompt-text drift/tampering");

const wrongSnapshot = { ...receipt, snapshotEventIds: ["e1", "e3"] };
assert(validateFinalPromptReceipt(wrongSnapshot).issues.includes("snapshot_ids_mismatch"), "Stored snapshot metadata must remain consistent with the exact prompt text");

let rejectedRepair = false;
try {
  createFinalPromptReceipt(`${prompt}\nREPAIR ATTEMPT:\nfix JSON`);
} catch { rejectedRepair = true; }
assert(rejectedRepair, "Recovery source must freeze the initial Final prompt, never a repair prompt");

let rejectedDebate = false;
try {
  createFinalPromptReceipt(prompt.replace("PHASE: final", "PHASE: debate"));
} catch { rejectedDebate = true; }
assert(rejectedDebate, "Final Prompt Receipt must reject non-final consultation prompts");

console.log("✓ ChatChat exact Final Prompt Receipt tests passed");
console.log("✓ Recovery source freezes actual protocol input and detects tampering without storing Provider output");
