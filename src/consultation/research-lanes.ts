import type {
  CouncilConsultationMode,
  CouncilParticipant,
  CouncilResearchLane,
} from "../core/types.js";

export interface ResearchLaneDefinition {
  id: CouncilResearchLane;
  icon: string;
  en: { label: string; goal: string };
  zhCN: { label: string; goal: string };
}

export const RESEARCH_LANES: readonly ResearchLaneDefinition[] = [
  {
    id: "primary_sources",
    icon: "📚",
    en: { label: "Primary sources", goal: "Prefer first-party, official, original or directly observable evidence. Check dates, scope and whether the source actually supports the claim." },
    zhCN: { label: "主源核验", goal: "优先寻找第一方、官方、原始或可直接观察的证据；检查日期、适用范围，以及来源是否真的支持相关主张。" },
  },
  {
    id: "strongest_counterexample",
    icon: "⚔",
    en: { label: "Strongest counterexample", goal: "Look for the strongest concrete case that would falsify, reverse or seriously weaken the leading claim. Do not manufacture disagreement." },
    zhCN: { label: "最强反例", goal: "寻找最有力、最具体、足以推翻、反转或显著削弱领先主张的反例；不要为了反对而制造分歧。" },
  },
  {
    id: "implementation_constraints",
    icon: "🧩",
    en: { label: "Implementation constraints", goal: "Investigate technical, legal, operational, permission, cost and dependency constraints that could make an otherwise good idea fail in practice." },
    zhCN: { label: "实现约束", goal: "研究技术、法律、运维、权限、成本与依赖约束，找出一个看起来不错的方案在现实中可能失败的地方。" },
  },
  {
    id: "historical_base_rate",
    icon: "⌛",
    en: { label: "History & base rates", goal: "Seek relevant precedents, historical outcomes, frequencies or comparison classes. Separate anecdotes from useful base-rate evidence." },
    zhCN: { label: "历史与基准率", goal: "寻找相关先例、历史结果、发生频率和可比类别；区分个案轶事与真正有用的基准率证据。" },
  },
  {
    id: "user_failure_modes",
    icon: "🧪",
    en: { label: "User failure modes", goal: "Investigate how the proposal can confuse, burden, exclude, mislead or fail for real users, including recovery paths and worst plausible UX states." },
    zhCN: { label: "用户失败模式", goal: "研究提案可能如何让真实用户困惑、增加负担、排除用户、造成误导或失败，并关注恢复路径和最糟但合理的用户体验状态。" },
  },
] as const;

const BY_ID = new Map(RESEARCH_LANES.map((lane) => [lane.id, lane] as const));

export function researchLaneDefinition(lane: CouncilResearchLane): ResearchLaneDefinition {
  return BY_ID.get(lane)!;
}

export function consultationResearchLaneAssignments(
  mode: CouncilConsultationMode,
  participants: readonly CouncilParticipant[],
): Record<string, CouncilResearchLane> {
  if (mode !== "verify" && mode !== "stress_test") return {};
  const order: readonly CouncilResearchLane[] = mode === "stress_test"
    ? [
        "strongest_counterexample",
        "user_failure_modes",
        "implementation_constraints",
        "primary_sources",
        "historical_base_rate",
      ]
    : [
        "primary_sources",
        "strongest_counterexample",
        "implementation_constraints",
        "historical_base_rate",
        "user_failure_modes",
      ];
  return Object.fromEntries(
    participants.map((participant, index) => [participant.id, order[index % order.length]!]),
  );
}
