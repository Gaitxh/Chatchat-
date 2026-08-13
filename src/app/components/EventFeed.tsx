import type { CouncilEvent, CouncilParticipant } from "../../core/types.js";
import {
  confidencePercent,
  eventPresentation,
  eventTargetName,
  eventText,
} from "../council-view.js";
import type { CouncilUiStage } from "../useCouncilSession.js";

interface EventFeedProps {
  events: readonly CouncilEvent[];
  participants: readonly CouncilParticipant[];
  stage: CouncilUiStage;
}

export function EventFeed({ events, participants, stage }: EventFeedProps) {
  const visibleEvents = stage === "sealed" ? [] : events;

  return (
    <aside className="blackboard-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-kicker">PUBLIC BLACKBOARD</span>
          <h2>议政板</h2>
        </div>
        <span className="event-counter">{events.length}</span>
      </div>

      {stage === "sealed" ? (
        <div className="sealed-notice">
          <span className="wax-seal">●</span>
          <strong>奏议仍在封存</strong>
          <p>
            Round 1 的答案已经陆续完成，但在所有智囊完成以前，不会进入公共议政板。
          </p>
          <small>{events.length} 封私人奏议已准备</small>
        </div>
      ) : visibleEvents.length === 0 ? (
        <div className="empty-board">
          <span>⌁</span>
          <p>开廷后，challenge / evidence / revision 会出现在这里。</p>
        </div>
      ) : (
        <div className="event-stream" aria-live="polite">
          {visibleEvents.map((event) => {
            const actor =
              participants.find(
                (participant) => participant.id === event.actorId,
              )?.name ?? event.actorId;
            const target = eventTargetName(event, events, participants);
            const presentation = eventPresentation[event.kind];
            const confidence =
              "confidence" in event
                ? confidencePercent(event.confidence)
                : null;

            return (
              <article
                id={`council-event-${event.id}`}
                data-event-id={event.id}
                className={`event-card event-${event.kind}`}
                key={event.id}
              >
                <header>
                  <span className="event-icon">{presentation.icon}</span>
                  <div>
                    <strong>{actor}</strong>
                    <span>
                      {presentation.label}
                      {target ? ` → ${target}` : ""}
                    </span>
                  </div>
                  <small>R{event.round}</small>
                </header>
                <p>{eventText(event)}</p>
                {event.kind === "revision" ? (
                  <div className="revision-banner">
                    CHANGED MIND → <strong>{event.stance}</strong>
                  </div>
                ) : null}
                {event.kind === "evidence" && event.source ? (
                  <div className="evidence-source">
                    Source: {event.source}
                    {event.sourceDate ? ` · ${event.sourceDate}` : ""}
                  </div>
                ) : null}
                {confidence ? (
                  <footer>confidence {confidence}</footer>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </aside>
  );
}
