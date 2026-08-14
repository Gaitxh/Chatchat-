import { useMemo } from "react";
import type {
  CouncilEvent,
  CouncilParticipant,
  CouncilParticipantTurnUpdate,
  CouncilPhaseUpdate,
} from "../../core/types.js";
import type { Locale } from "../../i18n/index.js";
import { buildPeerExchangeModel, type PeerExchangeItem, type PeerExchangeState } from "../../theater/peer-exchange.js";
import "./peer-exchange-queue.css";

interface PeerExchangeQueueProps {
  participants: readonly CouncilParticipant[];
  events: readonly CouncilEvent[];
  activities: Readonly<Record<string, CouncilParticipantTurnUpdate>>;
  phase: CouncilPhaseUpdate | null;
  locale: Locale;
  onFocusEvent(eventId: string): void;
}

const COPY = {
  en: {
    eyebrow: "PEER EXCHANGE QUEUE",
    title: "Questions cannot disappear into the room",
    body: "A direct question, challenge or targeted evidence stays visible until the addressed AI publishes an explicit structured response. Similar-sounding prose does not count.",
    awaiting: "awaiting",
    responding: "responding",
    answered: "answered",
    unresolved: "unresolved at close",
    empty: "No direct peer response obligations have been published yet.",
    question: "QUESTION",
    challenge: "CHALLENGE",
    evidence: "TARGETED EVIDENCE",
    queued: "QUEUED FOR NEXT ROUND",
    working: "RESPONDING NOW",
    done: "ANSWERED",
    failed: "RESPONSE TURN FAILED",
    closed: "UNRESOLVED AT CLOSE",
    asks: "asks",
    challenges: "challenges",
    evidenceFor: "puts evidence to",
    response: "STRUCTURED RESPONSE",
    traceRequest: "trace request",
    traceResponse: "trace response",
    round: "R{round}",
    stepQueued: "Queued",
    stepTargetTurn: "Target turn",
    stepAnswered: "Answered",
    stepUnresolved: "Unresolved",
  },
  "zh-CN": {
    eyebrow: "点名回应队列",
    title: "被点名的问题不能消失在人群里",
    body: "直接追问、质疑或定向证据会一直留在这里，直到被点名的 AI 公开一个明确的结构化回应。看起来相关的普通文字不算回答。",
    awaiting: "待回应",
    responding: "正在回应",
    answered: "已回应",
    unresolved: "闭会仍未回应",
    empty: "目前还没有产生需要某个 AI 明确接住的点名事件。",
    question: "直接追问",
    challenge: "定向质疑",
    evidence: "定向证据",
    queued: "下一公开轮待回应",
    working: "正在回应",
    done: "已明确回应",
    failed: "回应轮失败",
    closed: "闭会仍未回应",
    asks: "追问",
    challenges: "质疑",
    evidenceFor: "向其观点提交证据",
    response: "结构化回应",
    traceRequest: "溯源问题",
    traceResponse: "溯源回答",
    round: "第 {round} 轮",
    stepQueued: "已排队",
    stepTargetTurn: "目标 AI 接手",
    stepAnswered: "已明确回答",
    stepUnresolved: "仍未解决",
  },
} as const;

export function PeerExchangeQueue({
  participants,
  events,
  activities,
  phase,
  locale,
  onFocusEvent,
}: PeerExchangeQueueProps) {
  const copy = COPY[locale];
  const model = useMemo(
    () => buildPeerExchangeModel(participants, events, activities, phase),
    [participants, events, activities, phase],
  );

  return (
    <section className="peer-exchange-queue">
      <header className="peer-exchange-queue__header">
        <div>
          <span>{copy.eyebrow}</span>
          <h3>{copy.title}</h3>
          <p>{copy.body}</p>
        </div>
        <div className="peer-exchange-queue__stats">
          <b data-peer-awaiting-count={model.pendingCount}>{model.pendingCount}</b><small>{copy.awaiting}</small>
          <b data-peer-responding-count={model.respondingCount}>{model.respondingCount}</b><small>{copy.responding}</small>
          <b data-peer-answered-count={model.answeredCount}>{model.answeredCount}</b><small>{copy.answered}</small>
          {model.unresolvedCount ? <><b>{model.unresolvedCount}</b><small>{copy.unresolved}</small></> : null}
        </div>
      </header>

      {model.items.length ? (
        <div className="peer-exchange-list">
          {model.items.slice(0, 8).map((item) => (
            <ExchangeCard key={item.requestEventId} item={item} locale={locale} onFocusEvent={onFocusEvent} />
          ))}
        </div>
      ) : <div className="peer-exchange-empty">{copy.empty}</div>}
    </section>
  );
}

function ExchangeCard({
  item,
  locale,
  onFocusEvent,
}: {
  item: PeerExchangeItem;
  locale: Locale;
  onFocusEvent(eventId: string): void;
}) {
  const copy = COPY[locale];
  const meta = kindMeta(item, locale);
  return (
    <article
      className={`peer-exchange-card peer-exchange-card--${item.state}`}
      data-peer-request-event={item.requestEventId}
      data-peer-response-state={item.state}
      {...(item.responseEventId ? { "data-peer-response-event": item.responseEventId } : {})}
    >
      <div className="peer-exchange-card__route">
        <span className="peer-exchange-avatar">{monogram(item.requestActorName)}</span>
        <div><strong>{item.requestActorName}</strong><small>{meta.action}</small></div>
        <b>→</b>
        <span className="peer-exchange-avatar">{monogram(item.targetActorName)}</span>
        <div><strong>{item.targetActorName}</strong><small>{statusLabel(item.state, locale)}</small></div>
        <em>{copy.round.replace("{round}", String(item.requestRound))}</em>
      </div>

      <ExchangeProgress item={item} locale={locale} />

      <div className="peer-exchange-request">
        <span>{meta.icon} {meta.label}</span>
        <p>{item.requestContent}</p>
        {item.targetExcerpt ? <q>{item.targetExcerpt}</q> : null}
        <button type="button" onClick={() => onFocusEvent(item.requestEventId)}>{copy.traceRequest} ↗</button>
      </div>

      {item.responseEventId ? (
        <div className="peer-exchange-response">
          <span>↪ {copy.response} · {item.responseKind}</span>
          <p>{item.responseExcerpt}</p>
          <button type="button" onClick={() => onFocusEvent(item.responseEventId!)}>{copy.traceResponse} ↗</button>
        </div>
      ) : (
        <div className={`peer-exchange-pulse peer-exchange-pulse--${item.state}`}>
          <i aria-hidden="true" />
          <span>{statusLabel(item.state, locale)}</span>
        </div>
      )}
    </article>
  );
}

function ExchangeProgress({ item, locale }: { item: PeerExchangeItem; locale: Locale }) {
  const copy = COPY[locale];
  const targetTurnState = item.state === "responding"
    ? "active"
    : item.state === "answered"
      ? "done"
      : item.state === "turn_failed"
        ? "failed"
        : item.state === "unresolved"
          ? "stopped"
          : "pending";
  const answerState = item.state === "answered"
    ? "done"
    : item.state === "unresolved"
      ? "failed"
      : "pending";
  return (
    <div className="peer-exchange-progress" aria-label={statusLabel(item.state, locale)}>
      <span className="is-done" data-peer-stage="queued"><i>1</i><b>{copy.stepQueued}</b><small>R{item.requestRound}</small></span>
      <em aria-hidden="true">→</em>
      <span className={`is-${targetTurnState}`} data-peer-stage="responding"><i>2</i><b>{copy.stepTargetTurn}</b><small>{item.responseRound ? `R${item.responseRound}` : "···"}</small></span>
      <em aria-hidden="true">→</em>
      <span className={`is-${answerState}`} data-peer-stage="answered"><i>3</i><b>{item.state === "unresolved" ? copy.stepUnresolved : copy.stepAnswered}</b><small>{item.responseRound ? `R${item.responseRound}` : "···"}</small></span>
    </div>
  );
}

function kindMeta(item: PeerExchangeItem, locale: Locale) {
  const copy = COPY[locale];
  if (item.requestKind === "question") return { icon: "?", label: copy.question, action: copy.asks };
  if (item.requestKind === "challenge") return { icon: "⚔", label: copy.challenge, action: copy.challenges };
  return { icon: "📎", label: copy.evidence, action: copy.evidenceFor };
}

function statusLabel(state: PeerExchangeState, locale: Locale): string {
  const copy = COPY[locale];
  if (state === "responding") return copy.working;
  if (state === "answered") return copy.done;
  if (state === "turn_failed") return copy.failed;
  if (state === "unresolved") return copy.closed;
  return copy.queued;
}

function monogram(name: string): string {
  if (/deepseek/i.test(name)) return "D";
  if (/gemini/i.test(name)) return "Gm";
  if (/claude/i.test(name)) return "C";
  if (/qwen|通义/i.test(name)) return "Q";
  if (/gpt|chatgpt/i.test(name)) return "G";
  return name.slice(0, 2).toUpperCase();
}
