import type { CouncilParticipant } from "../src/core/types.js";
import {
  committeePromptDescriptor,
  committeePromptLines,
  insertCommitteePromptBlock,
} from "../src/house/committee-prompt.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const free: CouncilParticipant = {
  id: "gpt-01",
  name: "GPT-01",
  provider: "openai-chatgpt",
  delegationId: "openai-chatgpt",
};
assert(committeePromptDescriptor(free) === null, "Free Parliament seats should not synthesize a committee assignment.");
assert(committeePromptLines(free)[0] === "COMMITTEE_MODE: free-parliament", "Free Parliament should remain explicit without inventing a task.");

const committeeSeat: CouncilParticipant = {
  ...free,
  committeeId: "evidence",
  committeeName: "Evidence Committee",
  committeeTask: "Identify factual claims, assumptions, unsupported assertions, and missing evidence without favoring a predetermined conclusion.",
};
const descriptor = committeePromptDescriptor(committeeSeat);
assert(descriptor?.id === "evidence", "Committee descriptor should preserve the public committee id.");
assert(descriptor?.rules.some((rule) => rule.includes("never as a desired conclusion")), "Committee prompt contract must reject stance assignment.");
assert(descriptor?.rules.some((rule) => rule.includes("Provider delegation")), "Committee seats may disagree with their own source delegation.");

const kingQuestion = "Should we choose Tauri or Electron?";
const basePrompt = [
  "You are one ChatChat advisor.",
  "PHASE: sealed",
  `KING_QUESTION_JSON: ${JSON.stringify(kingQuestion)}`,
  "COUNCIL_EVENTS_JSON: []",
  "YOUR_PRIOR_EVENTS_JSON: []",
].join("\n");
const enriched = insertCommitteePromptBlock(basePrompt, committeeSeat);
assert(enriched.includes(`KING_QUESTION_JSON: ${JSON.stringify(kingQuestion)}`), "Committee insertion must preserve the King's question byte-for-byte.");
assert(enriched.includes("COMMITTEE_MODE: committee-parliament"), "Committee mode should be explicit.");
assert(enriched.includes("COMMITTEE_TASK_JSON:"), "Committee task must live in its own JSON field.");
assert(enriched.indexOf("COMMITTEE_TASK_JSON:") > enriched.indexOf("KING_QUESTION_JSON:"), "Committee task belongs beside, not inside, the King's question.");
assert(enriched.indexOf("COMMITTEE_TASK_JSON:") < enriched.indexOf("COUNCIL_EVENTS_JSON:"), "Committee system metadata should precede peer discussion data.");

const freePrompt = insertCommitteePromptBlock(basePrompt, free);
assert(freePrompt.includes("COMMITTEE_MODE: free-parliament"), "Free Parliament should use the same explicit insertion point.");
assert(!freePrompt.includes("COMMITTEE_TASK_JSON:"), "Free Parliament must not invent a committee task.");

let missingMarkerRejected = false;
try { insertCommitteePromptBlock("no king marker", committeeSeat); } catch { missingMarkerRejected = true; }
assert(missingMarkerRejected, "Prompt integration should fail closed if the King's question marker disappears.");

let duplicateMarkerRejected = false;
try { insertCommitteePromptBlock("KING_QUESTION_JSON: one\nKING_QUESTION_JSON: two", committeeSeat); } catch { duplicateMarkerRejected = true; }
assert(duplicateMarkerRejected, "Prompt integration should fail closed on ambiguous insertion points.");

console.log("✓ ChatChat House committee prompt-contract tests passed");
