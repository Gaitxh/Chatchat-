import { StrictMode, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { CouncilOrchestrator } from "../core/orchestrator.js";
import type {
  CouncilEvent,
  CouncilParticipant,
  CouncilParticipantTurnUpdate,
  CouncilPhaseUpdate,
  CouncilReport,
  CouncilRunOptions,
} from "../core/types.js";
import type { ConsultationArchive } from "../history/consultation-history.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import { ConsultationTheater } from "./components/ConsultationTheater.js";
import { LiveDiscussionStream } from "./components/LiveDiscussionStream.js";
import { LiveMoments } from "./components/LiveMoments.js";
import { LiveParticipantFloor } from "./components/LiveParticipantFloor.js";
import { LiveResearchDesk } from "./components/LiveResearchDesk.js";
import { RelationshipMap } from "./components/RelationshipMap.js";
import { ResearchRoster } from "./components/ResearchRoster.js";
import {
  CONSULTATION_FOCUS_EVENT,
  type ConsultationFocusDetail,
} from "./provenance-wire.js";
import "./consultation-theater-portal.css";

const LIVE_EVENT = "chatchat:consultation-live";
const COMPLETE_EVENT = "chatchat:consultation-complete";
const OPEN_ARCHIVE_EVENT = "chatchat:consultation-open-archive";
const PATCH_MARKER = "__chatchatConsultationTheaterObserverV4" as const;

interface ConsultationLiveDetail {
  participants: CouncilParticipant[];
  events: CouncilEvent[];
  phase: CouncilPhaseUpdate | null;
  activities: Record<string, CouncilParticipantTurnUpdate>;
}

interface ConsultationCompletionDetail {
  report: CouncilReport;
  events: CouncilEvent[];
}

interface OpenArchiveDetail {
  archive: ConsultationArchive;
}

type ObservablePrototype = typeof CouncilOrchestrator.prototype & {
  [PATCH_MARKER]?: true;
};

installReadOnlyObserver();

function ConsultationTheaterPortal() {
  const [live, setLive] = useState<ConsultationLiveDetail | null>(null);
  const [completion, setCompletion] = useState<ConsultationCompletionDetail | null>(null);
  const [archiveMode, setArchiveMode] = useState(false);
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    const onLive = (event: Event) => {
      const detail = (event as CustomEvent<ConsultationLiveDetail>).detail;
      if (!Array.isArray(detail?.participants) || !Array.isArray(detail?.events)) return;
      setLive({
        participants: [...detail.participants],
        events: [...detail.events],
        phase: detail.phase ? { ...detail.phase } : null,
        activities: cloneActivities(detail.activities),
      });
      setCompletion(null);
      setArchiveMode(false);
    };
    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<ConsultationCompletionDetail>).detail;
      if (!detail?.report || !Array.isArray(detail.events)) return;
      setCompletion({ report: detail.report, events: [...detail.events] });
      setArchiveMode(false);
      setSelectedEventId(null);
    };
    const onArchive = (event: Event) => {
      const detail = (event as CustomEvent<OpenArchiveDetail>).detail;
      const archive = detail?.archive;
      if (!archive?.report || !Array.isArray(archive.events)) return;
      setLive(null);
      setCompletion({ report: archive.report, events: [...archive.events] });
      setArchiveMode(true);
      setSelectedEventId(null);
    };
    const onFocus = (event: Event) => {
      const detail = (event as CustomEvent<ConsultationFocusDetail>).detail;
      if (!detail?.eventId) return;
      setSelectedEventId(detail.eventId);
      window.setTimeout(() => {
        document.querySelector(".event-provenance")?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      }, 0);
    };
    window.addEventListener(LIVE_EVENT, onLive);
    window.addEventListener(COMPLETE_EVENT, onComplete);
    window.addEventListener(OPEN_ARCHIVE_EVENT, onArchive);
    window.addEventListener(CONSULTATION_FOCUS_EVENT, onFocus);
    return () => {
      window.removeEventListener(LIVE_EVENT, onLive);
      window.removeEventListener(COMPLETE_EVENT, onComplete);
      window.removeEventListener(OPEN_ARCHIVE_EVENT, onArchive);
      window.removeEventListener(CONSULTATION_FOCUS_EVENT, onFocus);
    };
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setLocale(normalizeLocale(document.documentElement.lang));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const researchRosterRoot = document.getElementById("research-roster-root");
    const app = document.querySelector(".consultation-app");
    if (!(researchRosterRoot instanceof HTMLElement) || !(app instanceof HTMLElement)) return;
    const board = app.querySelector(".shared-board-card");
    const liveRoom = app.querySelector(".live-room-card");
    if (board?.parentElement === app) {
      app.insertBefore(researchRosterRoot, board);
    } else if (liveRoom?.parentElement === app) {
      liveRoom.insertAdjacentElement("afterend", researchRosterRoot);
    } else {
      app.append(researchRosterRoot);
    }
    researchRosterRoot.hidden = !completion?.report.researchLaneAssignments;
  }, [completion]);

  useEffect(() => {
    const theaterRoot = document.getElementById("consultation-theater-root");
    if (!theaterRoot) return;

    if (completion) {
      const setup = document.querySelector(".consultation-app .setup-card");
      const app = setup?.parentElement ?? document.querySelector(".consultation-app");
      if (!app) return;
      if (setup) app.insertBefore(theaterRoot, setup);
      else app.append(theaterRoot);
      return;
    }

    if (live) {
      const liveRoom = document.querySelector(".consultation-app .live-room-card");
      if (liveRoom && theaterRoot.parentElement !== liveRoom) liveRoom.append(theaterRoot);
    }
  }, [completion, live]);

  const selectedEvent = useMemo(() => {
    const availableEvents = completion?.events ?? live?.events ?? [];
    return availableEvents.find((event) => event.id === selectedEventId) ?? null;
  }, [completion, live, selectedEventId]);

  if (!completion && !live) return null;

  if (!completion && live) {
    const liveParticipants = live.participants.map((participant) => ({
      id: participant.id,
      name: participant.name,
    }));
    return (
      <div className="consultation-theater-portal">
        <LiveParticipantFloor
          participants={live.participants}
          events={live.events}
          phase={live.phase}
          activities={live.activities}
          locale={locale}
        />
        <LiveResearchDesk
          participants={live.participants}
          events={live.events}
          activities={live.activities}
          locale={locale}
          onFocusEvent={setSelectedEventId}
        />
        <LiveDiscussionStream
          participants={live.participants}
          events={live.events}
          phase={live.phase}
          locale={locale}
          onFocusEvent={setSelectedEventId}
        />
        {live.events.length ? (
          <LiveMoments
            participants={liveParticipants}
            events={live.events}
            locale={locale}
          />
        ) : null}
        {live.events.length ? (
          <RelationshipMap
            participants={liveParticipants}
            events={live.events}
            locale={locale}
          />
        ) : null}
        {selectedEvent ? (
          <EventProvenanceDetail
            event={selectedEvent}
            participants={live.participants}
            locale={locale}
            onClose={() => setSelectedEventId(null)}
          />
        ) : null}
      </div>
    );
  }

  if (!completion) return null;
  const participants = completion.report.positions.map((position) => position.participant);
  const researchRosterRoot = document.getElementById("research-roster-root");
  return (
    <div className="consultation-theater-portal">
      {researchRosterRoot && completion.report.researchLaneAssignments
        ? createPortal(
            <ResearchRoster
              participants={participants}
              assignments={completion.report.researchLaneAssignments}
              locale={locale}
            />,
            researchRosterRoot,
          )
        : null}
      {archiveMode ? (
        <div className="archive-replay-banner">
          <b>↺ {locale === "zh-CN" ? "历史回放" : "ARCHIVE REPLAY"}</b>
          <span>{locale === "zh-CN" ? "只读取本地保存的事件，不会重新调用任何 AI。" : "Reads saved local events only. No AI provider is called again."}</span>
        </div>
      ) : null}
      <ConsultationTheater
        participants={participants}
        events={completion.events}
        report={completion.report}
        locale={locale}
        onFocusEvent={setSelectedEventId}
      />
      {selectedEvent ? (
        <EventProvenanceDetail
          event={selectedEvent}
          participants={participants}
          locale={locale}
          onClose={() => setSelectedEventId(null)}
        />
      ) : null}
    </div>
  );
}

function EventProvenanceDetail({
  event,
  participants,
  locale,
  onClose,
}: {
  event: CouncilEvent;
  participants: readonly CouncilParticipant[];
  locale: Locale;
  onClose(): void;
}) {
  const participant = participants.find((item) => item.id === event.actorId);
  const copy = locale === "zh-CN"
    ? {
        eyebrow: "原始事件",
        title: "可追溯事件详情",
        actor: "参与者",
        kind: "事件类型",
        round: "轮次",
        id: "事件 ID",
        target: "引用 / 目标",
        close: "关闭",
        revision: "这条修正的结构化原因",
      }
    : {
        eyebrow: "SOURCE EVENT",
        title: "Traceable event detail",
        actor: "Participant",
        kind: "Event kind",
        round: "Round",
        id: "Event ID",
        target: "Reference / target",
        close: "Close",
        revision: "Structured causes for this revision",
      };
  const refs = eventReferences(event);

  return (
    <aside className="event-provenance" role="dialog" aria-label={copy.title}>
      <div className="event-provenance__top">
        <div><span>{copy.eyebrow}</span><strong>{copy.title}</strong></div>
        <button type="button" onClick={onClose}>×</button>
      </div>
      <dl>
        <div><dt>{copy.actor}</dt><dd>{participant?.name ?? event.actorId}</dd></div>
        <div><dt>{copy.kind}</dt><dd><code>{event.kind}</code></dd></div>
        <div><dt>{copy.round}</dt><dd>{event.round}</dd></div>
        <div><dt>{copy.id}</dt><dd><code>{event.id}</code></dd></div>
      </dl>
      <p>{event.content}</p>
      {refs.length ? (
        <div className="event-provenance__refs">
          <span>{event.kind === "revision" ? copy.revision : copy.target}</span>
          {refs.map((ref) => <code key={ref}>{ref}</code>)}
        </div>
      ) : null}
      <button className="event-provenance__close" type="button" onClick={onClose}>{copy.close}</button>
    </aside>
  );
}

function installReadOnlyObserver() {
  const prototype = CouncilOrchestrator.prototype as ObservablePrototype;
  if (prototype[PATCH_MARKER]) return;
  prototype[PATCH_MARKER] = true;

  const originalRun = CouncilOrchestrator.prototype.run;
  CouncilOrchestrator.prototype.run = (async function (
    this: CouncilOrchestrator,
    question: string,
    options: CouncilRunOptions = {},
  ) {
    const liveEvents: CouncilEvent[] = [];
    const participants = [...this.participants];
    const activities = new Map<string, CouncilParticipantTurnUpdate>();
    let phase: CouncilPhaseUpdate | null = null;

    const dispatchLive = () => {
      window.dispatchEvent(new CustomEvent<ConsultationLiveDetail>(LIVE_EVENT, {
        detail: {
          participants,
          events: [...liveEvents],
          phase: phase ? { ...phase } : null,
          activities: Object.fromEntries(
            [...activities.entries()].map(([participantId, update]) => [
              participantId,
              cloneActivity(update),
            ]),
          ),
        },
      }));
    };

    const observedOptions: CouncilRunOptions = {
      ...options,
      onPhase: async (update) => {
        await options.onPhase?.(update);
        phase = { ...update };
        activities.clear();
        dispatchLive();
      },
      onParticipantTurn: async (update) => {
        await options.onParticipantTurn?.(update);
        activities.set(update.participant.id, cloneActivity(update));
        dispatchLive();
      },
      onEvent: async (event) => {
        await options.onEvent?.(event);
        liveEvents.push(event);
        dispatchLive();
      },
    };

    const result = await originalRun.call(this, question, observedOptions);
    window.dispatchEvent(new CustomEvent<ConsultationCompletionDetail>(COMPLETE_EVENT, {
      detail: {
        report: result.report,
        events: [...result.blackboard.events],
      },
    }));
    return result;
  }) as typeof originalRun;
}

function cloneActivities(
  activities: Readonly<Record<string, CouncilParticipantTurnUpdate>> | undefined,
): Record<string, CouncilParticipantTurnUpdate> {
  return Object.fromEntries(
    Object.entries(activities ?? {}).map(([participantId, update]) => [participantId, cloneActivity(update)]),
  );
}

function cloneActivity(update: CouncilParticipantTurnUpdate): CouncilParticipantTurnUpdate {
  return {
    ...update,
    participant: { ...update.participant },
    ...(update.contributionKinds ? { contributionKinds: [...update.contributionKinds] } : {}),
  };
}

function eventReferences(event: CouncilEvent): string[] {
  if (event.kind === "challenge" || event.kind === "support" || event.kind === "defense" || event.kind === "concede") {
    return [event.targetEventId];
  }
  if (event.kind === "evidence") return event.targetEventId ? [event.targetEventId] : [];
  if (event.kind === "revision") return [event.previousEventId, ...(event.causedBy ?? [])];
  return [];
}

const root = document.getElementById("consultation-theater-root");
if (!root) throw new Error("ChatChat Consultation Theater root is missing.");
createRoot(root).render(
  <StrictMode>
    <ConsultationTheaterPortal />
  </StrictMode>,
);
