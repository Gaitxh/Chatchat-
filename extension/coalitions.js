export function buildCoalitionAnalysis(positions, advisors) {
  const advisorMap = new Map(advisors.map((advisor) => [advisor.id, advisor]));
  const groups = new Map();

  for (const position of positions) {
    const key = canonicalStance(position.stance);
    const advisor = advisorMap.get(position.actorId) ?? position.participant ?? {
      id: position.actorId,
      name: position.actorId,
      providerId: "unknown",
      delegationId: "unknown",
      delegationName: "Unknown",
    };
    const group = groups.get(key) ?? {
      id: coalitionId(key),
      key,
      stance: String(position.stance).trim(),
      members: [],
      delegations: new Set(),
    };
    group.members.push({
      actorId: position.actorId,
      name: advisor.name ?? position.actorId,
      providerId: advisor.providerId ?? advisor.participant?.provider ?? "unknown",
      delegationId: advisor.delegationId ?? "unknown",
      delegationName: advisor.delegationName ?? advisor.providerId ?? "Unknown",
      confidence: Number(position.confidence ?? 0),
    });
    group.delegations.add(advisor.delegationId ?? "unknown");
    groups.set(key, group);
  }

  const houseSize = Math.max(1, positions.length);
  const coalitions = [...groups.values()]
    .map((group) => ({
      id: group.id,
      stance: group.stance,
      normalizedStance: group.key,
      seats: group.members.length,
      houseShare: group.members.length / houseSize,
      members: group.members,
      delegationCount: group.delegations.size,
      averageConfidence: group.members.length
        ? group.members.reduce((sum, member) => sum + member.confidence, 0) /
          group.members.length
        : 0,
    }))
    .sort((a, b) =>
      b.seats - a.seats ||
      b.delegationCount - a.delegationCount ||
      a.normalizedStance.localeCompare(b.normalizedStance),
    );

  const seatCoalition = new Map();
  for (const coalition of coalitions) {
    for (const member of coalition.members) {
      seatCoalition.set(member.actorId, coalition.id);
    }
  }

  const delegationCoalitions = new Map();
  for (const advisor of advisors) {
    const coalitionId = seatCoalition.get(advisor.id);
    if (!coalitionId) continue;
    const set = delegationCoalitions.get(advisor.delegationId) ?? new Set();
    set.add(coalitionId);
    delegationCoalitions.set(advisor.delegationId, set);
  }

  const splitDelegations = [...delegationCoalitions.entries()]
    .filter(([, coalitionIds]) => coalitionIds.size > 1)
    .map(([delegationId, coalitionIds]) => ({
      delegationId,
      coalitionIds: [...coalitionIds],
    }));

  return {
    coalitions,
    splitDelegations,
    houseSize: positions.length,
    majorityCoalitionId:
      coalitions[0] && coalitions[0].houseShare > 0.5 ? coalitions[0].id : null,
  };
}

export function canonicalStance(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/^[`'"“”‘’]+|[`'"“”‘’]+$/g, "")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function coalitionId(key) {
  const safe = key
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `coalition:${safe || "unspecified"}`;
}
