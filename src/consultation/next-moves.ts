import type {
  CouncilEvent,
  CouncilParticipant,
  CouncilReport,
} from "../core/types.js";
import type { EvidenceVerificationSnapshot } from "../evidence/evidence-ledger.js";
import {
  deriveEvidenceGapRadar,
  type EvidenceGapItem,
} from "../evidence/gap-radar.js";

export type ConsultationNextMoveKind =
  | "request_evidence"
  | "inspect_source"
  | "check_date"
  | "narrow_dispute"
  | "retest_revision"
  | "hear_minority";

export type ConsultationNextMoveModeHint = "verify" | "stress_test" | "explore";

export interface ConsultationNextMove {
  id: string;
  kind: ConsultationNextMoveKind;
  priority: number;
  icon: string;
  modeHint: ConsultationNextMoveModeHint;
  relatedEventIds: string[];
  en: {
    label: string;
    reason: string;
    proposal: string;
  };
  zhCN: {
    label: string;
    reason: string;
    proposal: string;
  };
}

export function deriveConsultationNextMoves(
  report: CouncilReport,
  participants: readonly CouncilParticipant[],
  events: readonly CouncilEvent[],
  verifications: Readonly<Record<string, EvidenceVerificationSnapshot>> = {},
  limit = 4,
): ConsultationNextMove[] {
  const radar = deriveEvidenceGapRadar(participants, events, verifications);
  const byId = new Map(events.map((event) => [event.id, event]));
  const participantName = new Map(participants.map((participant) => [participant.id, participant.name]));
  const moves: ConsultationNextMove[] = [];

  for (const gap of radar.items) {
    const move = moveForGap(gap, byId, participantName, radar.items);
    if (move) moves.push(move);
  }

  if (report.disagreements.length) {
    const minority = report.disagreements[0]!;
    const leading = report.consensusStance ?? "the leading position";
    moves.push({
      id: `next:minority:${minority.participant.id}:${normalizeId(minority.stance)}`,
      kind: "hear_minority",
      priority: 88,
      icon: "🧍",
      modeHint: "stress_test",
      relatedEventIds: latestPositionIdsFor(events, minority.participant.id),
      en: {
        label: "Hear the surviving minority",
        reason: `${minority.participant.name} still ends at “${minority.stance}” while the leading position is “${leading}”.`,
        proposal: `Run a focused follow-up on the surviving minority view. The leading position is “${leading}”, while ${minority.participant.name} still argues for “${minority.stance}”. Ask every participant to identify the strongest condition under which the minority view would be right, the strongest evidence against it, and whether the leading recommendation should change. Do not treat majority support as authority.`,
      },
      zhCN: {
        label: "听完幸存的少数意见",
        reason: `${minority.participant.name} 最终仍坚持“${minority.stance}”，而当前领先立场是“${leading}”。`,
        proposal: `围绕仍然存在的少数意见再进行一轮集中协商。当前领先立场是“${leading}”，但 ${minority.participant.name} 仍坚持“${minority.stance}”。请所有参与者分别指出：什么条件下少数意见可能是正确的、反对它的最强证据是什么、这些条件是否足以改变当前推荐。不要把多数支持当成权威。`,
      },
    });
  }

  return dedupeMoves(moves)
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit));
}

function moveForGap(
  gap: EvidenceGapItem,
  byId: ReadonlyMap<string, CouncilEvent>,
  participantName: ReadonlyMap<string, string>,
  allGaps: readonly EvidenceGapItem[],
): ConsultationNextMove | null {
  const primaryEvent = gap.provenanceEventIds.map((id) => byId.get(id)).find(Boolean);
  const actor = participantName.get(gap.actorId) ?? gap.actorName;

  if (gap.kind === "challenged_without_evidence") {
    const target = gap.targetEventId ? byId.get(gap.targetEventId) : undefined;
    const claim = compactEventText(target);
    return {
      id: `next:evidence:${gap.targetEventId ?? gap.id}`,
      kind: "request_evidence",
      priority: 100,
      icon: "⚔",
      modeHint: "verify",
      relatedEventIds: [...gap.provenanceEventIds],
      en: {
        label: "Fill the evidence gap",
        reason: `A structured challenge exists, but no evidence event currently answers it${claim ? `: “${claim}”` : "."}`,
        proposal: `Continue in verification mode around this challenged claim: “${claim || "the challenged claim"}”. Ask participants to provide public evidence that directly supports or weakens the claim, distinguish facts from assumptions, state source dates when available, and revise or stay uncertain if the evidence is insufficient.`,
      },
      zhCN: {
        label: "补上这条证据缺口",
        reason: `这里已经出现明确质疑，但目前没有 evidence 事件直接回应它${claim ? `：“${claim}”` : "。"}`,
        proposal: `围绕这条被质疑的主张继续进行核验型协商：“${claim || "当前被质疑的主张"}”。请参与者提供能够直接支持或削弱该主张的公开证据，区分事实与假设，能确定时给出来源日期；如果证据不足，应明确修正观点或保持不确定。`,
      },
    };
  }

  if (gap.kind === "evidence_without_source" || gap.kind === "source_not_observed") {
    const evidence = gap.evidenceEventId ? byId.get(gap.evidenceEventId) : primaryEvent;
    const claim = evidence?.kind === "evidence" ? compact(evidence.claim, 170) : compactEventText(evidence);
    return {
      id: `next:inspect:${gap.evidenceEventId ?? gap.id}`,
      kind: "inspect_source",
      priority: gap.kind === "evidence_without_source" ? 96 : 86,
      icon: "👁",
      modeHint: "verify",
      relatedEventIds: [...gap.provenanceEventIds],
      en: {
        label: gap.kind === "evidence_without_source" ? "Ask for an inspectable source" : "Inspect the supplied source",
        reason: gap.kind === "evidence_without_source"
          ? `An evidence event exists, but it has no safe public source ChatChat can inspect.`
          : `A public source was supplied, but ChatChat has no bounded observation for it yet.`,
        proposal: `Revisit this evidence claim: “${claim || "the cited evidence"}”. Ask participants to supply an inspectable public source if one is missing, check what the source actually says, and keep source reachability separate from whether the claim is supported.`,
      },
      zhCN: {
        label: gap.kind === "evidence_without_source" ? "要求一个可检查的来源" : "检查已经给出的来源",
        reason: gap.kind === "evidence_without_source"
          ? "这里存在 evidence 事件，但没有 ChatChat 能安全检查的公开来源。"
          : "参与者已经给出公开来源，但 ChatChat 还没有留下有限来源观察。",
        proposal: `重新核验这条证据主张：“${claim || "当前引用的证据"}”。如果缺少来源，请参与者提供可检查的公开来源；如果已有来源，请核对页面实际表达的内容，并始终把“来源能够访问”和“主张得到支持”作为两件不同的事。`,
      },
    };
  }

  if (gap.kind === "source_date_missing") {
    const evidence = gap.evidenceEventId ? byId.get(gap.evidenceEventId) : primaryEvent;
    const claim = evidence?.kind === "evidence" ? compact(evidence.claim, 160) : compactEventText(evidence);
    return {
      id: `next:date:${gap.evidenceEventId ?? gap.id}`,
      kind: "check_date",
      priority: 78,
      icon: "🕒",
      modeHint: "verify",
      relatedEventIds: [...gap.provenanceEventIds],
      en: {
        label: "Find the source date",
        reason: `This evidence has no usable source/page date signal, so recency cannot be evaluated yet.`,
        proposal: `Check the time context of this evidence: “${claim || "the cited evidence"}”. Ask participants to identify the publication or modification date when possible and explain whether age matters for this specific claim. Do not label a source stale merely because it is old.`,
      },
      zhCN: {
        label: "补齐来源时间",
        reason: "这条证据目前没有可用的来源/页面日期信号，因此还无法判断时间相关性。",
        proposal: `检查这条证据的时间语境：“${claim || "当前引用的证据"}”。请参与者尽可能确认发布或修改日期，并解释“时间久”是否真的会影响这条具体主张。不要仅因为来源较旧就自动判定它已经过时。`,
      },
    };
  }

  if (gap.kind === "disputed_source") {
    const evidence = gap.evidenceEventId ? byId.get(gap.evidenceEventId) : primaryEvent;
    const claim = evidence?.kind === "evidence" ? compact(evidence.claim, 170) : compactEventText(evidence);
    const alsoInfluential = allGaps.some(
      (item) => item.kind === "evidence_changed_view" && item.evidenceEventId === gap.evidenceEventId,
    );
    return {
      id: `next:scope:${gap.evidenceEventId ?? gap.id}`,
      kind: alsoInfluential ? "retest_revision" : "narrow_dispute",
      priority: alsoInfluential ? 97 : 94,
      icon: alsoInfluential ? "↻" : "🔎",
      modeHint: "stress_test",
      relatedEventIds: [...gap.provenanceEventIds],
      en: {
        label: alsoInfluential ? "Stress-test the evidence-driven revision" : "Narrow the evidence dispute",
        reason: alsoInfluential
          ? `This evidence is disputed and also explicitly caused a later revision. That makes it worth a focused re-check.`
          : `The source/evidence event remains explicitly challenged even if the URL may be reachable.`,
        proposal: `Stress-test this disputed evidence claim: “${claim || "the disputed evidence"}”. Separate (1) whether the source exists and is reachable, (2) what the source actually supports, and (3) the broader conclusion participants drew from it. Identify the strongest overreach or counterexample, then state whether any evidence-driven revision should stand, narrow, or reverse.`,
      },
      zhCN: {
        label: alsoInfluential ? "复核这次由证据触发的改口" : "缩小这场证据争议",
        reason: alsoInfluential
          ? "这条证据既被明确质疑，又明确促成了后续 revision，值得单独复核。"
          : "即使来源可能可以访问，这条证据事件本身仍然受到明确质疑。",
        proposal: `对这条仍有争议的证据主张进行压力测试：“${claim || "当前有争议的证据"}”。请严格区分：（1）来源是否存在并可访问；（2）来源实际上支持什么；（3）参与者从来源推导出的更大结论。找出最强的范围越界或反例，然后说明此前由该证据触发的改口应该保持、缩小还是撤回。`,
      },
    };
  }

  return null;
}

function latestPositionIdsFor(events: readonly CouncilEvent[], actorId: string): string[] {
  const ids = events
    .filter((event) => event.actorId === actorId && (event.kind === "argument" || event.kind === "revision" || event.kind === "final_position"))
    .map((event) => event.id);
  return ids.length ? [ids.at(-1)!] : [];
}

function compactEventText(event: CouncilEvent | undefined): string {
  if (!event) return "";
  if (event.kind === "evidence") return compact(event.claim, 170);
  return compact(event.content, 170);
}

function compact(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

function normalizeId(value: string): string {
  return value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "stance";
}

function dedupeMoves(moves: readonly ConsultationNextMove[]): ConsultationNextMove[] {
  const seen = new Set<string>();
  const result: ConsultationNextMove[] = [];
  for (const move of moves) {
    const key = `${move.kind}:${move.relatedEventIds.join(",") || move.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(move);
  }
  return result;
}
