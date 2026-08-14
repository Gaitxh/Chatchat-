import type { CouncilConsultationMode } from "../core/types.js";

export interface ConsultationModeDefinition {
  id: CouncilConsultationMode;
  icon: string;
  en: { label: string; short: string; goal: string };
  zhCN: { label: string; short: string; goal: string };
}

export const CONSULTATION_MODES: readonly ConsultationModeDefinition[] = [
  { id: "balanced", icon: "◉", en: { label: "Balanced", short: "A general-purpose consultation", goal: "Improve accuracy and usefulness. Surface important trade-offs, conditions, evidence gaps and remaining disagreement without forcing unanimity." }, zhCN: { label: "平衡", short: "默认的通用协商", goal: "提高准确性和实用性；明确重要取舍、适用条件、证据缺口和仍然存在的分歧，不强迫形成一致意见。" } },
  { id: "explore", icon: "🌿", en: { label: "Explore", short: "Map routes, assumptions and blind spots", goal: "Map distinct plausible approaches, hidden assumptions, unknowns, trade-offs and neglected possibilities. Do not force a recommendation when the evidence is not ready." }, zhCN: { label: "探索", short: "寻找路线、假设与盲点", goal: "尽量找出不同可行路线、隐藏假设、未知项、取舍和容易被忽略的可能性。证据不足时不要强行给唯一推荐。" } },
  { id: "decide", icon: "⚖", en: { label: "Decide", short: "Turn trade-offs into a recommendation", goal: "Compare options against the user's stated constraints. When evidence permits, make a clear recommendation, explain the trade-offs, and state what conditions would reverse the choice." }, zhCN: { label: "决策", short: "把取舍变成明确建议", goal: "依据用户给出的约束比较选项。证据允许时给出清楚推荐，同时说明取舍，以及哪些条件变化会让结论反转。" } },
  { id: "verify", icon: "🔎", en: { label: "Verify", short: "Pressure-test factual claims and evidence", goal: "Prioritize factual claims, evidence gaps, source scope, dates and tool observations. Challenge unsupported or over-broad claims. A reachable source is not proof that its associated claim is true." }, zhCN: { label: "核验", short: "优先追问事实与证据", goal: "优先检查事实性主张、证据缺口、来源适用范围、日期与工具观察。主动质疑缺乏依据或范围过大的主张。来源可达不等于相关主张为真。" } },
  { id: "stress_test", icon: "🧨", en: { label: "Stress Test", short: "Find the strongest failure conditions", goal: "Seek the strongest counterexamples, failure conditions and hidden assumptions for leading positions. Do not disagree for theater: if a position survives serious testing, acknowledge that explicitly." }, zhCN: { label: "压力测试", short: "寻找最强反例与失败条件", goal: "针对领先方案寻找最强反例、失败条件和隐藏假设。不要为了戏剧效果而反对；如果一个方案经受住了认真检验，应明确承认这一点。" } },
] as const;

export function consultationModeDefinition(mode: CouncilConsultationMode | undefined): ConsultationModeDefinition {
  return CONSULTATION_MODES.find((item) => item.id === mode) ?? CONSULTATION_MODES[0]!;
}

export function consultationModeGoal(mode: CouncilConsultationMode | undefined): string {
  return consultationModeDefinition(mode).en.goal;
}
