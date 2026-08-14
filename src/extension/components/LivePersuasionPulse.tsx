import { useMemo } from "react";
import type { CouncilEvent, CouncilParticipant } from "../../core/types.js";
import type { Locale } from "../../i18n/index.js";
import { deriveLivePersuasionMoments, type LivePersuasionMoment } from "../../theater/live-persuasion.js";
import { focusConsultationEvent } from "../provenance-wire.js";
import "./live-persuasion-pulse.css";

export function LivePersuasionPulse({
  participants,
  events,
  locale,
}: {
  participants: readonly CouncilParticipant[];
  events: readonly CouncilEvent[];
  locale: Locale;
}) {
  const moments = useMemo(
    () => deriveLivePersuasionMoments(participants, events),
    [participants, events],
  );
  if (!moments.length) return null;

  const zh = locale === "zh-CN";
  const visible = moments.slice(0, 3);
  return (
    <section className="live-persuasion-pulse" data-persuasion-count={moments.length}>
      <header>
        <div>
          <span>{zh ? "实时说服" : "LIVE PERSUASION"}</span>
          <strong>{zh ? "观点正在移动" : "Positions are moving"}</strong>
          <p>{zh
            ? "这里只显示协议已经证明的强影响：明确的改口因果或公开让步。普通文字里说“我被说服了”不会自动算。"
            : "Only protocol-proven strong influence appears here: explicit revision causality or concession. Similar prose never creates a persuasion event."}</p>
        </div>
        <b>↻ {moments.length}</b>
      </header>

      <div className="live-persuasion-pulse__list">
        {visible.map((moment) => (
          <PersuasionMomentCard key={moment.id} moment={moment} locale={locale} />
        ))}
      </div>
    </section>
  );
}

function PersuasionMomentCard({ moment, locale }: { moment: LivePersuasionMoment; locale: Locale }) {
  const zh = locale === "zh-CN";
  const revised = moment.kind === "revision";
  const transition = revised && moment.toStance
    ? `${moment.fromStance ?? "?"} → ${moment.toStance}`
    : zh ? "公开让步" : "explicit concession";
  const cause = causeLabel(moment.causeKind, zh);

  return (
    <article
      className={`live-persuasion-moment is-${moment.kind}`}
      data-persuasion-strength="strong"
      data-persuasion-kind={moment.kind}
      data-persuasion-action-event={moment.actionEventId}
      data-persuasion-cause-event={moment.causeEventId}
    >
      <div className="live-persuasion-moment__route">
        <span>{monogram(moment.influencerName)}</span>
        <div><strong>{moment.influencerName}</strong><small>{cause}</small></div>
        <b>⟶</b>
        <span>{monogram(moment.changingActorName)}</span>
        <div><strong>{moment.changingActorName}</strong><small>{transition}</small></div>
        <em>R{moment.round}</em>
      </div>

      <div className="live-persuasion-moment__body">
        <p>{revised
          ? zh
            ? `${moment.changingActorName} 明确修改了自己的立场；这次变化把 ${moment.influencerName} 的 ${cause} 记录为因果来源。`
            : `${moment.changingActorName} explicitly revised its stance and recorded ${moment.influencerName}'s ${cause} as a causal source.`
          : zh
            ? `${moment.changingActorName} 明确向 ${moment.influencerName} 的观点让步。`
            : `${moment.changingActorName} explicitly conceded a point to ${moment.influencerName}.`}</p>
        <q>{moment.causeExcerpt}</q>
      </div>

      <div className="live-persuasion-moment__trace">
        <button type="button" onClick={() => focusConsultationEvent(moment.causeEventId)}>
          {zh ? "看触发原因" : "Trace cause"} ↗
        </button>
        <button type="button" onClick={() => focusConsultationEvent(moment.actionEventId)}>
          {zh ? "看改口/让步" : "Trace change"} ↗
        </button>
      </div>
    </article>
  );
}

function causeLabel(kind: CouncilEvent["kind"], zh: boolean): string {
  if (kind === "evidence") return zh ? "证据" : "evidence";
  if (kind === "challenge") return zh ? "质疑" : "challenge";
  if (kind === "question") return zh ? "追问" : "question";
  if (kind === "argument") return zh ? "观点" : "argument";
  if (kind === "support") return zh ? "支持" : "support";
  if (kind === "defense") return zh ? "辩护" : "defense";
  return zh ? "结构化事件" : "structured event";
}

function monogram(name: string): string {
  if (/deepseek/i.test(name)) return "D";
  if (/gemini/i.test(name)) return "Gm";
  if (/claude/i.test(name)) return "C";
  if (/qwen|通义/i.test(name)) return "Q";
  if (/gpt|chatgpt/i.test(name)) return "G";
  return name.slice(0, 2).toUpperCase();
}
