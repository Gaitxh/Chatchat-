import { useEffect, useMemo } from "react";
import type {
  CouncilEvent,
  CouncilParticipant,
  CouncilParticipantTurnUpdate,
  CouncilPhaseUpdate,
} from "../../core/types.js";
import type { Locale } from "../../i18n/index.js";
import {
  buildPeerExchangeModel,
  type PeerExchangeItem,
  type PeerExchangeState,
} from "../../theater/peer-exchange.js";
import "./live-response-rail.css";

interface LiveResponseRailProps {
  participants: readonly CouncilParticipant[];
  events: readonly CouncilEvent[];
  activities: Readonly<Record<string, CouncilParticipantTurnUpdate>>;
  phase: CouncilPhaseUpdate | null;
  locale: Locale;
  onFocusEvent(eventId: string): void;
}

const LIVE_RESPONSE_ROUTE_EVENT = "chatchat:live-response-route";

const COPY = {
  en: {
    label: "LIVE RESPONSE",
    queued: "awaiting response",
    responding: "responding now",
    answered: "answered",
    failed: "response turn failed",
    unresolved: "unanswered at close",
    pending: "pending",
    active: "responding",
    done: "answered",
    duty: "Response duty ≠ agreement duty",
    question: "question",
    challenge: "challenge",
    evidence: "targeted evidence",
  },
  "zh-CN": {
    label: "实时答辩",
    queued: "等待回应",
    responding: "正在回应",
    answered: "已回应",
    failed: "回应轮失败",
    unresolved: "闭会仍未回应",
    pending: "待回应",
    active: "正在回应",
    done: "已回应",
    duty: "回应义务 ≠ 同意义务",
    question: "追问",
    challenge: "质询",
    evidence: "定向证据",
  },
} as const;

export function LiveResponseRail({
  participants,
  events,
  activities,
  phase,
  locale,
  onFocusEvent,
}: LiveResponseRailProps) {
  const model = useMemo(
    () => buildPeerExchangeModel(participants, events, activities, phase),
    [participants, events, activities, phase],
  );
  const item = model.items[0];

  useEffect(() => {
    if (!item || (item.state !== "queued" && item.state !== "responding")) return;
    // Read-only presentation receipt. It carries no prompt/response prose and
    // cannot drive the meeting; consumers may only observe a route that the
    // canonical Peer Exchange model already committed to the live DOM.
    window.dispatchEvent(new CustomEvent(LIVE_RESPONSE_ROUTE_EVENT, {
      detail: {
        state: item.state,
        requestEventId: item.requestEventId,
        requestRound: item.requestRound,
        targetActorId: item.targetActorId,
      },
    }));
  }, [item?.requestEventId, item?.requestRound, item?.state, item?.targetActorId]);

  if (!item) return null;
  const copy = COPY[locale];

  return (
    <section
      className={`live-response-rail state-${item.state}`}
      data-live-response-rail="canonical-peer-exchange"
      data-live-response-state={item.state}
      data-live-response-request-event={item.requestEventId}
      data-live-response-request-round={item.requestRound}
      data-live-response-target-actor={item.targetActorId}
      data-live-response-pending-count={model.pendingCount}
      data-live-response-responding-count={model.respondingCount}
      data-live-response-answered-count={model.answeredCount}
      {...(item.responseEventId ? { "data-live-response-event": item.responseEventId } : {})}
    >
      <div className="live-response-rail__label">
        <span>{kindIcon(item)}</span>
        <div><b>{copy.label}</b><small>{copy.duty}</small></div>
      </div>

      <button
        type="button"
        className="live-response-rail__route"
        onClick={() => onFocusEvent(item.requestEventId)}
        aria-label={`${item.requestActorName} → ${item.targetActorName}: ${stateLabel(item.state, locale)}`}
      >
        <strong>{item.requestActorName}</strong>
        <i aria-hidden="true">→</i>
        <strong>{item.targetActorName}</strong>
        <small>{kindLabel(item, locale)} · R{item.requestRound}</small>
      </button>

      <div className={`live-response-rail__status state-${item.state}`}>
        <i aria-hidden="true" />
        <b>{stateLabel(item.state, locale)}</b>
      </div>

      <div className="live-response-rail__counts" aria-label={copy.label}>
        <span><b>{model.pendingCount}</b><small>{copy.pending}</small></span>
        <span><b>{model.respondingCount}</b><small>{copy.active}</small></span>
        <span><b>{model.answeredCount}</b><small>{copy.done}</small></span>
      </div>
    </section>
  );
}

function stateLabel(state: PeerExchangeState, locale: Locale): string {
  const copy = COPY[locale];
  if (state === "responding") return copy.responding;
  if (state === "answered") return copy.answered;
  if (state === "turn_failed") return copy.failed;
  if (state === "unresolved") return copy.unresolved;
  return copy.queued;
}

function kindIcon(item: PeerExchangeItem): string {
  if (item.requestKind === "challenge") return "⚔";
  if (item.requestKind === "evidence") return "📎";
  return "?";
}

function kindLabel(item: PeerExchangeItem, locale: Locale): string {
  const copy = COPY[locale];
  if (item.requestKind === "challenge") return copy.challenge;
  if (item.requestKind === "evidence") return copy.evidence;
  return copy.question;
}
