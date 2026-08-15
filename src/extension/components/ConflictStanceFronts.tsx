import { useMemo } from "react";
import type { CouncilEvent } from "../../core/types.js";
import type { ConflictThread } from "../../theater/conflict-board.js";
import {
  deriveConflictStanceFronts,
  type ExplicitStanceFront,
} from "../../theater/stance-fronts.js";
import "./conflict-stance-fronts.css";

interface ConflictStanceFrontsProps {
  thread: ConflictThread;
  events: readonly CouncilEvent[];
  zh: boolean;
  compact?: boolean;
  onFocusEvent(eventId: string): void;
}

export function ConflictStanceFrontsPanel({
  thread,
  events,
  zh,
  compact = false,
  onFocusEvent,
}: ConflictStanceFrontsProps) {
  const model = useMemo(() => deriveConflictStanceFronts(thread, events), [thread, events]);
  if (!model.fronts.length && !model.movements.length) return null;

  const visibleFronts = model.fronts.slice(0, compact ? 3 : 5);
  const currentCount = model.fronts.filter((front) => front.state === "current").length;
  return (
    <section
      className={`conflict-stance-fronts ${compact ? "is-compact" : ""}`}
      data-conflict-stance-fronts={thread.id}
      data-stance-current-front-count={currentCount}
      data-stance-movement-count={model.movements.length}
      data-stance-uncommitted-count={model.uncommittedActorIds.length}
    >
      <header>
        <div>
          <span>{zh ? "明示立场战线" : "EXPLICIT STANCE FRONTS"}</span>
          <strong>{zh ? "谁真的表过态，谁只是参与了攻防？" : "Who actually declared a stance — and who only joined the pressure?"}</strong>
        </div>
        <small>{currentCount} {zh ? "条当前战线" : "current"}</small>
      </header>

      <p className="stance-fronts__rule">{zh
        ? "只使用参与者自己公开提交的 stance / revision。质疑、举证或支持不会被 ChatChat 偷偷推断成一个阵营。"
        : "Only participant-authored stance/revision events create a front. Challenge, evidence or support never silently assigns somebody to a camp."}</p>

      <div className="stance-fronts__grid">
        {visibleFronts.map((front) => (
          <StanceFrontCard key={front.id} front={front} zh={zh} onFocusEvent={onFocusEvent} />
        ))}
      </div>

      {model.movements.length ? (
        <div className="stance-movement-list">
          <span>{zh ? "明确换边 / 修正" : "EXPLICIT MOVEMENT"}</span>
          {model.movements.slice(-(compact ? 2 : 4)).map((movement) => (
            <article
              key={movement.revisionEventId}
              data-stance-movement-event={movement.revisionEventId}
              data-stance-movement-from={movement.fromStance}
              data-stance-movement-to={movement.toStance}
            >
              <button type="button" onClick={() => onFocusEvent(movement.revisionEventId)}>
                <b>↻ {movement.actorName}</b>
                <span>R{movement.round}</span>
                <p>{movement.fromStance} <i>→</i> {movement.toStance}</p>
              </button>
              {movement.causedByEventIds.length ? (
                <div>
                  <small>{zh ? "结构化原因" : "structured causes"}</small>
                  {movement.causedByEventIds.slice(0, 3).map((eventId) => (
                    <button key={eventId} type="button" data-stance-movement-cause={eventId} onClick={() => onFocusEvent(eventId)}>{shortId(eventId)} ↗</button>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}

      {model.uncommittedActorNames.length ? (
        <div className="stance-uncommitted" data-stance-uncommitted="explicit-none">
          <span>{zh ? "参与攻防，但没有在这条线程里明示 stance" : "Engaged here without an explicit stance"}</span>
          <div>{model.uncommittedActorNames.map((name) => <i key={name}>{name}</i>)}</div>
        </div>
      ) : null}
    </section>
  );
}

function StanceFrontCard({
  front,
  zh,
  onFocusEvent,
}: {
  front: ExplicitStanceFront;
  zh: boolean;
  onFocusEvent(eventId: string): void;
}) {
  const members = front.state === "current" ? front.currentMembers : front.formerMembers;
  return (
    <article
      className={`stance-front state-${front.state}`}
      data-stance-front={front.id}
      data-stance-front-state={front.state}
      data-stance-front-label={front.stance}
      data-stance-front-current-members={front.currentMembers.length}
    >
      <div className="stance-front__top">
        <strong>{front.stance}</strong>
        <span>{front.state === "current" ? (zh ? "当前" : "CURRENT") : (zh ? "已离开" : "VACATED")}</span>
      </div>
      <div className="stance-front__members">
        {members.map((member) => (
          <button key={`${member.actorId}:${member.eventId}`} type="button" data-stance-member-event={member.eventId} onClick={() => onFocusEvent(member.eventId)}>
            <b>{member.actorName}</b><small>R{member.round} · {Math.round(member.confidence * 100)}%</small>
          </button>
        ))}
      </div>
      <div className="stance-front__pressure">
        {front.challengeEventIds.length ? <span data-stance-pressure="challenge">⚔ {front.challengeEventIds.length} {zh ? "质疑" : "challenge"}</span> : null}
        {front.evidenceEventIds.length ? <span data-stance-pressure="evidence">📎 {front.evidenceEventIds.length} {zh ? "定向证据" : "evidence"}</span> : null}
        {front.supportEventIds.length ? <span data-stance-pressure="support">🤝 {front.supportEventIds.length} {zh ? "明确支持" : "support"}</span> : null}
        {front.unresolvedTargetEventIds.length ? <span data-stance-pressure="open">! {front.unresolvedTargetEventIds.length} {zh ? "待回应" : "open"}</span> : null}
      </div>
    </article>
  );
}

function shortId(value: string): string {
  return value.length <= 16 ? value : `${value.slice(0, 7)}…${value.slice(-5)}`;
}
