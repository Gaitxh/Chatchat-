import type { ProviderMemoryCoverageModel } from "../src/theater/provider-memory-coverage.js";
import type { ProviderMemoryGapModel } from "../src/theater/provider-memory-gaps.js";
import type { MeetingMemoryIntegrity } from "../src/theater/meeting-memory-integrity.js";
import {
  deriveProviderMemoryReceipt,
  providerMemoryReceiptMarkdown,
} from "../src/consultation/memory-receipt.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const coverage: ProviderMemoryCoverageModel = {
  sessionId: "memory-receipt-session",
  contextBudget: 12,
  turns: [],
  roundsWithPinnedMemory: 1,
  pinnedIssueSourceEventIds: ["q-old"],
  actualPromptTurnCount: 6,
  selectorMismatchTurnCount: 0,
  allSharedSnapshotsConsistent: true,
  allPromptSelectorConsistent: true,
  rounds: [{
    key: "debate|3",
    phase: "debate",
    round: 3,
    turns: [],
    seatCount: 3,
    attemptedSeatCount: 3,
    receivedSeatCount: 3,
    actualPromptSeatCount: 3,
    selectorMismatchSeatCount: 0,
    snapshotsConsistent: true,
    selectionFingerprints: ["same"],
    snapshotEventIds: ["n1", "n2", "q-old"],
    latestRoundEventIds: ["n1", "n2"],
    pinnedEventIds: ["q-old"],
    pinnedIssueSourceEventIds: ["q-old"],
    ordinaryRecentEventIds: [],
    omittedEventIds: ["old-ordinary"],
    pinnedIssues: [],
    availableCount: 4,
    snapshotCount: 3,
    contextBudget: 12,
  }],
};
const gaps: ProviderMemoryGapModel = {
  sessionId: coverage.sessionId,
  gaps: [],
  rounds: [{
    key: "debate|3",
    phase: "debate",
    round: 3,
    seatCount: 3,
    turnsWithGaps: 0,
    uniqueGapSourceEventIds: [],
    gapCount: 0,
    allSeatsSameGapSet: true,
  }],
  gapTurnCount: 0,
  uniqueGapSourceEventIds: [],
  actualPromptGapCount: 0,
  allGapSetsFairWithinRound: true,
};
const integrity: MeetingMemoryIntegrity = {
  protocolState: "verified",
  evidenceStrength: "actual_prompt",
  contextBudget: 12,
  auditedTurns: 6,
  actualPromptTurns: 6,
  auditedRounds: 2,
  pinnedRounds: 1,
  peerMismatchRounds: 0,
  selectorMismatchTurns: 0,
  gapTurns: 0,
  uniqueGapSourceEventIds: [],
  gapSetMismatchRounds: 0,
};

const receipt = deriveProviderMemoryReceipt(coverage, gaps, integrity);
assert(receipt.contextBudget === 12, "Memory Receipt must preserve the hard public-event budget.");
assert(receipt.protocolState === "verified" && receipt.evidenceStrength === "actual_prompt", "Memory Receipt must preserve protocol state and evidence strength separately.");
assert(receipt.rounds[0]?.pinnedEvents === 1 && receipt.rounds[0]?.omittedEvents === 1, "Memory Receipt must preserve bounded pin/omission accounting.");
assert(receipt.rounds[0]?.actualPromptSeats === 3 && receipt.rounds[0]?.peersSharedSameDeck, "Memory Receipt must preserve actual Prompt proof and peer memory fairness.");

const en = providerMemoryReceiptMarkdown(receipt, "en");
assert(en.includes("Public memory protocol") && en.includes("Actual Prompt turns"), "English Memory Receipt must expose protocol/evidence provenance.");
assert(en.includes("3/3 Prompt proof") && en.includes("📌 1") && en.includes("⌁ 1"), "English Memory Receipt must expose per-round actual Prompt, pin and omission accounting.");
assert(en.includes("not authority, truth or answer correctness"), "Memory Receipt must preserve the non-authority/non-correctness boundary.");
assert(!en.includes("trust score") && !en.includes("accuracy score"), "Memory Receipt must not invent a composite trust/accuracy score.");

const limitedReceipt = deriveProviderMemoryReceipt(
  coverage,
  {
    ...gaps,
    gapTurnCount: 3,
    uniqueGapSourceEventIds: ["q-old", "challenge-old"],
    actualPromptGapCount: 3,
    rounds: [{ ...gaps.rounds[0]!, turnsWithGaps: 3, uniqueGapSourceEventIds: ["q-old", "challenge-old"], gapCount: 6 }],
  },
  {
    ...integrity,
    protocolState: "bounded_coverage",
    gapTurns: 3,
    uniqueGapSourceEventIds: ["q-old", "challenge-old"],
  },
);
const zh = providerMemoryReceiptMarkdown(limitedReceipt, "zh-CN");
assert(zh.includes("有界覆盖限制") && zh.includes("q-old") && zh.includes("challenge-old"), "Chinese Memory Receipt must carry exact hard-cap gap source IDs.");
assert(zh.includes("不代表权威、真理或答案正确"), "Chinese Memory Receipt must preserve the same epistemic boundary.");

const serialized = JSON.stringify(limitedReceipt);
assert(!serialized.includes("RUN_SPEECH") && !serialized.includes("CHATCHAT_SHARED_MEETING_OBJECTIVE"), "Memory Receipt data must not require a durable full Prompt copy.");
assert(!serialized.includes("responseText") && !serialized.includes("chain-of-thought"), "Memory Receipt must remain selection provenance rather than a second hidden transcript.");

console.log("✓ Provider Memory Receipt exports bounded provenance without a composite score or hidden Prompt transcript");
