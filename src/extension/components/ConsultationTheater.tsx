import { useEffect, useMemo, useState } from "react";
import type {
  CouncilEvent,
  CouncilEventKind,
  CouncilParticipant,
  CouncilReport,
} from "../../core/types.js";
import type { Locale } from "../../i18n/index.js";
import {
  buildConsultationTheaterModel,
  influenceKindLabel,
  type ConsultationReplayFrame,
  type ConsultationReplayStage,
} from "../../theater/consultation-theater.js";
import type { AggregatedInfluenceEdge } from "../../theater/influence.js";
import "./consultation-theater.css";

interface ConsultationTheaterProps {
  participants: readonly CouncilParticipant[];
  events: readonly CouncilEvent[];
  report: CouncilReport;
  locale: Locale;
  onFocusEvent(eventId: string): void;
}

type ReplaySpeed = "1x" | "2x" | "all";

const COPY = {
  en: {
    eyebrow: "CONSULTATION THEATER",
    title: "Who changed what — and why?",
    body: "Strong influence appears only when a participant explicitly revises or concedes with structured provenance. Ordinary challenges and evidence remain traceable interactions, not automatic proof of persuasion.",
    changed: "CHANGED MIND TRAILS",
    changedTitle: "Explicit revisions",
    noChanged: "No participant explicitly revised a position in this consultation.",
    influence: "INFLUENCE LEDGER",
    influenceTitle: "Traceable participant links",
    strong: "Changed mind / conceded",
    interaction: "Interaction",
    replay: "LOCAL REPLAY",
    replayTitle: "Play the consultation back",
    replayHint: "Replay reads the saved event stream only. It never sends another prompt to an AI provider.",
    play: "PLAY",
    pause: "PAUSE",
    restart: "RESTART",
    all: "ALL",
    start: "Proposal submitted. Independent views are about to appear.",
    round: "Round {round}",
    highlights: "AFTER-MEETING HIGHLIGHTS",
    highlightsTitle: "Event-derived highlights",
    highlightNote: "These labels are computed after the consultation and are never fed back to AI participants as incentives.",
    links: "{count} traceable links",
    strongLinks: "{count} strong",
    changedCount: "{count} changed mind",
    unresolved: "{count} broken event reference(s) were omitted rather than guessed.",
    view: "VIEW EVENT",
    because: "because of",
    independent: "Independent",
    consultation: "Consultation",
    final: "Final",
    complete: "Complete",
  },
  "zh-CN": {
    eyebrow: "协商剧场",
    title: "谁改变了什么，又为什么？",
    body: "只有参与者自己通过结构化 revision / concede 明确表示改口或让步时，才会形成“强影响”。普通质疑和证据会保留为可追溯互动，但不会自动冒充“成功说服”。",
    changed: "改口轨迹",
    changedTitle: "明确发生的立场修正",
    noChanged: "这场协商没有参与者明确修改自己的立场。",
    influence: "影响关系",
    influenceTitle: "可追溯的参与者互动",
    strong: "促成改口 / 让步",
    interaction: "互动",
    replay: "本地回放",
    replayTitle: "重新播放整场协商",
    replayHint: "Replay 只读取已经保存的结构化事件流，不会再次向任何 AI Provider 发送 Prompt。",
    play: "播放",
    pause: "暂停",
    restart: "重新开始",
    all: "全部",
    start: "用户提案已经提交，接下来出现的是彼此不可见的独立意见。",
    round: "第 {round} 轮",
    highlights: "会后亮点",
    highlightsTitle: "由事件本身计算的亮点",
    highlightNote: "这些标签只在协商结束后由 UI 计算，不会反馈给 AI 作为竞争奖励。",
    links: "{count} 条可追溯关系",
    strongLinks: "{count} 条强影响",
    changedCount: "{count} 次改口",
    unresolved: "有 {count} 个损坏的事件引用被安全忽略，系统没有猜测补全。",
    view: "查看事件",
    because: "原因来自",
    independent: "独立意见",
    consultation: "共同协商",
    final: "最终立场",
    complete: "完成",
  },
} as const;

export function ConsultationTheater({
  participants,
  events,
  report,
  locale,
  onFocusEvent,
}: ConsultationTheaterProps) {
  const copy = COPY[locale];
  const fullModel = useMemo(
    () => buildConsultationTheaterModel(participants, events, report, locale),
    [participants, events, report, locale],
  );
  const [cursor, setCursor] = useState(events.length);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>("1x");

  useEffect(() => {
    setCursor(events.length);
    setPlaying(false);
  }, [events.length, events.at(-1)?.id]);

  const frame = fullModel.replay[Math.min(cursor, fullModel.replay.length - 1)] ?? fullModel.replay[0]!;
  const replayModel = useMemo(
    () => buildConsultationTheaterModel(
      participants,
      events.slice(0, frame.cursor),
      frame.stage === "complete" ? report : null,
      locale,
    ),
    [participants, events, frame.cursor, frame.stage, report, locale],
  );

  useEffect(() => {
    if (!playing) return;
    if (speed === "all") {
      setCursor(events.length);
      setPlaying(false);
      return;
    }
    if (cursor >= events.length) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(
      () => setCursor((current) => Math.min(events.length, current + 1)),
      speed === "2x" ? 360 : 720,
    );
    return () => window.clearTimeout(timer);
  }, [cursor, events.length, playing, speed]);

  return (
    <section className="consultation-theater">
      <header className="consultation-theater__header">
        <div>
          <span className="theater-eyebrow">{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.body}</p>
        </div>
        <div className="theater-counts">
          <span>{format(copy.links, { count: fullModel.graph.edges.length })}</span>
          <span>{format(copy.strongLinks, { count: fullModel.summary.strongInfluenceLinks })}</span>
          <span>{format(copy.changedCount, { count: fullModel.summary.changedMindCount })}</span>
        </div>
      </header>


      <TheaterBlock eyebrow={copy.changed} title={copy.changedTitle} count={fullModel.changedMinds.length}>
        {fullModel.changedMinds.length ? (
          <div className="changed-mind-list">
            {fullModel.changedMinds.map((trail) => (
              <button
                type="button"
                className="changed-mind-card"
                key={trail.revisionEventId}
                onClick={() => onFocusEvent(trail.revisionEventId)}
              >
                <div className="changed-mind-card__top">
                  <strong>↻ {trail.participantName}</strong>
                  <span>{format(copy.round, { round: trail.round })}</span>
                </div>
                <div className="stance-transition">
                  <span>{trail.fromStance ?? "?"}</span><b>→</b><strong>{trail.toStance}</strong>
                </div>
                {trail.causedBy.length ? (
                  <div className="cause-list">
                    <small>{copy.because}</small>
                    {trail.causedBy.map((cause) => (
                      <span key={cause.eventId}>
                        {cause.participantName} · {eventKindLabel(cause.kind, locale)}
                      </span>
                    ))}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        ) : <p className="theater-empty">{copy.noChanged}</p>}
      </TheaterBlock>

      <TheaterBlock eyebrow={copy.influence} title={copy.influenceTitle}>
        <div className="influence-ledger">
          {sortEdges(fullModel.graph.aggregatedEdges).map((edge) => (
            <InfluenceRow
              key={edge.id}
              edge={edge}
              participants={participants}
              locale={locale}
              strongLabel={copy.strong}
              interactionLabel={copy.interaction}
              viewLabel={copy.view}
              onFocusEvent={onFocusEvent}
            />
          ))}
        </div>
        {fullModel.summary.unresolvedReferenceCount ? (
          <p className="theater-warning">⚠ {format(copy.unresolved, { count: fullModel.summary.unresolvedReferenceCount })}</p>
        ) : null}
      </TheaterBlock>

      <TheaterBlock eyebrow={copy.replay} title={copy.replayTitle} extra={stageLabel(frame.stage, locale)}>
        <p className="replay-hint">{copy.replayHint}</p>
        <div className="replay-controls">
          <button type="button" onClick={() => { setCursor(0); setPlaying(true); }}>↺ {copy.restart}</button>
          <button
            type="button"
            onClick={() => setPlaying((current) => !current)}
            disabled={cursor >= events.length && !playing}
          >{playing ? `Ⅱ ${copy.pause}` : `▶ ${copy.play}`}</button>
          <div className="replay-speed">
            {(["1x", "2x", "all"] as const).map((value) => (
              <button
                type="button"
                key={value}
                className={speed === value ? "is-active" : ""}
                onClick={() => {
                  setSpeed(value);
                  if (value === "all") {
                    setCursor(events.length);
                    setPlaying(false);
                  }
                }}
              >{value === "all" ? copy.all : value}</button>
            ))}
          </div>
        </div>
        <input
          type="range"
          className="replay-slider"
          min={0}
          max={events.length}
          value={cursor}
          onChange={(event) => { setPlaying(false); setCursor(Number(event.target.value)); }}
          aria-label="Consultation replay cursor"
        />
        <ReplayNow
          frame={frame}
          participants={participants}
          locale={locale}
          startCopy={copy.start}
          viewCopy={copy.view}
          onFocusEvent={onFocusEvent}
        />
        <div className="replay-mini-stats">
          <span>{frame.cursor}/{events.length} events</span>
          <span>{replayModel.graph.edges.length} links</span>
        </div>
      </TheaterBlock>

      {fullModel.highlights.length ? (
        <TheaterBlock eyebrow={copy.highlights} title={copy.highlightsTitle}>
          <p className="highlight-note">{copy.highlightNote}</p>
          <div className="highlight-grid">
            {fullModel.highlights.map((highlight) => (
              <button
                type="button"
                className="highlight-card"
                key={highlight.kind}
                onClick={() => {
                  const eventId = highlight.provenanceEventIds[0];
                  if (eventId) onFocusEvent(eventId);
                }}
              >
                <b>{highlight.icon}</b>
                <div>
                  <span>{highlight.title}</span>
                  <strong>{highlight.participantName}</strong>
                  <small>{highlight.detail}</small>
                </div>
              </button>
            ))}
          </div>
        </TheaterBlock>
      ) : null}
    </section>
  );
}

function TheaterBlock({
  eyebrow,
  title,
  count,
  extra,
  children,
}: {
  eyebrow: string;
  title: string;
  count?: number;
  extra?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="theater-block">
      <div className="theater-block__heading">
        <div><span>{eyebrow}</span><h3>{title}</h3></div>
        {typeof count === "number" ? <b>{count}</b> : extra ? <strong className="replay-stage">{extra}</strong> : null}
      </div>
      {children}
    </div>
  );
}

function InfluenceRow({
  edge,
  participants,
  locale,
  strongLabel,
  interactionLabel,
  viewLabel,
  onFocusEvent,
}: {
  edge: AggregatedInfluenceEdge;
  participants: readonly CouncilParticipant[];
  locale: Locale;
  strongLabel: string;
  interactionLabel: string;
  viewLabel: string;
  onFocusEvent(eventId: string): void;
}) {
  const source = participantName(participants, edge.sourceActorId);
  const target = participantName(participants, edge.targetActorId);
  const kinds = Object.entries(edge.kinds)
    .filter(([, count]) => Boolean(count))
    .map(([kind, count]) => `${influenceKindLabel(kind as Parameters<typeof influenceKindLabel>[0], locale)} ×${count}`)
    .join(" · ");
  return (
    <article className={`influence-row influence-row--${edge.strength}`}>
      <div className="influence-row__actors"><strong>{source}</strong><b>→</b><strong>{target}</strong></div>
      <div className="influence-row__meta">
        <span>{edge.strength === "strong" ? strongLabel : interactionLabel}</span>
        <small>{kinds}</small>
      </div>
      {edge.eventIds[0] ? <button type="button" onClick={() => onFocusEvent(edge.eventIds[0]!)}>{viewLabel}</button> : null}
    </article>
  );
}

function ReplayNow({
  frame,
  participants,
  locale,
  startCopy,
  viewCopy,
  onFocusEvent,
}: {
  frame: ConsultationReplayFrame;
  participants: readonly CouncilParticipant[];
  locale: Locale;
  startCopy: string;
  viewCopy: string;
  onFocusEvent(eventId: string): void;
}) {
  if (!frame.event) return <div className="replay-now replay-now--start">{startCopy}</div>;
  const event = frame.event;
  return (
    <article className={`replay-now replay-now--${event.kind}`}>
      <div>
        <strong>{participantName(participants, event.actorId)}</strong>
        <span>{eventKindLabel(event.kind, locale)} · {stageLabel(frame.stage, locale)} · R{event.round}</span>
      </div>
      <p>{truncate(event.content, 260)}</p>
      {frame.changedMind ? (
        <div className="replay-changed-mind">↻ {frame.changedMind.fromStance ?? "?"} → {frame.changedMind.toStance}</div>
      ) : null}
      <button type="button" onClick={() => onFocusEvent(event.id)}>{viewCopy}</button>
    </article>
  );
}

function stageLabel(stage: ConsultationReplayStage, locale: Locale): string {
  const copy = COPY[locale];
  if (stage === "independent") return copy.independent;
  if (stage === "consultation") return copy.consultation;
  if (stage === "final") return copy.final;
  return copy.complete;
}

function eventKindLabel(kind: CouncilEventKind, locale: Locale): string {
  const labels: Record<CouncilEventKind, [string, string]> = {
    argument: ["Position", "立场"],
    challenge: ["Challenge", "质疑"],
    evidence: ["Evidence", "证据"],
    support: ["Support", "支持"],
    defense: ["Defense", "答辩"],
    revision: ["Revision", "修正"],
    concede: ["Concede", "让步"],
    question: ["Question", "追问"],
    uncertain: ["Uncertain", "不确定"],
    final_position: ["Final position", "最终立场"],
  };
  return locale === "zh-CN" ? labels[kind][1] : labels[kind][0];
}

function participantName(participants: readonly CouncilParticipant[], id: string): string {
  return participants.find((participant) => participant.id === id)?.name ?? id;
}

function sortEdges(edges: readonly AggregatedInfluenceEdge[]): AggregatedInfluenceEdge[] {
  return [...edges].sort((a, b) => {
    if (a.strength !== b.strength) return a.strength === "strong" ? -1 : 1;
    return (b.strongCount + b.interactionCount) - (a.strongCount + a.interactionCount);
  });
}

function format(value: string, vars: Record<string, string | number>): string {
  let result = value;
  for (const [key, replacement] of Object.entries(vars)) result = result.replaceAll(`{${key}}`, String(replacement));
  return result;
}

function truncate(value: string, max: number): string {
  const clean = value.trim();
  return clean.length <= max ? clean : `${clean.slice(0, max)}…`;
}
