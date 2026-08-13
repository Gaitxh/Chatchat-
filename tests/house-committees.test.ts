import type { CouncilParticipant } from "../src/core/types.js";
import {
  BUILT_IN_HOUSE_COMMITTEES,
  applyCommitteeAssignments,
  assignHouseCommittees,
  committeeComposition,
  recommendedCommitteeIds,
} from "../src/house/committees.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants = [
  ...delegation("gpt", "ChatGPT", 5),
  ...delegation("qwen", "Qwen", 5),
  ...delegation("gemini", "Gemini", 3),
  ...delegation("deepseek", "DeepSeek", 3),
];

const selected = ["evidence", "security", "engineering", "counterexample"] as const;
const plan = assignHouseCommittees(participants, selected);
assert(plan.assignments.length === participants.length, "Every House seat should receive exactly one committee assignment.");
assert(plan.unassigned.length === 0, "A non-empty committee plan should not strand seats.");
assert(new Set(plan.assignments.map((item) => item.participant.id)).size === participants.length, "A seat must never join two committees in v1.");

const composition = committeeComposition(plan);
const seatCounts = composition.map((item) => item.seats);
assert(Math.max(...seatCounts) - Math.min(...seatCounts) <= 1, "Committee sizes should stay balanced to within one seat.");
assert(composition.every((item) => item.delegations >= 3), "A sixteen-seat House should mix at least three Provider delegations in each selected committee.");

for (const source of ["gpt", "qwen", "gemini", "deepseek"]) {
  const assigned = plan.assignments.filter(({ participant }) => participant.delegationId === source);
  const byCommittee = new Map<string, number>();
  for (const item of assigned) byCommittee.set(item.committee.id, (byCommittee.get(item.committee.id) ?? 0) + 1);
  const counts = [...byCommittee.values()];
  assert(Math.max(...counts) - Math.min(...counts) <= 1, `${source} seats should spread across committees instead of clustering unnecessarily.`);
}

const enriched = applyCommitteeAssignments(participants, plan.assignments);
assert(enriched.every((participant) => participant.committeeId && participant.committeeName && participant.committeeTask), "Applied assignments should expose public committee metadata.");
assert(participants.every((participant) => participant.committeeId === undefined), "Applying committee metadata must not mutate original House participants.");

const again = assignHouseCommittees(participants, selected);
assert(
  JSON.stringify(plan.assignments.map((item) => [item.participant.id, item.committee.id])) ===
    JSON.stringify(again.assignments.map((item) => [item.participant.id, item.committee.id])),
  "Committee assignment must be deterministic for replay and tests.",
);

assert(recommendedCommitteeIds(2).length === 2, "Tiny Councils should use only two investigative lenses.");
assert(recommendedCommitteeIds(10).length === BUILT_IN_HOUSE_COMMITTEES.length, "Large Houses should unlock the full committee bench.");

for (const committee of BUILT_IN_HOUSE_COMMITTEES) {
  const lower = committee.task.toLocaleLowerCase();
  for (const forbidden of ["argue that", "prove that", "convince the council that", "support the king's preferred", "you must choose"]) {
    assert(!lower.includes(forbidden), `${committee.name} must not prescribe a stance: ${forbidden}`);
  }
  assert(committee.task.length >= 80, `${committee.name} should be specific enough to guide useful investigation.`);
}

const empty = assignHouseCommittees(participants, []);
assert(empty.assignments.length === 0, "Free Parliament mode should create no committee assignments.");
assert(empty.unassigned.length === participants.length, "Free Parliament should leave every seat unassigned.");

console.log("✓ ChatChat House committee tests passed");

function delegation(delegationId: string, name: string, count: number): CouncilParticipant[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${delegationId}-${String(index + 1).padStart(2, "0")}`,
    name: `${name}-${String(index + 1).padStart(2, "0")}`,
    provider: delegationId,
    delegationId,
    delegationName: `${name} Delegation`,
    seatIndex: index + 1,
    seatCount: count,
  }));
}
