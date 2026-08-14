import { useMemo } from "react";
import type { CouncilEvent, CouncilEventKind, CouncilParticipant } from "../../core/types.js";
import type { Locale } from "../../i18n/index.js";
import {
  deriveConflictBoard,
  type ConflictThread,
  type ConflictThreadStatus,
} from "../../theater/conflict-board.js";
import "./conflict-board.css";

interface ConflictBoardProps {
  participants: readonly CouncilParticipant[];
  events: readonly CouncilEvent[];
  locale: Locale;
  compact?: boolean;
  archive?: boolean;
  onFocusEvent(eventId: string): void;
}

const KIND_META: Record<CouncilEventKind, { icon: string; en: string; zh: string }> = {
  argument: { icon: "◉", en: "position", zh: "观点" },
  challenge: { icon: "⚔", en: "challenge", zh: "质疑" },
  evidence: { icon: "📎", en: "evidence", zh: "证据" },
  support: { icon: "🤝", en: "support", zh: "支持" },
  defense: { icon: "🛡", en: "defense", zh: "答辩" },
  revision: { icon: "↻", en: "revision", zh: "修正" },
  concede: { icon: "🏳", en: "concede", zh: "让步" },
  question: { icon: "?", en: "question", zh: "追问" },
  uncertain: { icon: "≈", en: "uncertain", zh: "不确定" },
  final_position: { icon: "◎", en: "final", zh: "最终" },
};

const STATUS: Record<ConflictThreadStatus, { icon: string; en: string; zh: string }> = {
  open: { icon: "!", en: "OPEN", zh: "未决" },
  position_changed: { icon: "↻", en: "POSITION CHANGED", zh: "立场已修正" },
  conceded: { icon: "🏳", en: "CONCEDED", zh: "明确让步" },
  answered: { icon: "✓", en: "ANSWERED", zh: "已明确回应" },
  active: { icon: "•", en: "ACTIVE", zh: "仍在互动" },
};

export function ConflictBoard({
  participants,
  events,
  locale,
  compact = false,
  archive = false,
  onFocusEvent,
}: ConflictBoardProps) {
  const zh = locale === "zh-CN";
  const model = useMemo(() => deriveConflictBoard(participants, events), [participants, events]);
  const visible = model.threads.slice(0, compact ? 4 : 8);
  const changed = model.threads.filter((thread) => thread.counts.revision > 0 || thread.counts.concede > 0).length;
  const open = model.threads.filter((thread) => thread.status === "open").length;

  return (
    <section
      className={`conflict-board ${compact ? "is-compact" : ""} ${archive ? "is-archive" : ""}`}
      data-conflict-board="event-provenance"
      data-conflict-thread-count={model.threads.length}
      data-conflict-open-count={open}
      data-conflict-movement-count={changed}
    >
      <header className="conflict-board__header">
        <div>
          <span>{zh ? "争议战场" : "CONFLICT BOARD"}</span>
          <h3>{zh ? "这场会到底在争什么，又有什么真的发生了变化？" : "What is actually contested — and what really moved?"}</h3>
          <p>{zh
            ? "每张卡都锚定一个真实 Blackboard 事件，并只沿 targetEventId / replyToEventId / previousEventId 等结构化引用连线。不会用文本相似度，也不会让隐藏主持人 AI 自己发明议题。"
            : "Every card is anchored to a real Blackboard event and connected only by structured references such as targetEventId, replyToEventId and previousEventId. No prose clustering and no hidden chair invents the issues."}</p>
        </div>
        <div className="conflict-board__summary">
          <b>{model.threads.length}<small>{zh ? "线程" : "threads"}</small></b>
          <b>{open}<small>{zh ? "未决" : "open"}</small></b>
          <b>{changed}<small>{zh ? "发生改变" : "moved"}</small></b>
        </div>
      </header>

      {archive ? (
        <div className="conflict-board__archive-note">↺ {zh ? "历史回放：只读取冻结事件图，不调用 Provider。" : "Archive replay: frozen event graph only; no Provider calls."}</div>
      ) : null}

      {visible.length ? (
        <div className="conflict-thread-list">
          {visible.map((thread, index) => (
            <ConflictThreadCard
              key={thread.id}
              thread={thread}
              index={index}
              zh={zh}
              compact={compact}
              onFocusEvent={onFocusEvent}
            />
          ))}
        </div>
      ) : (
        <div className="conflict-board__empty">
          <b>⌁</b>
          <strong>{zh ? "还没有可追溯的争议线程" : "No traceable conflict thread yet"}</strong>
          <p>{zh
            ? "独立观点本身不会被 ChatChat 自动贴成“冲突”。等质疑、证据、直接回应或明确不确定性进入 Blackboard 后，这里才会出现线程。"
            : "Independent positions are not automatically labeled as conflict. A thread appears only after challenge, evidence, direct response or explicit uncertainty creates traceable structure."}</p>
        </div>
      )}

      {model.threads.length > visible.length ? (
        <small className="conflict-board__more">+{model.threads.length - visible.length} {zh ? "条线程仍保留在事件图中" : "more threads retained in the event graph"}</small>
      ) : null}
    </section>
  );
}

function ConflictThreadCard({
  thread,
  index,
  zh,
  compact,
  onFocusEvent,
}: {
  thread: ConflictThread;
  index: number;
  zh: boolean;
  compact: boolean;
  onFocusEvent(eventId: string): void;
}) {
  const status = STATUS[thread.status];
  const activity = thread.activities.slice(-(compact ? 4 : 6));
  const movement = thread.counts.revision > 0 ? "revision" : thread.counts.concede > 0 ? "concede" : "none";
  return (
    <article
      className={`conflict-thread status-${thread.status}`}
      data-conflict-thread={thread.id}
      data-conflict-anchor-event={thread.anchorEventId}
      data-conflict-status={thread.status}
      data-conflict-movement={movement}
      data-conflict-open-issues={thread.openIssueIds.length}
    >
      <div className="conflict-thread__top">
        <b className="conflict-thread__number">{String(index + 1).padStart(2, "0")}</b>
        <div className="conflict-thread__anchor">
          <span>{zh ? "事件锚点" : "EVENT ANCHOR"} · {thread.anchorActorName} · R{thread.anchorRound}</span>
          {thread.anchorStance ? <strong>{thread.anchorStance}</strong> : <strong>{KIND_META[thread.anchorKind][zh ? "zh" : "en"]}</strong>}
        </div>
        <div className="conflict-thread__badges">
          <div className={`conflict-thread__status status-${thread.status}`}>
            <i>{status.icon}</i>{zh ? status.zh : status.en}
          </div>
          {movement !== "none" ? (
            <small className={`conflict-thread__movement movement-${movement}`}>
              {movement === "revision" ? "↻" : "🏳"} {movement === "revision"
                ? (zh ? `${thread.counts.revision} 次修正` : `${thread.counts.revision} revision${thread.counts.revision === 1 ? "" : "s"}`)
                : (zh ? `${thread.counts.concede} 次让步` : `${thread.counts.concede} concession${thread.counts.concede === 1 ? "" : "s"}`)}
            </small>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        className="conflict-thread__claim"
        onClick={() => onFocusEvent(thread.anchorEventId)}
        data-conflict-trace-anchor={thread.anchorEventId}
      >
        <span>{KIND_META[thread.anchorKind].icon}</span>
        <p>{thread.anchorExcerpt}</p>
        <i>↗</i>
      </button>

      <div className="conflict-thread__participants">
        {thread.participantNames.map((name) => <span key={name}>{name}</span>)}
      </div>

      <ThreadMetrics thread={thread} zh={zh} />

      {activity.length ? (
        <div className="conflict-thread__timeline">
          {activity.map((item) => {
            const meta = KIND_META[item.kind];
            return (
              <button
                type="button"
                key={item.eventId}
                data-conflict-event={item.eventId}
                data-conflict-event-kind={item.kind}
                onClick={() => onFocusEvent(item.eventId)}
              >
                <b>{meta.icon}</b>
                <div>
                  <span>R{item.round} · {item.actorName} · {zh ? meta.zh : meta.en}</span>
                  <p>{item.excerpt}</p>
                </div>
                <i>↗</i>
              </button>
            );
          })}
        </div>
      ) : null}

      {thread.openIssueEventIds.length ? (
        <div className="conflict-thread__open">
          <span>! {zh ? `${thread.openIssueEventIds.length} 项仍未明确回应` : `${thread.openIssueEventIds.length} item${thread.openIssueEventIds.length === 1 ? "" : "s"} still await explicit response`}</span>
          {thread.openIssueEventIds.slice(0, 3).map((eventId) => (
            <button key={eventId} type="button" data-conflict-open-event={eventId} onClick={() => onFocusEvent(eventId)}>{zh ? "查看未决事件" : "Trace open event"} ↗</button>
          ))}
        </div>
      ) : null}

      {thread.externalInfluences.length ? (
        <div className="conflict-thread__external">
          <span>⌁ {zh ? "跨线程改变来源" : "CROSS-THREAD INFLUENCE"}</span>
          {thread.externalInfluences.slice(0, 2).map((item) => (
            <button key={`${item.causeEventId}:${item.revisionEventId}`} type="button" data-conflict-external-cause={item.causeEventId} onClick={() => onFocusEvent(item.causeEventId)}>
              {item.actorName} → {zh ? "修正" : "revision"} · {shortId(item.causeEventId)} ↗
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function ThreadMetrics({ thread, zh }: { thread: ConflictThread; zh: boolean }) {
  const items: Array<[keyof ConflictThread["counts"], string, string, string]> = [
    ["challenge", "⚔", "challenge", "质疑"],
    ["evidence", "📎", "evidence", "证据"],
    ["support", "🤝", "support", "支持"],
    ["question", "?", "question", "追问"],
    ["reply", "↪", "reply", "直答"],
    ["defense", "🛡", "defense", "答辩"],
    ["revision", "↻", "revision", "修正"],
    ["concede", "🏳", "concede", "让步"],
  ];
  const visible = items.filter(([key]) => thread.counts[key] > 0);
  return (
    <div className="conflict-thread__metrics">
      {visible.map(([key, icon, en, zhLabel]) => (
        <span key={key} data-conflict-count-kind={key} data-conflict-count={thread.counts[key]}>{icon} {thread.counts[key]} {zh ? zhLabel : en}</span>
      ))}
    </div>
  );
}

function shortId(value: string): string {
  return value.length <= 16 ? value : `${value.slice(0, 7)}…${value.slice(-5)}`;
}
