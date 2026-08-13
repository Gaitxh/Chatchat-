import type {
  CouncilParticipant,
  CouncilPosition,
  CouncilReport,
} from "../core/types.js";

export const MAX_HOUSE_SEATS = 64;
export const MAX_DELEGATION_SEATS = 16;

export interface DelegationPlan {
  id: string;
  name: string;
  provider: string;
  seats: number;
}

export interface DelegateDescriptor {
  actorId: string;
  delegationId: string;
  delegationName: string;
  provider: string;
  seatIndex: number;
  seatCount: number;
  displayName: string;
}

export interface DelegationSummary {
  id: string;
  name: string;
  provider: string;
  seats: number;
  pluralityStance: string | null;
  pluralitySeats: number;
  discipline: number;
  split: boolean;
  stanceCounts: Record<string, number>;
  memberIds: string[];
  rebelIds: string[];
}

export interface CaucusSummary {
  key: string;
  stance: string;
  seats: number;
  seatRatio: number;
  delegationBreakdown: Record<string, number>;
  memberIds: string[];
}

export interface MajoritySummary {
  stance: string | null;
  support: number;
  total: number;
  ratio: number;
  tied: boolean;
}

export interface HouseSummary {
  seatCount: number;
  delegationCount: number;
  seatMajority: MajoritySummary;
  delegationConsensus: MajoritySummary;
  splitDelegations: number;
  delegations: DelegationSummary[];
  caucuses: CaucusSummary[];
}

export function expandDelegationPlan(
  plans: readonly DelegationPlan[],
): DelegateDescriptor[] {
  if (plans.length < 1) {
    throw new Error("AI House requires at least one delegation plan.");
  }

  const ids = new Set<string>();
  let totalSeats = 0;
  for (const plan of plans) {
    validatePlan(plan);
    if (ids.has(plan.id)) {
      throw new Error(`Duplicate delegation id: ${plan.id}`);
    }
    ids.add(plan.id);
    totalSeats += plan.seats;
  }

  if (totalSeats < 2) {
    throw new Error("AI House requires at least two seats.");
  }
  if (totalSeats > MAX_HOUSE_SEATS) {
    throw new Error(
      `AI House is limited to ${MAX_HOUSE_SEATS} seats in this release.`,
    );
  }

  return plans.flatMap((plan) =>
    Array.from({ length: plan.seats }, (_, offset) => {
      const seatIndex = offset + 1;
      return {
        actorId: `${safeId(plan.id)}::seat-${String(seatIndex).padStart(2, "0")}`,
        delegationId: plan.id,
        delegationName: plan.name,
        provider: plan.provider,
        seatIndex,
        seatCount: plan.seats,
        displayName: `${plan.name.replace(/\s+Delegation$/i, "")} · ${String(seatIndex).padStart(2, "0")}`,
      } satisfies DelegateDescriptor;
    }),
  );
}

export function participantForDelegate(
  delegate: DelegateDescriptor,
  role = "House Delegate",
): CouncilParticipant {
  return {
    id: delegate.actorId,
    name: delegate.displayName,
    provider: delegate.provider,
    role,
    delegationId: delegate.delegationId,
    delegationName: delegate.delegationName,
    seatIndex: delegate.seatIndex,
    seatCount: delegate.seatCount,
  };
}

export function deriveHouseSummary(report: CouncilReport): HouseSummary {
  const positions = report.positions;
  const seatMajority = majorityFromPositions(positions);
  const delegationGroups = groupByDelegation(positions);
  const delegations = [...delegationGroups.entries()]
    .map(([id, group]) => summarizeDelegation(id, group))
    .sort((a, b) => a.name.localeCompare(b.name));

  const delegationVotes = delegations
    .filter((delegation) => delegation.pluralityStance && !delegation.split)
    .map((delegation) => delegation.pluralityStance!);
  const delegationConsensus = majorityFromStances(delegationVotes);

  return {
    seatCount: positions.length,
    delegationCount: delegations.length,
    seatMajority,
    delegationConsensus,
    splitDelegations: delegations.filter((delegation) => delegation.split).length,
    delegations,
    caucuses: summarizeCaucuses(positions),
  };
}

function validatePlan(plan: DelegationPlan): void {
  if (!plan.id.trim()) throw new Error("Delegation id is required.");
  if (!plan.name.trim()) throw new Error("Delegation name is required.");
  if (!plan.provider.trim()) throw new Error("Delegation provider is required.");
  if (!Number.isInteger(plan.seats) || plan.seats < 1) {
    throw new Error(`Delegation ${plan.name} must have an integer seat count >= 1.`);
  }
  if (plan.seats > MAX_DELEGATION_SEATS) {
    throw new Error(
      `Delegation ${plan.name} exceeds the ${MAX_DELEGATION_SEATS}-seat per-model limit.`,
    );
  }
}

function groupByDelegation(
  positions: readonly CouncilPosition[],
): Map<string, CouncilPosition[]> {
  const groups = new Map<string, CouncilPosition[]>();
  for (const position of positions) {
    const key =
      position.participant.delegationId ??
      `provider:${position.participant.provider}`;
    const current = groups.get(key) ?? [];
    current.push(position);
    groups.set(key, current);
  }
  return groups;
}

function summarizeDelegation(
  id: string,
  positions: readonly CouncilPosition[],
): DelegationSummary {
  const counts = countStances(positions.map((position) => position.stance));
  const top = topEntries(counts);
  const winner = top[0];
  const tied = top.length > 1 && winner && top[1]![1] === winner[1];
  const pluralityStance = tied ? null : winner?.[0] ?? null;
  const pluralitySeats = tied ? 0 : winner?.[1] ?? 0;
  const memberIds = positions.map((position) => position.participant.id);
  const rebelIds = pluralityStance
    ? positions
        .filter(
          (position) => normalizeStance(position.stance) !== normalizeStance(pluralityStance),
        )
        .map((position) => position.participant.id)
    : [...memberIds];

  return {
    id,
    name:
      positions[0]?.participant.delegationName ??
      positions[0]?.participant.provider ??
      id,
    provider: positions[0]?.participant.provider ?? "unknown",
    seats: positions.length,
    pluralityStance,
    pluralitySeats,
    discipline: positions.length ? pluralitySeats / positions.length : 0,
    split: tied,
    stanceCounts: Object.fromEntries(top),
    memberIds,
    rebelIds,
  };
}

function summarizeCaucuses(
  positions: readonly CouncilPosition[],
): CaucusSummary[] {
  const groups = new Map<string, CouncilPosition[]>();
  for (const position of positions) {
    const key = normalizeStance(position.stance);
    const current = groups.get(key) ?? [];
    current.push(position);
    groups.set(key, current);
  }

  return [...groups.entries()]
    .map(([key, members]) => {
      const delegationBreakdown: Record<string, number> = {};
      for (const member of members) {
        const delegation =
          member.participant.delegationName ??
          member.participant.delegationId ??
          member.participant.provider;
        delegationBreakdown[delegation] =
          (delegationBreakdown[delegation] ?? 0) + 1;
      }
      return {
        key,
        stance: members[0]?.stance ?? key,
        seats: members.length,
        seatRatio: positions.length ? members.length / positions.length : 0,
        delegationBreakdown,
        memberIds: members.map((member) => member.participant.id),
      } satisfies CaucusSummary;
    })
    .sort((a, b) => b.seats - a.seats || a.stance.localeCompare(b.stance));
}

function majorityFromPositions(
  positions: readonly CouncilPosition[],
): MajoritySummary {
  return majorityFromStances(positions.map((position) => position.stance));
}

function majorityFromStances(stances: readonly string[]): MajoritySummary {
  const counts = countStances(stances);
  const top = topEntries(counts);
  const winner = top[0];
  const tied = top.length > 1 && winner && top[1]![1] === winner[1];
  return {
    stance: tied ? null : winner?.[0] ?? null,
    support: tied ? 0 : winner?.[1] ?? 0,
    total: stances.length,
    ratio: stances.length && !tied && winner ? winner[1] / stances.length : 0,
    tied: Boolean(tied),
  };
}

function countStances(stances: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const stance of stances) {
    const key = normalizeStance(stance);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function topEntries(counts: ReadonlyMap<string, number>): [string, number][] {
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
}

function normalizeStance(stance: string): string {
  return stance.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function safeId(value: string): string {
  const normalized = value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "delegation";
}
