import type { CouncilEvent, CouncilParticipant, CouncilReport } from "../src/core/types.js";
import type { ProviderAttendanceAuditModel } from "../src/theater/provider-attendance.js";
import {
  deriveFinalPositionFloor,
  normalizeFinalStance,
} from "../src/theater/final-position-floor.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "gpt", name: "ChatGPT", provider: "openai" },
  { id: "claude", name: "Claude", provider: "anthropic" },
  { id: "gemini", name: "Gemini", provider: "google" },
  { id: "deepseek", name: "DeepSeek", provider: "deepseek" },
];
const base = { sessionId: "final-floor-session", createdAt: "2026-08-15T08:00:00.000Z" };
const events: CouncilEvent[] = [
  { ...base, id: "g1", round: 1, actorId: "gpt", kind: "argument", stance: "Browser Extension", content: "Keep extension visible.", confidence: .76 },
  { ...base, id: "c1", round: 1, actorId: "claude", kind: "argument", stance: "Web UI", content: "Web first.", confidence: .68 },
  { ...base, id: "gm1", round: 1, actorId: "gemini", kind: "argument", stance: "Web + Extension", content: "Hybrid.", confidence: .71 },
  { ...base, id: "d1", round: 1, actorId: "deepseek", kind: "argument", stance: "Web + Extension", content: "Hybrid.", confidence: .70 },
  { ...base, id: "ev1", round: 2, actorId: "gemini", kind: "evidence", targetEventId: "c1", claim: "Runtime permissions exist.", content: "Chrome supports runtime host permission.", confidence: .85 },
  { ...base, id: "c2", round: 3, actorId: "claude", kind: "revision", previousEventId: "c1", stance: "Web + Extension", content: "I revise to hybrid.", confidence: .86, causedBy: ["ev1"] },
  { ...base, id: "fg", round: 4, actorId: "gpt", kind: "final_position", stance: "Browser Extension", content: "Extension remains primary.", confidence: .80 },
  { ...base, id: "fc", round: 4, actorId: "claude", kind: "final_position", stance: "Web + Extension", content: "Hybrid final.", confidence: .88 },
  { ...base, id: "fgm", round: 4, actorId: "gemini", kind: "final_position", stance: "web + extension", content: "Hybrid final.", confidence: .90 },
  // The report records Web UI for DeepSeek. Whether that may be described as a Provider-authored Final
  // depends on the execution receipt, not on the prose alone.
  { ...base, id: "fd", round: 4, actorId: "deepseek", kind: "final_position", stance: "Web UI", content: "I end at Web UI.", confidence: .61 },
];

const report: CouncilReport = {
  sessionId: base.sessionId,
  question: "What should ChatChat ship?",
  mode: "balanced",
  stopReason: "round_budget",
  consensusStance: "Web + Extension",
  consensusRatio: .5,
  confidence: .89,
  rounds: 4,
  positions: [
    { participant: participants[0]!, stance: "Browser Extension", content: "Extension remains primary.", confidence: .80, caveats: [] },
    { participant: participants[1]!, stance: "Web + Extension", content: "Hybrid final.", confidence: .88, caveats: [] },
    { participant: participants[2]!, stance: "web + extension", content: "Hybrid final.", confidence: .90, caveats: [] },
    { participant: participants[3]!, stance: "Web UI", content: "I end at Web UI.", confidence: .61, caveats: ["Bridge reliability remains uncertain."] },
  ],
  disagreements: [
    { participant: participants[0]!, stance: "Browser Extension", content: "Extension remains primary.", confidence: .80, caveats: [] },
    { participant: participants[3]!, stance: "Web UI", content: "I end at Web UI.", confidence: .61, caveats: ["Bridge reliability remains uncertain."] },
  ],
  eventCount: events.length,
};

const attendance: ProviderAttendanceAuditModel = {
  sessionId: base.sessionId,
  totalTurns: 16,
  verifiedTurns: 15,
  repairedTurns: 1,
  fallbackTurns: 1,
  failedTurns: 0,
  seats: [
    seat("gpt", "ChatGPT", "openai", "published", 4, 4),
    seat("claude", "Claude", "anthropic", "repaired", 4, 4),
    seat("gemini", "Gemini", "google", "published", 4, 4),
    seat("deepseek", "DeepSeek", "deepseek", "fallback", 3, 4),
  ],
};

const floor = deriveFinalPositionFloor(report, events, attendance);
assert(floor.participantCount === 4 && floor.groups.length === 3, "Final floor must reproduce report positions without inventing camps");
const hybrid = floor.groups.find((group) => group.stanceKey === normalizeFinalStance("Web + Extension"));
assert(hybrid?.count === 2 && hybrid.share === .5, "Case-only final stance variants should follow the orchestrator grouping contract");
assert(hybrid.isLargestGroup && hybrid.isReportLeadingGroup, "Report leading stance should map to the descriptive largest final group");
assert(floor.reportAlignmentMatchesGroups, "Final floor grouping should reproduce the report's descriptive alignment ratio");
assert(floor.minorityActorIds.includes("gpt") && floor.minorityActorIds.includes("deepseek"), "Minority seats must remain explicit rather than disappearing behind the leading group");

const claude = floor.seats.find((item) => item.actorId === "claude");
assert(claude?.executionState === "repaired" && claude.recordSource === "provider_final", "Repaired Final should remain a verified Provider-authored record with repair provenance");
assert(claude.changedExplicitStance, "Explicit revision across stance labels should mark the seat as changed");
assert(claude.revisionSteps[0]?.eventId === "c2" && claude.revisionSteps[0]?.previousEventId === "c1", "Revision lineage must preserve exact event IDs");
assert(claude.revisionSteps[0]?.causedByEventIds.includes("ev1"), "Final floor must preserve explicit revision causes");
assert(!claude.unexplainedFinalShift, "A final stance matching the latest explicit revision must not be flagged as unexplained");

const deepseek = floor.seats.find((item) => item.actorId === "deepseek");
assert(deepseek?.executionState === "fallback", "Fallback final turn must not masquerade as verified final participation");
assert(deepseek.recordSource === "fallback_placeholder", "Fallback seat must be explicitly sourced as a ChatChat fallback placeholder");
assert(!deepseek.unexplainedFinalShift, "Known fallback execution failure must not be mislabeled as the model silently changing its stance");
assert(!floor.unexplainedFinalShiftActorIds.includes("deepseek"), "Fallback placeholder must stay out of unexplained Provider Final shifts");
assert(floor.fallbackActorIds.includes("deepseek"), "Meeting-level model should expose fallback final seats explicitly");
assert(floor.degradedActorIds.includes("deepseek"), "Execution-degraded final seats must be visible at meeting level");

const gpt = floor.seats.find((item) => item.actorId === "gpt");
assert(gpt?.executionState === "verified" && gpt.recordSource === "provider_final" && !gpt.changedExplicitStance, "Stable verified seat should remain straightforward");

// The same report stance shift is genuinely unexplained only if the Final execution chain succeeded.
const fullyExecutedAttendance: ProviderAttendanceAuditModel = {
  ...attendance,
  verifiedTurns: 16,
  fallbackTurns: 0,
  seats: attendance.seats.map((item) => item.actorId === "deepseek"
    ? seat("deepseek", "DeepSeek", "deepseek", "published", 4, 4)
    : item),
};
const fullyExecutedFloor = deriveFinalPositionFloor(report, events, fullyExecutedAttendance);
const fullyExecutedDeepSeek = fullyExecutedFloor.seats.find((item) => item.actorId === "deepseek");
assert(fullyExecutedDeepSeek?.recordSource === "provider_final" && fullyExecutedDeepSeek.unexplainedFinalShift, "A verified Provider Final that silently differs from the latest pre-final stance must be surfaced without a fictional cause");
assert(fullyExecutedFloor.unexplainedFinalShiftActorIds.includes("deepseek"), "Meeting-level model should expose genuine unexplained Provider Final shifts");

// Activity from somebody else must never move a final seat.
const noisyEvents: CouncilEvent[] = [
  ...events,
  { ...base, id: "noise1", round: 3, actorId: "gpt", kind: "challenge", targetEventId: "c2", content: "I challenge Claude." },
  { ...base, id: "noise2", round: 3, actorId: "gpt", kind: "support", targetEventId: "c2", content: "I also support part of Claude's implementation detail." },
];
const noisy = deriveFinalPositionFloor(report, noisyEvents, attendance);
assert(noisy.seats.find((item) => item.actorId === "gpt")?.stance === "Browser Extension", "Challenge/support activity must never infer a different global final stance");

console.log("✓ ChatChat final-position-floor tests passed");
console.log("✓ Meeting-wide final groups reproduce CouncilReport.positions without inferring camps from peer activity");
console.log("✓ Verified/repaired Provider Finals, fallback placeholders and unverified records remain distinct");
console.log("✓ Known fallback shifts are not mislabeled unexplained; successful un-ticketed Provider Final shifts are");

function seat(
  actorId: string,
  participantName: string,
  providerId: string,
  finalState: "published" | "repaired" | "fallback" | "failed",
  verifiedTurns: number,
  totalTurns: number,
) {
  const turns = Array.from({ length: totalTurns }, (_, index) => ({
    key: `${base.sessionId}|${actorId}|${index === totalTurns - 1 ? "final" : index === 0 ? "sealed" : "debate"}|${index + 1}`,
    sessionId: base.sessionId,
    actorId,
    participantName,
    providerId,
    phase: index === totalTurns - 1 ? "final" as const : index === 0 ? "sealed" as const : "debate" as const,
    round: index + 1,
    state: index === totalTurns - 1 ? finalState : "published" as const,
    snapshotEventIds: [],
    publishedEventIds: [],
    contributionKinds: [],
    repairRequested: finalState === "repaired" && index === totalTurns - 1,
    repairSucceeded: finalState === "repaired" && index === totalTurns - 1,
    fallbackEmitted: finalState === "fallback" && index === totalTurns - 1,
    transportReceived: finalState !== "failed",
    transportFailed: finalState === "failed",
  }));
  return {
    actorId,
    participantName,
    providerId,
    turns,
    verifiedTurns,
    repairedTurns: finalState === "repaired" ? 1 : 0,
    fallbackTurns: finalState === "fallback" ? 1 : 0,
    failedTurns: finalState === "failed" ? 1 : 0,
  };
}
