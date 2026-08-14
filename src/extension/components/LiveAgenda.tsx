import { useEffect, useState } from "react";
import type {
  CouncilEvent,
  CouncilEventKind,
  CouncilParticipant,
  CouncilPhaseUpdate,
} from "../../core/types.js";
import type { Locale } from "../../i18n/index.js";
import { focusConsultationEvent } from "../provenance-wire.js";
import "./live-agenda.css";

const LIVE_EVENT = "chatchat:consultation-live";
const MAX_AGENDA_TRAIL = 6;

interface ConsultationLivePhaseDetail {
  phase?: CouncilPhaseUpdate | null;
}

interface LiveAgendaProps {
  phase: CouncilPhaseUpdate | null;
  events: readonly CouncilEvent[];
  participants: readonly CouncilParticipant[];
  locale: Locale;
}

const EVENT_META: Record<CouncilEventKind, { icon: string; en: string; zh: string }> = {
  argument: { icon: "◉", en: "new view", zh: "新观点" },
  challenge: { icon: "⚔", en: "challenge", zh: "质疑" },
  evidence: { icon: "📎", en: "evidence", zh: "证据" },
  support: { icon: "🤝", en: "support", zh: "支持" },
  defense: { icon: "🛡", en: "defense", zh: "辩护" },
  revision: { icon: "↻", en: "revision", zh: "改口" },
  concede: { icon: "🏳", en: "concession", zh: "让步" },
  question: { icon: "?", en: "question", zh: "追问" },
  uncertain: { icon: "≈", en: "uncertainty", zh: "不确定性" },
  final_position: { icon: "◎", en: "final position", zh: "最终立场" },
};

export function LiveAgenda({ phase, events, participants, locale }: LiveAgendaProps) {
  const [trail, setTrail] = useState<CouncilPhaseUpdate[]>(() => phase?.reason ? [clonePhase(phase)] : []);

  useEffect(() => {
    if (!phase?.reason) return;
    setTrail((current) => rememberPhase(current, phase));
  }, [phase]);

  useEffect(() => {
    const onLive = (event: Event) => {
      const update = (event as CustomEvent<ConsultationLivePhaseDetail>).detail?.phase;
      if (!update?.reason) return;
      setTrail((current) => rememberPhase(current, update));
    };
    window.addEventListener(LIVE_EVENT, onLive);
    return () => window.removeEventListener(LIVE_EVENT, onLive);
  }, []);

  const current = phase?.reason ? phase : trail.at(-1) ?? null;
  if (!current?.reason) return null;

  const zh = locale === "zh-CN";
  const triggers = triggerEvents(current, events);
  const reason = reasonCopy(current, triggers, zh);
  const alignment = current.alignmentRatio == null ? null : Math.round(current.alignmentRatio * 100);
  const threshold = current.convergenceThreshold == null ? null : Math.round(current.convergenceThreshold * 100);
  const currentKey = phaseKey(current);
  const previous = trail.filter((item) => item.reason && phaseKey(item) !== currentKey).slice(-4);

  return (
    <section className="live-agenda" data-phase-reason={current.reason} data-trigger-count={triggers.length}>
      <div className="live-agenda__icon">{reason.icon}</div>
      <div className="live-agenda__main">
        <span>{zh ? "大会为什么还在继续" : "WHY THIS ROUND EXISTS"}</span>
        <strong>{reason.title}</strong>
        <p>{reason.body}</p>
        <AgendaTriggers triggers={triggers} participants={participants} zh={zh} />
      </div>
      <div className="live-agenda__metrics">
        {alignment != null && threshold != null ? (
          <div><small>{zh ? "当前对齐" : "alignment"}</small><b>{alignment}%</b><i>/ {threshold}%</i></div>
        ) : null}
        {current.minimumDebateRounds != null ? (
          <div><small>{zh ? "公开讨论" : "open debate"}</small><b>{current.debateRoundsCompleted ?? 0}</b><i>/ {current.minimumDebateRounds}</i></div>
        ) : null}
      </div>

      {previous.length ? (
        <div className="live-agenda__trail" data-agenda-trail-count={previous.length}>
          <span>{zh ? "程序轨迹" : "ROUND TRAIL"}</span>
          <div>
            {previous.map((item) => {
              const itemTriggers = triggerEvents(item, events);
              const copy = reasonCopy(item, itemTriggers, zh);
              return (
                <article
                  key={phaseKey(item)}
                  className={`live-agenda__trail-item reason-${item.reason}`}
                  data-phase-reason={item.reason}
                  data-agenda-trail-round={item.round}
                >
                  <b>{copy.icon}</b>
                  <div>
                    <small>{item.phase === "final" ? (zh ? "最终阶段" : "FINAL") : `R${item.round}`}</small>
                    <strong>{copy.title}</strong>
                    <AgendaTriggers triggers={itemTriggers} participants={participants} zh={zh} compact />
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AgendaTriggers({
  triggers,
  participants,
  zh,
  compact = false,
}: {
  triggers: readonly CouncilEvent[];
  participants: readonly CouncilParticipant[];
  zh: boolean;
  compact?: boolean;
}) {
  if (!triggers.length) return null;
  return (
    <div className={`live-agenda__triggers ${compact ? "is-compact" : ""}`}>
      {triggers.map((event) => {
        const meta = EVENT_META[event.kind];
        return (
          <button
            type="button"
            key={event.id}
            className={`live-agenda__trigger trigger-${event.kind}`}
            data-agenda-trigger-event={event.id}
            title={zh ? `查看原始事件 ${event.id}` : `Inspect source event ${event.id}`}
            onClick={() => focusConsultationEvent(event.id)}
          >
            <b>{meta.icon}</b>
            <span>{participantName(participants, event.actorId)}</span>
            <small>{zh ? meta.zh : meta.en}</small>
          </button>
        );
      })}
    </div>
  );
}

function rememberPhase(current: readonly CouncilPhaseUpdate[], update: CouncilPhaseUpdate): CouncilPhaseUpdate[] {
  const key = phaseKey(update);
  if (current.some((item) => phaseKey(item) === key)) return current as CouncilPhaseUpdate[];
  return [...current, clonePhase(update)].slice(-MAX_AGENDA_TRAIL);
}

function clonePhase(update: CouncilPhaseUpdate): CouncilPhaseUpdate {
  return {
    ...update,
    ...(update.triggerEventIds ? { triggerEventIds: [...update.triggerEventIds] } : {}),
  };
}

function phaseKey(update: CouncilPhaseUpdate): string {
  return `${update.phase}:${update.round}:${update.reason ?? "unknown"}`;
}

function triggerEvents(update: CouncilPhaseUpdate, events: readonly CouncilEvent[]): CouncilEvent[] {
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  return (update.triggerEventIds ?? [])
    .map((eventId) => eventById.get(eventId))
    .filter((event): event is CouncilEvent => Boolean(event));
}

function reasonCopy(
  phase: CouncilPhaseUpdate,
  triggers: readonly CouncilEvent[],
  zh: boolean,
): { icon: string; title: string; body: string } {
  switch (phase.reason) {
    case "sealed_start":
      return zh
        ? { icon: "◌", title: "先让每位 AI 独立形成意见", body: "第一轮完全封闭。任何参与者都看不到其他 AI 的输出，减少锚定与抢跑效应。" }
        : { icon: "◌", title: "Independent views come first", body: "Round 1 is sealed. No participant can see peer output yet, reducing anchoring and speaking-order effects." };
    case "initial_debate":
      return zh
        ? { icon: "↔", title: "独立意见已经公开，开始第一次共同协商", body: "所有 AI 现在读取同一个不可变会议快照，并行回应彼此；网站响应更快不会获得更多权力。" }
        : { icon: "↔", title: "Independent views are public; shared consultation begins", body: "Every AI now reads the same immutable meeting snapshot and responds in parallel. Faster websites gain no extra authority." };
    case "fresh_signal_follow_up":
      return zh
        ? { icon: "⚡", title: "上一轮出现了同行还没看见的新信息", body: `上一批次刚公开 ${triggers.length || phase.triggerEventIds?.length || 0} 条新证据、质疑、观点、改口、追问或不确定性。由于参与者上一轮读取的是旧快照，大会必须再给同行一次公开回应机会。` }
        : { icon: "⚡", title: "The previous batch introduced information peers have not seen", body: `${triggers.length || phase.triggerEventIds?.length || 0} fresh evidence/challenge/view/revision/question/uncertainty signal(s) were just published. Peers answered an older immutable snapshot, so the room must give them one public response opportunity.` };
    case "minimum_debate_rounds":
      return zh
        ? { icon: "≡", title: "本模式要求更充分的公开讨论", body: `目前只完成 ${phase.debateRoundsCompleted ?? 0} 轮公开协商，本模式至少要求 ${phase.minimumDebateRounds ?? 0} 轮，因此大会继续。` }
        : { icon: "≡", title: "This mode requires deeper open discussion", body: `${phase.debateRoundsCompleted ?? 0} open debate round(s) are complete; this mode requires at least ${phase.minimumDebateRounds ?? 0}, so deliberation continues.` };
    case "alignment_not_reached":
      return zh
        ? { icon: "≈", title: "当前立场仍未达到本模式的收敛阈值", body: `当前对齐度约 ${percent(phase.alignmentRatio)}，低于 ${percent(phase.convergenceThreshold)} 的阈值。大会继续讨论，而不是把多数意见直接当成结论。` }
        : { icon: "≈", title: "Current positions have not reached this mode's alignment threshold", body: `Alignment is about ${percent(phase.alignmentRatio)}, below the ${percent(phase.convergenceThreshold)} threshold. The room keeps deliberating instead of treating a plurality as authority.` };
    case "finalizing_stable_alignment":
      return zh
        ? { icon: "✓", title: "公开讨论已稳定，进入最终立场", body: "最低讨论要求已经满足、对齐度达到阈值，而且上一轮没有新增需要同行回应的信号。每位 AI 现在独立提交最终意见。" }
        : { icon: "✓", title: "Open deliberation is stable; final positions begin", body: "Minimum debate is satisfied, alignment reached the threshold, and the previous batch introduced no fresh peer-response signal. Every AI now submits its final position independently." };
    case "finalizing_round_budget":
      return zh
        ? { icon: "■", title: "达到本模式的轮次边界，进入最终立场", body: "大会不会假装已经完全收敛；只是本模式允许的公开讨论轮次已经用完。剩余分歧和未决信号继续保留在事件流里。" }
        : { icon: "■", title: "This mode reached its round boundary; final positions begin", body: "The room does not pretend full convergence. Its open-round budget is exhausted, and remaining disagreement or unresolved signals stay visible in the event record." };
    default:
      return zh
        ? { icon: "·", title: "大会按协议继续", body: "本轮原因来自协商引擎的结构化状态。" }
        : { icon: "·", title: "The meeting continues by protocol", body: "This round is driven by structured consultation-engine state." };
  }
}

function participantName(participants: readonly CouncilParticipant[], actorId: string): string {
  return participants.find((participant) => participant.id === actorId)?.name ?? actorId;
}

function percent(value: number | undefined): string {
  return value == null ? "—" : `${Math.round(value * 100)}%`;
}
