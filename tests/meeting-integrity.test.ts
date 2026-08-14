import type { ProviderAttendanceAuditModel } from "../src/theater/provider-attendance.js";
import { deriveMeetingExecutionIntegrity } from "../src/theater/meeting-integrity.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const verified = deriveMeetingExecutionIntegrity(model({ totalTurns: 12, verifiedTurns: 12 }));
assert(verified.state === "verified", "all published turns with no repair/failure must be verified");
assert(verified.fullyVerifiedSeats === 3 && verified.totalSeats === 3, "all complete seats must be counted");

const repaired = deriveMeetingExecutionIntegrity(model({ totalTurns: 12, verifiedTurns: 12, repairedTurns: 2 }));
assert(repaired.state === "verified_after_repair", "repair must remain visible even when all turns eventually publish");
assert(repaired.unresolvedTurns === 0, "successful repair must not create an unresolved turn");

const degraded = deriveMeetingExecutionIntegrity(model({ totalTurns: 12, verifiedTurns: 11, fallbackTurns: 1 }));
assert(degraded.state === "degraded", "fallback must degrade meeting execution integrity");
assert(degraded.fallbackTurns === 1, "fallback count must remain explicit");
assert(degraded.unresolvedTurns === 0, "fallback is a known failure class, not an unresolved state");

const failed = deriveMeetingExecutionIntegrity(model({ totalTurns: 12, verifiedTurns: 10, failedTurns: 2 }));
assert(failed.state === "degraded", "hard failures must degrade meeting integrity");

const incomplete = deriveMeetingExecutionIntegrity(model({ totalTurns: 12, verifiedTurns: 10 }));
assert(incomplete.state === "incomplete", "unclosed audit turns must make the result provisional");
assert(incomplete.unresolvedTurns === 2, "unresolved count must be derived conservatively");

const waiting = deriveMeetingExecutionIntegrity(model({ totalTurns: 0, verifiedTurns: 0 }));
assert(waiting.state === "waiting", "empty audit must not pretend the meeting is verified");

console.log("✓ Meeting execution integrity tests passed");

function model(overrides: {
  totalTurns: number;
  verifiedTurns: number;
  repairedTurns?: number;
  fallbackTurns?: number;
  failedTurns?: number;
}): ProviderAttendanceAuditModel {
  const perSeatTurns = overrides.totalTurns ? 4 : 0;
  const completeSeats = overrides.verifiedTurns === overrides.totalTurns && !overrides.fallbackTurns && !overrides.failedTurns;
  return {
    sessionId: overrides.totalTurns ? "session-integrity" : null,
    totalTurns: overrides.totalTurns,
    verifiedTurns: overrides.verifiedTurns,
    repairedTurns: overrides.repairedTurns ?? 0,
    fallbackTurns: overrides.fallbackTurns ?? 0,
    failedTurns: overrides.failedTurns ?? 0,
    seats: ["gpt", "claude", "gemini"].map((actorId) => ({
      actorId,
      participantName: actorId,
      providerId: actorId,
      turns: Array.from({ length: perSeatTurns }, (_, index) => ({
        key: `${actorId}:${index}`,
        sessionId: "session-integrity",
        actorId,
        participantName: actorId,
        providerId: actorId,
        phase: index === 0 ? "sealed" : index === 3 ? "final" : "debate",
        round: index + 1,
        state: completeSeats ? "published" : "response_captured",
        snapshotEventIds: [],
        publishedEventIds: [],
        contributionKinds: [],
        repairRequested: false,
        repairSucceeded: false,
        fallbackEmitted: false,
        transportReceived: true,
        transportFailed: false,
      })),
      verifiedTurns: completeSeats ? perSeatTurns : actorId === "gpt" ? Math.min(perSeatTurns, overrides.verifiedTurns) : 0,
      repairedTurns: 0,
      fallbackTurns: 0,
      failedTurns: 0,
    })),
  };
}
