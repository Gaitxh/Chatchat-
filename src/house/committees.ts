import type { CouncilParticipant } from "../core/types.js";

export type HouseCommitteeId =
  | "evidence"
  | "security"
  | "economics"
  | "engineering"
  | "experience"
  | "counterexample"
  | "requirements";

export interface HouseCommitteeDefinition {
  id: HouseCommitteeId;
  name: string;
  icon: string;
  task: string;
  outputHint: string;
}

export interface CommitteeAssignment {
  committee: HouseCommitteeDefinition;
  participant: CouncilParticipant;
}

export interface CommitteePlan {
  committees: HouseCommitteeDefinition[];
  assignments: CommitteeAssignment[];
  unassigned: CouncilParticipant[];
}

/**
 * Committee v1 intentionally ships a fixed, reviewable set of neutral jobs.
 * None of these tasks prescribes a desired answer or stance.
 */
export const BUILT_IN_HOUSE_COMMITTEES: readonly HouseCommitteeDefinition[] = [
  {
    id: "evidence",
    name: "Evidence Committee",
    icon: "📎",
    task:
      "Identify factual claims that matter to the decision. Distinguish verified facts, unsupported assertions, assumptions, and evidence that should be requested. Do not favor any conclusion merely because it has more supporters.",
    outputHint: "verified claims · challenged claims · missing evidence",
  },
  {
    id: "security",
    name: "Security & Privacy Committee",
    icon: "🛡️",
    task:
      "Investigate security, privacy, abuse, authentication, data-flow, and trust-boundary risks relevant to the King's question. Compare risks symmetrically across plausible options; do not advocate a predetermined winner.",
    outputHint: "threats · trust boundaries · mitigations · unknowns",
  },
  {
    id: "economics",
    name: "Cost & Economics Committee",
    icon: "💰",
    task:
      "Investigate cost, time, operational overhead, opportunity cost, and economic trade-offs. State assumptions and sensitivity to scale. Do not optimize for the cheapest option unless the King's constraints make cost decisive.",
    outputHint: "cost drivers · trade-offs · scale sensitivity",
  },
  {
    id: "engineering",
    name: "Engineering Committee",
    icon: "🧱",
    task:
      "Investigate technical feasibility, architecture, implementation complexity, reliability, maintainability, and migration/fallback paths. Surface engineering unknowns rather than hiding them.",
    outputHint: "feasibility · complexity · failure modes · escape hatches",
  },
  {
    id: "experience",
    name: "User Experience Committee",
    icon: "👥",
    task:
      "Investigate user experience, onboarding, accessibility, workflow friction, learnability, and adoption risks. Separate user evidence from personal preference and do not assume feature richness is automatically better.",
    outputHint: "user journeys · friction · accessibility · adoption risks",
  },
  {
    id: "counterexample",
    name: "Counterexample Committee",
    icon: "😈",
    task:
      "Assume the emerging Council consensus might be wrong. Search for the strongest counterexamples, edge cases, hidden dependencies, and conditions that would reverse the recommendation. Do not oppose merely for theater; concede when a counterexample fails.",
    outputHint: "counterexamples · reversal conditions · surviving objections",
  },
  {
    id: "requirements",
    name: "Requirements Committee",
    icon: "📜",
    task:
      "Track the King's explicit requirements, constraints, priorities, and unresolved ambiguities. Flag arguments that optimize a variable the King did not actually prioritize. Do not invent requirements.",
    outputHint: "requirements · constraints · ambiguities · requirement drift",
  },
] as const;

export function committeeById(
  id: HouseCommitteeId,
): HouseCommitteeDefinition {
  const committee = BUILT_IN_HOUSE_COMMITTEES.find((item) => item.id === id);
  if (!committee) throw new Error(`Unknown House committee: ${id}`);
  return committee;
}

/**
 * Deterministically assign seats while discouraging same-delegation clusters.
 *
 * Algorithm:
 * 1. Order seats by seatIndex, then delegationId, then participant id. This
 *    interleaves delegations when each delegation has numbered seats.
 * 2. For every seat, choose the committee with the fewest seats from that
 *    participant's delegation; then fewest total seats; then configured order.
 *
 * This is deterministic and intentionally not "random diversity" theater.
 */
export function assignHouseCommittees(
  participants: readonly CouncilParticipant[],
  committeeIds: readonly HouseCommitteeId[] = [
    "evidence",
    "security",
    "economics",
    "engineering",
    "experience",
    "counterexample",
    "requirements",
  ],
): CommitteePlan {
  const committees = uniqueCommitteeIds(committeeIds).map(committeeById);
  if (!committees.length || !participants.length) {
    return {
      committees,
      assignments: [],
      unassigned: [...participants],
    };
  }

  const ordered = [...participants].sort(participantAssignmentOrder);
  const totals = new Map<HouseCommitteeId, number>(
    committees.map((committee) => [committee.id, 0]),
  );
  const delegationTotals = new Map<string, Map<HouseCommitteeId, number>>();
  const assignments: CommitteeAssignment[] = [];

  for (const participant of ordered) {
    const delegationKey = participant.delegationId ?? participant.provider;
    const perDelegation = delegationTotals.get(delegationKey) ?? new Map();
    delegationTotals.set(delegationKey, perDelegation);

    const selected = committees
      .map((committee, index) => ({
        committee,
        index,
        sameDelegation: perDelegation.get(committee.id) ?? 0,
        total: totals.get(committee.id) ?? 0,
      }))
      .sort(
        (a, b) =>
          a.sameDelegation - b.sameDelegation ||
          a.total - b.total ||
          a.index - b.index,
      )[0]!.committee;

    assignments.push({ committee: selected, participant });
    totals.set(selected.id, (totals.get(selected.id) ?? 0) + 1);
    perDelegation.set(selected.id, (perDelegation.get(selected.id) ?? 0) + 1);
  }

  return {
    committees,
    assignments,
    unassigned: [],
  };
}

/** Attach public committee metadata without changing provider/source identity. */
export function applyCommitteeAssignments(
  participants: readonly CouncilParticipant[],
  assignments: readonly CommitteeAssignment[],
): CouncilParticipant[] {
  const byParticipant = new Map(
    assignments.map((assignment) => [assignment.participant.id, assignment.committee]),
  );

  return participants.map((participant) => {
    const committee = byParticipant.get(participant.id);
    if (!committee) return { ...participant };
    return {
      ...participant,
      committeeId: committee.id,
      committeeName: committee.name,
      committeeTask: committee.task,
    };
  });
}

export function committeeComposition(plan: CommitteePlan): Array<{
  committee: HouseCommitteeDefinition;
  seats: number;
  delegations: number;
  participantIds: string[];
}> {
  return plan.committees.map((committee) => {
    const members = plan.assignments.filter(
      (assignment) => assignment.committee.id === committee.id,
    );
    return {
      committee,
      seats: members.length,
      delegations: new Set(
        members.map(
          ({ participant }) => participant.delegationId ?? participant.provider,
        ),
      ).size,
      participantIds: members.map(({ participant }) => participant.id),
    };
  });
}

function uniqueCommitteeIds(
  ids: readonly HouseCommitteeId[],
): HouseCommitteeId[] {
  return [...new Set(ids)];
}

function participantAssignmentOrder(
  a: CouncilParticipant,
  b: CouncilParticipant,
): number {
  const seatA = a.seatIndex ?? Number.MAX_SAFE_INTEGER;
  const seatB = b.seatIndex ?? Number.MAX_SAFE_INTEGER;
  if (seatA !== seatB) return seatA - seatB;

  const delegationA = a.delegationId ?? a.provider;
  const delegationB = b.delegationId ?? b.provider;
  const byDelegation = delegationA.localeCompare(delegationB);
  if (byDelegation) return byDelegation;
  return a.id.localeCompare(b.id);
}
