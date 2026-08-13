import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CouncilOrchestrator } from "../core/orchestrator.js";
import type {
  CouncilEvent,
  CouncilReport,
  CouncilRunOptions,
} from "../core/types.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import { ConsultationTheater } from "./components/ConsultationTheater.js";
import "./consultation-theater-portal.css";

const COMPLETE_EVENT = "chatchat:consultation-complete";
const PATCH_MARKER = Symbol.for("chatchat.consultation-theater-observer.v1");

interface ConsultationCompletionDetail {
  report: CouncilReport;
  events: CouncilEvent[];
}

interface PatchedPrototype {
  [PATCH_MARKER]?: boolean;
}

installReadOnlyObserver();

function ConsultationTheaterPortal() {
  const [completion, setCompletion] = useState<ConsultationCompletionDetail | null>(null);
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<ConsultationCompletionDetail>).detail;
      if (!detail?.report || !Array.isArray(detail.events)) return;
      setCompletion({ report: detail.report, events: [...detail.events] });
      setSelectedEventId(null);
    };
    window.addEventListener(COMPLETE_EVENT, onComplete);
    return () => window.removeEventListener(COMPLETE_EVENT, onComplete);
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setLocale(normalizeLocale(document.documentElement.lang));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  const selectedEvent = useMemo(
    () => completion?.events.find((event) => event.id === selectedEventId) ?? null,
    [completion, selectedEventId],
  );

  if (!completion) return null;

  const participants = completion.report.positions.map((position) => position.participant);
  return (
    <div className="consultation-theater-portal">
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
          report={completion.report}
          locale={locale}
          onClose={() => setSelectedEventId(null)}
        />
      ) : null}
    </div>
  );
}

function EventProvenanceDetail({
  event,
  report,
  locale,
  onClose,
}: {
  event: CouncilEvent;
  report: CouncilReport;
  locale: Locale;
  onClose(): void;
}) {
  const participant = report.positions.find((position) => position.participant.id === event.actorId)?.participant;
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
  const prototype = CouncilOrchestrator.prototype as CouncilOrchestrator["constructor"]["prototype"] & PatchedPrototype;
  if (prototype[PATCH_MARKER]) return;
  prototype[PATCH_MARKER] = true;

  const originalRun = CouncilOrchestrator.prototype.run;
  CouncilOrchestrator.prototype.run = (async function (
    this: CouncilOrchestrator,
    question: string,
    options: CouncilRunOptions = {},
  ) {
    const result = await originalRun.call(this, question, options);
    window.dispatchEvent(new CustomEvent<ConsultationCompletionDetail>(COMPLETE_EVENT, {
      detail: {
        report: result.report,
        events: [...result.blackboard.events],
      },
    }));
    return result;
  }) as typeof originalRun;
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
