import { useMemo } from "react";
import type { CouncilEvent, CouncilParticipant } from "../../core/types.js";
import type { Locale } from "../../i18n/index.js";
import type { EvidenceVerificationSnapshot } from "../../evidence/evidence-ledger.js";
import {
  deriveEvidenceGapRadar,
  type EvidenceGapItem,
  type EvidenceGapKind,
} from "../../evidence/gap-radar.js";
import "./evidence-gap-radar.css";

interface EvidenceGapRadarProps {
  participants: readonly CouncilParticipant[];
  events: readonly CouncilEvent[];
  verifications?: Readonly<Record<string, EvidenceVerificationSnapshot>>;
  locale: Locale;
  onFocusEvent?(eventId: string): void;
}

const LABELS: Record<EvidenceGapKind, { icon: string; en: string; zh: string }> = {
  challenged_without_evidence: { icon: "⚔", en: "CHALLENGED · NO EVIDENCE LINK", zh: "已质疑 · 尚无证据链接" },
  evidence_without_source: { icon: "📎", en: "EVIDENCE · NO SAFE SOURCE", zh: "有证据事件 · 无安全来源" },
  source_date_missing: { icon: "🕒", en: "SOURCE DATE MISSING", zh: "来源日期缺失" },
  source_not_observed: { icon: "👁", en: "SOURCE NOT OBSERVED", zh: "来源尚未观察" },
  disputed_source: { icon: "🔎", en: "EVIDENCE UNDER FIRE", zh: "证据仍有争议" },
  evidence_changed_view: { icon: "↻", en: "EVIDENCE CHANGED A VIEW", zh: "证据促成改口" },
};

export function EvidenceGapRadar({
  participants,
 events,
  verifications = {},
  locale,
  onFocusEvent,
}: EvidenceGapRadarProps) {
  const radar = useMemo(
    () => deriveEvidenceGapRadar(participants, events, verifications),
    [participants, events, verifications],
  );
  const zh = locale === "zh-CN";

  return (
    <section className="evidence-gap-radar">
      <header>
        <div>
          <span>{zh ? "证据缺口雷达" : "EVIDENCE GAP RADAR"}</span>
          <h3>{zh ? "还有哪里没查清楚？" : "What is still unresolved?"}</h3>
          <p>{zh
            ? "这里只显示结构化事件能证明存在的缺口与进展。‘没有 evidence 链接’不等于主张为假。"
            : "Only gaps and progress supported by structured events appear here. ‘No evidence link’ does not mean a claim is false."}</p>
        </div>
        <div className="gap-radar-counts">
          <b>{radar.counts.attention}<small>{zh ? "需关注" : "attention"}</small></b>
          <b>{radar.counts.open}<small>{zh ? "待补全" : "open"}</small></b>
          <b>{radar.counts.resolved}<small>{zh ? "已有进展" : "progress"}</small></b>
        </div>
      </header>

      {radar.items.length ? (
        <div className="gap-radar-list">
          {radar.items.slice(0, 8).map((item) => (
            <GapCard
              key={item.id}
              item={item}
              zh={zh}
              {...(onFocusEvent ? { onFocusEvent } : {})}
            />
          ))}
        </div>
      ) : (
        <div className="gap-radar-empty">
          <b>◎</b>
          <span>{zh ? "目前没有结构化证据缺口可展示。" : "No structured evidence gap is visible yet."}</span>
        </div>
      )}

      <small className="gap-radar-boundary">{zh
        ? "雷达记录‘缺了什么’，不替 AI 或用户裁决‘什么是真的’。"
        : "The radar records what is missing; it does not decide what is true."}</small>
    </section>
  );
}

function GapCard({
  item,
  zh,
  onFocusEvent,
}: {
  item: EvidenceGapItem;
  zh: boolean;
  onFocusEvent?: (eventId: string) => void;
}) {
  const label = LABELS[item.kind];
  const eventId = item.provenanceEventIds[0];
  return (
    <button
      type="button"
      className={`gap-radar-item tone-${item.tone}`}
      onClick={() => eventId && onFocusEvent?.(eventId)}
      disabled={!eventId || !onFocusEvent}
    >
      <b>{label.icon}</b>
      <div>
        <span>{zh ? label.zh : label.en}</span>
        <strong>{item.actorName} · R{item.round}</strong>
        <p>{item.detail}</p>
      </div>
      <em>{item.tone === "resolved" ? "✓" : item.tone === "attention" ? "!" : "…"}</em>
    </button>
  );
}
