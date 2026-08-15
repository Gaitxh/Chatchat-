import { useMemo } from "react";
import type { CouncilEvent, CouncilParticipant } from "../../core/types.js";
import type { Locale } from "../../i18n/index.js";
import { deriveConflictBoard } from "../../theater/conflict-board.js";
import {
  deriveConflictResolutionLedger,
  type ConflictObligationResolution,
  type ConflictThreadResolution,
} from "../../theater/conflict-resolution.js";
import "./conflict-resolution-ledger.css";

interface ConflictResolutionLedgerProps {
  participants: readonly CouncilParticipant[];
  events: readonly CouncilEvent[];
  locale: Locale;
  compact?: boolean;
  onFocusEvent(eventId: string): void;
}

const ISSUE_LABEL = {
  open_question: { en: "question", zh: "追问" },
  challenged_claim: { en: "challenge", zh: "质疑" },
  evidence_awaiting_response: { en: "evidence", zh: "证据回应" },
  explicit_uncertainty: { en: "uncertainty", zh: "明确不确定" },
} as const;

export function ConflictResolutionLedgerPanel({
  participants,
  events,
  locale,
  compact = false,
  onFocusEvent,
}: ConflictResolutionLedgerProps) {
  const zh = locale === "zh-CN";
  const view = useMemo(() => {
    const board = deriveConflictBoard(participants, events);
    return { board, ledger: deriveConflictResolutionLedger(participants, events, board) };
  }, [participants, events]);
  const visible = view.ledger.threads
    .filter((thread) => thread.openedCount > 0)
    .slice(0, compact ? 3 : 6);

  if (!view.ledger.openedCount) return null;

  return (
    <section
      className={`conflict-resolution-ledger ${compact ? "is-compact" : ""}`}
      data-conflict-resolution-ledger="exact-provenance"
      data-conflict-obligations-opened={view.ledger.openedCount}
      data-conflict-obligations-resolved={view.ledger.resolvedCount}
      data-conflict-obligations-open={view.ledger.openCount}
    >
      <header>
        <div>
          <span>{zh ? "争议解决账本" : "CONFLICT RESOLUTION LEDGER"}</span>
          <strong>{zh ? "哪些问题真的被接住了？" : "Which obligations were actually closed?"}</strong>
          <p>{zh
            ? "只有精确结构化回应才会产生 closure receipt。普通 prose、第三方替答或相似措辞不会自动把争议标成已解决。"
            : "Only exact structured response provenance creates a closure receipt. Similar prose, third-party answers or vague follow-up never auto-resolve a conflict."}</p>
        </div>
        <div className="conflict-resolution-ledger__totals">
          <b>{view.ledger.openedCount}<small>{zh ? "曾打开" : "opened"}</small></b>
          <b>{view.ledger.resolvedCount}<small>{zh ? "已关闭" : "resolved"}</small></b>
          <b>{view.ledger.openCount}<small>{zh ? "仍未决" : "still open"}</small></b>
        </div>
      </header>

      <div className="conflict-resolution-ledger__threads">
        {visible.map((resolution) => {
          const thread = view.board.threads.find((item) => item.id === resolution.threadId);
          if (!thread) return null;
          return (
            <ThreadResolution
              key={resolution.threadId}
              resolution={resolution}
              title={thread.anchorStance ?? thread.anchorExcerpt}
              zh={zh}
              compact={compact}
              onFocusEvent={onFocusEvent}
            />
          );
        })}
      </div>
    </section>
  );
}

function ThreadResolution({
  resolution,
  title,
  zh,
  compact,
  onFocusEvent,
}: {
  resolution: ConflictThreadResolution;
  title: string;
  zh: boolean;
  compact: boolean;
  onFocusEvent(eventId: string): void;
}) {
  const obligations = resolution.obligations
    .slice()
    .sort((a, b) => Number(a.state === "open") - Number(b.state === "open") || b.openedRound - a.openedRound)
    .reverse()
    .slice(0, compact ? 2 : 5);
  const rounds = resolution.trajectory.slice(-(compact ? 4 : 7));

  return (
    <article
      className={`conflict-resolution-thread ${resolution.openCount ? "has-open" : "is-closed"}`}
      data-conflict-resolution-thread={resolution.threadId}
      data-conflict-resolution-open={resolution.openCount}
      data-conflict-resolution-resolved={resolution.resolvedCount}
    >
      <div className="conflict-resolution-thread__head">
        <div>
          <span>{zh ? "线程" : "THREAD"}</span>
          <strong>{title}</strong>
        </div>
        <div>
          <b>✓ {resolution.resolvedCount}</b>
          <b className={resolution.openCount ? "has-open" : ""}>! {resolution.openCount}</b>
        </div>
      </div>

      <div className="conflict-trajectory" aria-label={zh ? "争议轮次轨迹" : "Conflict round trajectory"}>
        {rounds.map((round) => (
          <button
            type="button"
            key={round.round}
            data-conflict-trajectory-round={round.round}
            data-conflict-trajectory-opened={round.openedCount}
            data-conflict-trajectory-resolved={round.resolvedCount}
            data-conflict-trajectory-open-at-end={round.openAtEnd}
            data-conflict-trajectory-movement={round.movementCount}
            onClick={() => {
              const eventId = round.movementEventIds[0] ?? round.resolvedByEventIds[0] ?? round.openedEventIds[0] ?? round.eventIds[0];
              if (eventId) onFocusEvent(eventId);
            }}
          >
            <span>R{round.round}</span>
            <strong>
              {round.openedCount ? `+${round.openedCount}` : ""}
              {round.resolvedCount ? ` ✓${round.resolvedCount}` : ""}
              {round.movementCount ? ` ↻${round.movementCount}` : ""}
            </strong>
            <small>{round.openAtEnd ? `!${round.openAtEnd}` : "✓"}</small>
          </button>
        ))}
      </div>

      <div className="conflict-closure-list">
        {obligations.map((item) => (
          <ClosureReceipt key={item.id} item={item} zh={zh} onFocusEvent={onFocusEvent} />
        ))}
      </div>
    </article>
  );
}

function ClosureReceipt({
  item,
  zh,
  onFocusEvent,
}: {
  item: ConflictObligationResolution;
  zh: boolean;
  onFocusEvent(eventId: string): void;
}) {
  const label = ISSUE_LABEL[item.kind][zh ? "zh" : "en"];
  const resolved = item.state === "resolved";
  return (
    <div
      className={`conflict-closure-receipt state-${item.state}`}
      data-conflict-obligation={item.sourceEventId}
      data-conflict-obligation-kind={item.kind}
      data-conflict-obligation-state={item.state}
      {...(item.resolvedByEventId ? { "data-conflict-resolved-by-event": item.resolvedByEventId } : {})}
    >
      <button type="button" onClick={() => onFocusEvent(item.sourceEventId)}>
        <span>{resolved ? "✓" : "!"} {label} · R{item.openedRound}</span>
        <strong>{item.sourceActorName}{item.targetActorName ? ` → ${item.targetActorName}` : ""}</strong>
        <i>↗</i>
      </button>
      {resolved && item.resolvedByEventId ? (
        <button
          type="button"
          className="conflict-closure-receipt__resolver"
          onClick={() => onFocusEvent(item.resolvedByEventId!)}
        >
          <span>{zh ? "关闭于" : "CLOSED BY"} · R{item.resolvedRound}</span>
          <strong>{item.resolverActorName}</strong>
          <code>{shortId(item.resolvedByEventId)}</code>
          <i>↗</i>
        </button>
      ) : (
        <div className="conflict-closure-receipt__open">
          {zh ? "仍等待精确结构化回应" : "Still awaiting exact structured response"}
        </div>
      )}
    </div>
  );
}

function shortId(value: string): string {
  return value.length <= 18 ? value : `${value.slice(0, 8)}…${value.slice(-6)}`;
}
