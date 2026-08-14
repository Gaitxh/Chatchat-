import { useEffect, useMemo, useRef } from "react";
import type {
  CouncilEvent,
  CouncilEventKind,
  CouncilParticipant,
  CouncilPhaseUpdate,
} from "../../core/types.js";
import type { Locale } from "../../i18n/index.js";
import {
  buildDiscussionStream,
  type DiscussionEntry,
  type DiscussionRound,
} from "../../theater/discussion-stream.js";
import "./live-discussion-stream.css";

interface LiveDiscussionStreamProps {
  participants: readonly CouncilParticipant[];
  events: readonly CouncilEvent[];
  phase: CouncilPhaseUpdate | null;
  locale: Locale;
  onFocusEvent(eventId: string): void;
}

const COPY = {
  en: {
    eyebrow: "LIVE DELIBERATION",
    title: "Watch the room think out loud",
    body: "This is the public meeting record. Replies, support, challenges and persuasion trails appear only when an AI declares them as structured actions.",
    live: "LIVE",
    independent: "Independent positions",
    independentNote: "Round 1 stayed sealed until every participant finished. These views are revealed together.",
    debate: "Open consultation",
    debateNote: "Every participant reads the same immutable public snapshot for this round.",
    final: "Final positions",
    finalNote: "Participants state where they landed after the public debate.",
    waiting: "The room is working. Public contributions will appear here as each round is published.",
    stance: "stance",
    confidence: "confidence",
    source: "source",
    explicitReasons: "explicit reasons",
    viewTrace: "trace event",
    repliedTo: "Direct reply to",
    event: "event",
    round: "Round {round}",
    actions: "public actions",
  },
  "zh-CN": {
    eyebrow: "大会发言直播",
    title: "看着整间会议室把问题想透",
    body: "这里是真实的公开议事记录。回复、支持、质疑和说服轨迹，只有 AI 通过结构化动作明确表达时才会出现，普通文字不会被系统脑补成剧情。",
    live: "直播中",
    independent: "独立意见",
    independentNote: "第 1 轮在所有参与者完成前保持密封；现在展示的是同时揭晓的独立观点。",
    debate: "公开协商",
    debateNote: "本轮所有参与者读取完全相同、不可变的公开会议快照。",
    final: "最终立场",
    finalNote: "公开辩论结束后，每个参与者说明自己最终站在哪里。",
    waiting: "会议室正在工作。每一轮正式发布后，真实发言会继续出现在这里。",
    stance: "立场",
    confidence: "置信度",
    source: "来源",
    explicitReasons: "明确改口原因",
    viewTrace: "查看原始事件",
    repliedTo: "直接回应",
    event: "事件",
    round: "第 {round} 轮",
    actions: "条公开动作",
  },
} as const;

const ACTION_META: Record<CouncilEventKind, { icon: string; en: string; "zh-CN": string }> = {
  argument: { icon: "◉", en: "VIEW", "zh-CN": "观点" },
  challenge: { icon: "⚔", en: "CHALLENGE", "zh-CN": "质疑" },
  evidence: { icon: "📎", en: "EVIDENCE", "zh-CN": "证据" },
  support: { icon: "🤝", en: "SUPPORT", "zh-CN": "支持" },
  defense: { icon: "🛡", en: "DEFENSE", "zh-CN": "辩护" },
  revision: { icon: "↻", en: "REVISION", "zh-CN": "改口" },
  concede: { icon: "🏳", en: "CONCEDE", "zh-CN": "让步" },
  question: { icon: "?", en: "QUESTION", "zh-CN": "追问" },
  uncertain: { icon: "≈", en: "UNCERTAIN", "zh-CN": "不确定" },
  final_position: { icon: "◎", en: "FINAL", "zh-CN": "最终意见" },
};

export function LiveDiscussionStream({
  participants,
  events,
  phase,
  locale,
  onFocusEvent,
}: LiveDiscussionStreamProps) {
  const copy = COPY[locale];
  const model = useMemo(() => buildDiscussionStream(participants, events), [participants, events]);
  const scrollRoot = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = scrollRoot.current;
    if (!root || !events.length) return;
    root.scrollTop = root.scrollHeight;
  }, [events.length]);

  return (
    <section className="live-discussion-stream">
      <header className="live-discussion-stream__header">
        <div>
          <span>{copy.eyebrow}</span>
          <h3>{copy.title}</h3>
          <p>{copy.body}</p>
        </div>
        <div className="discussion-live-chip">
          <i aria-hidden="true" />
          <b>{copy.live}</b>
          <small>{model.eventCount} {copy.actions}</small>
        </div>
      </header>

      <div className="discussion-scroll" ref={scrollRoot} aria-live="polite">
        {model.rounds.length ? model.rounds.map((round) => (
          <RoundBlock
            key={round.round}
            round={round}
            locale={locale}
            onFocusEvent={onFocusEvent}
          />
        )) : (
          <div className="discussion-waiting">
            <span>···</span>
            <p>{copy.waiting}</p>
          </div>
        )}
        {phase && model.rounds.length ? (
          <div className="discussion-round-working">
            <i aria-hidden="true" />
            <span>{workingLabel(phase, locale)}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RoundBlock({
  round,
  locale,
  onFocusEvent,
}: {
  round: DiscussionRound;
  locale: Locale;
  onFocusEvent(eventId: string): void;
}) {
  const copy = COPY[locale];
  const stage = stageCopy(round.phase, locale);
  return (
    <section className={`discussion-round discussion-round--${round.phase}`}>
      <div className="discussion-round__heading">
        <div>
          <b>{copy.round.replace("{round}", String(round.round))}</b>
          <strong>{stage.title}</strong>
        </div>
        <span>{round.entries.length}</span>
      </div>
      <p className="discussion-round__note">{stage.note}</p>
      <div className="discussion-entry-list">
        {round.entries.map((entry) => (
          <DiscussionCard
            key={entry.id}
            entry={entry}
            locale={locale}
            onFocusEvent={onFocusEvent}
          />
        ))}
      </div>
    </section>
  );
}

function DiscussionCard({
  entry,
  locale,
  onFocusEvent,
}: {
  entry: DiscussionEntry;
  locale: Locale;
  onFocusEvent(eventId: string): void;
}) {
  const copy = COPY[locale];
  const event = entry.event;
  const meta = ACTION_META[event.kind];
  const stance = eventStance(event);
  const confidence = eventConfidence(event);
  const relationship = relationshipText(entry, locale);

  return (
    <article className={`discussion-entry discussion-entry--${event.kind}`} data-event-kind={event.kind}>
      <div className="discussion-speaker">
        <b>{monogram(entry.actorName)}</b>
        <div>
          <strong>{entry.actorName}</strong>
          <span><i>{meta.icon}</i> {meta[locale]}</span>
        </div>
        <small>R{event.round}</small>
      </div>

      {entry.replyToEventId && entry.replyToActorName ? (
        <div className="discussion-relation discussion-relation--reply" data-reply-to-event={entry.replyToEventId}>
          <b>↪</b>
          <div>
            <strong>{copy.repliedTo} {entry.replyToActorName}</strong>
            {entry.replyToExcerpt ? <q>{entry.replyToExcerpt}</q> : null}
          </div>
          <button type="button" onClick={() => onFocusEvent(entry.replyToEventId!)} aria-label={copy.viewTrace}>↗</button>
        </div>
      ) : null}

      {relationship ? (
        <div className="discussion-relation">
          <b>{relationship.icon}</b>
          <div>
            <strong>{relationship.label}</strong>
            {entry.targetExcerpt ? <q>{entry.targetExcerpt}</q> : null}
          </div>
        </div>
      ) : null}

      {event.kind === "revision" && entry.previousStance ? (
        <div className="discussion-stance-change">
          <span>{entry.previousStance}</span><b>→</b><strong>{event.stance}</strong>
        </div>
      ) : null}

      {event.kind === "evidence" ? (
        <div className="discussion-evidence-claim">
          <small>{locale === "zh-CN" ? "证据主张" : "EVIDENCE CLAIM"}</small>
          <strong>{event.claim}</strong>
        </div>
      ) : null}

      <p className="discussion-entry__speech">{event.content}</p>

      {event.kind === "revision" && entry.causes.length ? (
        <div className="discussion-causes">
          <span>{copy.explicitReasons}</span>
          {entry.causes.map((cause) => (
            <button type="button" key={cause.eventId} onClick={() => onFocusEvent(cause.eventId)}>
              {ACTION_META[cause.kind].icon} {cause.actorName} · {ACTION_META[cause.kind][locale]}
            </button>
          ))}
        </div>
      ) : null}

      <div className="discussion-entry__footer">
        <div>
          {stance ? <span>{copy.stance}: <b>{stance}</b></span> : null}
          {typeof confidence === "number" ? <span>{copy.confidence}: <b>{Math.round(confidence * 100)}%</b></span> : null}
          {entry.sourceHost ? <span>{copy.source}: <b>{entry.sourceHost}</b></span> : null}
        </div>
        <button type="button" onClick={() => onFocusEvent(event.id)}>{copy.viewTrace} ↗</button>
      </div>
    </article>
  );
}

function stageCopy(phase: DiscussionRound["phase"], locale: Locale): { title: string; note: string } {
  const copy = COPY[locale];
  if (phase === "sealed") return { title: copy.independent, note: copy.independentNote };
  if (phase === "final") return { title: copy.final, note: copy.finalNote };
  return { title: copy.debate, note: copy.debateNote };
}

function relationshipText(entry: DiscussionEntry, locale: Locale): { icon: string; label: string } | null {
  const target = entry.targetActorName;
  const zh = locale === "zh-CN";
  switch (entry.event.kind) {
    case "challenge": return target ? { icon: "⚔", label: zh ? `正在质疑 ${target}` : `Challenges ${target}` } : null;
    case "support": return target ? { icon: "🤝", label: zh ? `明确支持 ${target}` : `Explicitly supports ${target}` } : null;
    case "defense": return target ? { icon: "🛡", label: zh ? `回应对 ${target} 观点的攻击` : `Defends a point from ${target}` } : null;
    case "concede": return target ? { icon: "🏳", label: zh ? `向 ${target} 的观点明确让步` : `Explicitly concedes to ${target}` } : null;
    case "evidence": return target ? { icon: "📎", label: zh ? `为涉及 ${target} 的事件提交证据` : `Submits evidence on an event from ${target}` } : null;
    case "question": return target ? { icon: "?", label: zh ? `直接追问 ${target}` : `Direct question to ${target}` } : null;
    default: return null;
  }
}

function workingLabel(phase: CouncilPhaseUpdate, locale: Locale): string {
  const zh = locale === "zh-CN";
  if (phase.phase === "sealed") return zh ? `第 ${phase.round} 轮独立分析正在进行` : `Round ${phase.round} independent analysis is in progress`;
  if (phase.phase === "final") return zh ? "各 AI 正在形成最终立场" : "AIs are forming their final positions";
  return zh ? `第 ${phase.round} 轮公开协商正在进行` : `Round ${phase.round} open consultation is in progress`;
}

function eventStance(event: CouncilEvent): string | undefined {
  return event.kind === "argument" || event.kind === "revision" || event.kind === "final_position"
    ? event.stance
    : undefined;
}

function eventConfidence(event: CouncilEvent): number | undefined {
  switch (event.kind) {
    case "argument":
    case "evidence":
    case "revision":
    case "uncertain":
    case "final_position":
      return event.confidence;
    default:
      return undefined;
  }
}

function monogram(name: string): string {
  if (/deepseek/i.test(name)) return "D";
  if (/gemini/i.test(name)) return "Gm";
  if (/claude/i.test(name)) return "C";
  if (/qwen|通义/i.test(name)) return "Q";
  if (/gpt|chatgpt/i.test(name)) return "G";
  return name.slice(0, 2).toUpperCase();
}
