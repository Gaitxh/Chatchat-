import type { CouncilEvent, CouncilParticipant, CouncilReport } from "../src/core/types.js";
import {
  deriveFinalRecoveryPackets,
  finalRecoveryPacketText,
} from "../src/consultation/final-recovery-plan.js";
import type { FinalCoveragePlan } from "../src/theater/final-coverage-gaps.js";
import type { ProviderAttendanceAuditModel } from "../src/theater/provider-attendance.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "gemini", name: "Gemini", provider: "google" },
  { id: "claude", name: "Claude", provider: "anthropic" },
  { id: "deepseek", name: "DeepSeek", provider: "deepseek" },
];
const base = { sessionId: "recovery-session", createdAt: "2026-08-15T09:00:00.000Z" };
const events: CouncilEvent[] = [
  { ...base, id: "e1", round: 1, actorId: "gemini", kind: "argument", stance: "A", content: "Gemini initial.", confidence: .7 },
  { ...base, id: "e2", round: 1, actorId: "claude", kind: "argument", stance: "B", content: "Claude initial.", confidence: .7 },
  { ...base, id: "e3", round: 2, actorId: "claude", kind: "challenge", targetEventId: "e1", content: "Challenge." },
  { ...base, id: "e4", round: 3, actorId: "gemini", kind: "evidence", targetEventId: "e2", claim: "Evidence", content: "Evidence body", confidence: .8 },
  { ...base, id: "f-claude", round: 4, actorId: "claude", kind: "final_position", stance: "B", content: "Claude final.", confidence: .8 },
];
const report: CouncilReport = {
  sessionId: base.sessionId,
  question: "Recover missing Finals?",
  mode: "balanced",
  stopReason: "round_budget",
  consensusStance: "B",
  consensusRatio: 2 / 3,
  confidence: .78,
  rounds: 4,
  positions: participants.map((participant) => ({ participant, stance: "B", content: `${participant.name} report position`, confidence: .7, caveats: [] })),
  disagreements: [],
  eventCount: events.length,
};
const coverage: FinalCoveragePlan = {
  sessionId: report.sessionId,
  executionGapCount: 2,
  provenanceGapCount: 1,
  affectedActorIds: ["gemini", "claude", "deepseek"],
  complete: false,
  recoveryChecklist: [],
  gaps: [
    {
      id: "g-gemini",
      sessionId: report.sessionId,
      actorId: "gemini",
      participantName: "Gemini",
      providerId: "google",
      kind: "fallback_final",
      class: "execution",
      priority: "high",
      finalStance: "B",
      finalConfidence: 0,
      executionState: "fallback",
      recordSource: "fallback_placeholder",
      recommendedOperation: "retry_final_against_frozen_snapshot",
    },
    {
      id: "g-claude",
      sessionId: report.sessionId,
      actorId: "claude",
      participantName: "Claude",
      providerId: "anthropic",
      kind: "unexplained_final_shift",
      class: "provenance",
      priority: "review",
      finalStance: "B",
      finalConfidence: .8,
      finalEventId: "f-claude",
      latestPreFinalStance: "A",
      latestPreFinalEventId: "e2",
      executionState: "verified",
      recordSource: "provider_final",
      recommendedOperation: "request_final_shift_explanation",
    },
    {
      id: "g-deepseek",
      sessionId: report.sessionId,
      actorId: "deepseek",
      participantName: "DeepSeek",
      providerId: "deepseek",
      kind: "failed_final",
      class: "execution",
      priority: "high",
      finalStance: "B",
      finalConfidence: 0,
      executionState: "failed",
      recordSource: "unverified_record",
      recommendedOperation: "retry_final_against_frozen_snapshot",
    },
  ],
};

const attendance: ProviderAttendanceAuditModel = {
  sessionId: report.sessionId,
  totalTurns: 3,
  verifiedTurns: 1,
  repairedTurns: 0,
  fallbackTurns: 1,
  failedTurns: 1,
  seats: [
    auditSeat("gemini", "Gemini", "google", "fallback", ["e1", "e2", "e3", "e4"]),
    auditSeat("claude", "Claude", "anthropic", "published", ["e1", "e2", "e3", "e4"]),
    auditSeat("deepseek", "DeepSeek", "deepseek", "failed", []),
  ],
};

const packets = deriveFinalRecoveryPackets(report, events, coverage, attendance);
assert(packets.readyRetryCount === 1, "Only Gemini should be ready for an exact targeted retry");
assert(packets.clarificationCount === 1, "Claude should produce a clarification-only packet");
assert(packets.blockedCount === 1, "DeepSeek must be blocked because no frozen Final snapshot was captured");

const gemini = packets.packets.find((packet) => packet.actorId === "gemini");
assert(gemini?.state === "ready", "Gemini fallback should be recoverable when the exact frozen snapshot exists");
assert(gemini.snapshotEventIds.join(",") === "e1,e2,e3,e4", "Recovery packet must preserve the exact prompt snapshot ID order");
assert(gemini.snapshotEvents.map((event) => event.id).join(",") === "e1,e2,e3,e4", "Recovery packet must reconstruct the exact frozen events, not an approximate all-non-final slice");
const geminiText = finalRecoveryPacketText(gemini);
assert(geminiText.includes("this seat only") && geminiText.includes("Successful seats receive no extra speaking turn"), "Ready retry packet must preserve equal-turn recovery scope");
assert(geminiText.includes("never overwrite the original Final"), "Ready retry must append provenance instead of mutating history");

const claude = packets.packets.find((packet) => packet.actorId === "claude");
assert(claude?.state === "clarification_only" && claude.snapshotEventIds.length === 0, "Unexplained successful Final shift is a clarification packet, not a Final execution retry");
assert(finalRecoveryPacketText(claude).includes("Do not retroactively insert a revision event"), "Clarification packet must not rewrite the original event graph");

const deepseek = packets.packets.find((packet) => packet.actorId === "deepseek");
assert(deepseek?.state === "blocked_no_snapshot", "Final recovery without captured snapshot must be blocked instead of approximated");
assert(finalRecoveryPacketText(deepseek).includes("Do not run an approximate retry"), "Blocked packet must explicitly reject approximate retry equivalence");

// Even one missing event makes an otherwise retryable snapshot invalid.
const missing = deriveFinalRecoveryPackets(report, events.filter((event) => event.id !== "e3"), coverage, attendance);
const missingGemini = missing.packets.find((packet) => packet.actorId === "gemini");
assert(missingGemini?.state === "blocked_missing_snapshot_events", "Missing one frozen event must block exact Final recovery");
assert(missingGemini.missingSnapshotEventIds.includes("e3"), "Blocked packet must expose exactly which frozen event is missing");

console.log("✓ ChatChat Final Recovery Packet tests passed");
console.log("✓ Targeted retry uses captured Final prompt snapshot IDs, never an approximate reconstruction");
console.log("✓ Provenance clarification and execution retry remain separate recovery operations");

function auditSeat(
  actorId: string,
  participantName: string,
  providerId: string,
  finalState: "published" | "fallback" | "failed",
  snapshotEventIds: string[],
) {
  return {
    actorId,
    participantName,
    providerId,
    turns: [{
      key: `${report.sessionId}|${actorId}|final|4`,
      sessionId: report.sessionId,
      actorId,
      participantName,
      providerId,
      phase: "final" as const,
      round: 4,
      state: finalState,
      snapshotEventIds,
      publishedEventIds: finalState === "published" ? [`published-${actorId}`] : [],
      contributionKinds: finalState === "published" ? ["final_position" as const] : ["uncertain" as const],
      repairRequested: false,
      repairSucceeded: false,
      fallbackEmitted: finalState === "fallback",
      transportReceived: finalState !== "failed",
      transportFailed: finalState === "failed",
    }],
    verifiedTurns: finalState === "published" ? 1 : 0,
    repairedTurns: 0,
    fallbackTurns: finalState === "fallback" ? 1 : 0,
    failedTurns: finalState === "failed" ? 1 : 0,
  };
}
