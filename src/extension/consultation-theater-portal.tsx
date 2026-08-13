import { StrictMode, useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CouncilOrchestrator } from "../core/orchestrator.js";
import type {
  CouncilEvent,
  CouncilReport,
  CouncilRunOptions,
} from "../core/types.js";
import {
  createConsultationHistoryStore,
  type ConsultationArchive,
  type ConsultationHistorySummary,
} from "../consultation/history.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import { ConsultationHistory } from "./components/ConsultationHistory.js";
import { ConsultationTheater } from "./components/ConsultationTheater.js";
import "./consultation-theater-portal.css";

const COMPLETE_EVENT = "chatchat:consultation-complete";
const PATCH_MARKER = "__chatchatConsultationTheaterObserverV1" as const;
const historyStore = createConsultationHistoryStore();

interface ConsultationCompletionDetail {
  report: CouncilReport;
  events: CouncilEvent[];
}

type ObservablePrototype = typeof CouncilOrchestrator.prototype & {
  [PATCH_MARKER]?: true;
};

type ViewingSource = "current" | "history";

installReadOnlyObserver();

function ConsultationTheaterPortal() {
  const [current, setCurrent] = useState<ConsultationCompletionDetail | null>(null);
  const [viewing, setViewing] = useState<ConsultationCompletionDetail | null>(null);
  const [viewingSource, setViewingSource] = useState<ViewingSource>("current");
  const [history, setHistory] = useState<ConsultationHistorySummary[]>([]);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const refreshHistory = useCallback(async () => {
    try {
      setHistory(await historyStore.list(12));
      setHistoryError(null);
    } catch (caught) {
      setHistoryError(errorMessage(caught));
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<ConsultationCompletionDetail>).detail;
      if (!detail?.report || !Array.isArray(detail.events)) return;
      const frozen = { report: detail.report, events: [...detail.events] };
      setCurrent(frozen);
      setViewing(frozen);
      setViewingSource("current");
      setSelectedEventId(null);
      void (async () => {
        try {
          await historyStore.save(frozen.report, frozen.events);
          await refreshHistory();
        } catch (caught) {
          setHistoryError(errorMessage(caught));
        }
      })();
    };
    window.addEventListener(COMPLETE_EVENT, onComplete);
    return () => window.removeEventListener(COMPLETE_EVENT, onComplete);
  }, [refreshHistory]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setLocale(normalizeLocale(document.documentElement.lang));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let stopped = false;
    const place = () => {
      if (stopped) return true;
      const portalRoot = document.getElementById("consultation-theater-root");
      const setup = document.querySelector(".consultation-app .setup-card");
      const app = setup?.parentElement ?? document.querySelector(".consultation-app");
      if (!portalRoot || !app) return false;
      if (setup) app.insertBefore(portalRoot, setup);
      else app.append(portalRoot);
      return true;
    };
    if (place()) return () => { stopped = true; };
    const observer = new MutationObserver(() => {
      if (place()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      stopped = true;
      observer.disconnect();
    };
  }, []);

  const selectedEvent = useMemo(
    () => viewing?.events.find((event) => event.id === selectedEventId) ?? null,
    [viewing, selectedEventId],
  );

  const openHistory = useCallback(async (sessionId: string) => {
    setHistoryBusy(true);
    setHistoryError(null);
    try {
      const archive = await historyStore.load(sessionId);
      if (!archive) throw new Error("Saved consultation could not be loaded.");
      setViewing(archiveToCompletion(archive));
      setViewingSource("history");
      setSelectedEventId(null);
    } catch (caught) {
      setHistoryError(errorMessage(caught));
    } finally {
      setHistoryBusy(false);
    }
  }, []);

  const removeHistory = useCallback(async (sessionId: string) => {
    setHistoryBusy(true);
    setHistoryError(null);
    try {
      await historyStore.remove(sessionId);
      if (viewingSource === "history" && viewing?.report.sessionId === sessionId) {
        setViewing(current);
        setViewingSource("current");
        setSelectedEventId(null);
      }
      await refreshHistory();
    } catch (caught) {
      setHistoryError(errorMessage(caught));
    } finally {
      setHistoryBusy(false);
    }
  }, [current, refreshHistory, viewing, viewingSource]);

  const clearHistory = useCallback(async () => {
    setHistoryBusy(true);
    setHistoryError(null);
    try {
      await historyStore.clear();
      if (viewingSource === "history") {
        setViewing(current);
        setViewingSource("current");
        setSelectedEventId(null);
      }
      await refreshHistory();
    } catch (caught) {
      setHistoryError(errorMessage(caught));
    } finally {
      setHistoryBusy(false);
    }
  }, [current, refreshHistory, viewingSource]);

  const returnCurrent = useCallback(() => {
    setViewing(current);
    setViewingSource("current");
    setSelectedEventId(null);
  }, [current]);

  const participants = viewing?.report.positions.map((position) => position.participant) ?? [];

  return (
    <div className="consultation-theater-portal">
      {viewing ? (
        <ConsultationTheater
          participants={participants}
          events={viewing.events}
          report={viewing.report}
          locale={locale}
          onFocusEvent={setSelectedEventId}
        />
      ) : null}

      <ConsultationHistory
        entries={history}
        locale={locale}
        activeSessionId={viewing?.report.sessionId ?? null}
        viewingHistorical={viewingSource === "history"}
        hasCurrentConsultation={Boolean(current)}
        busy={historyBusy}
        onOpen={(sessionId) => void openHistory(sessionId)}
        onRemove={(sessionId) => void removeHistory(sessionId)}
        onClear={() => void clearHistory()}
        onReturnCurrent={returnCurrent}
      />

      {historyError ? <HistoryError message={historyError} locale={locale} /> : null}

      {selectedEvent && viewing ? (
        <EventProvenanceDetail
          event={selectedEvent}
          report={viewing.report}
          locale={locale}
          onClose={() => setSelectedEventId(null)}
        />
      ) : null}
    </div>
  );
}

function HistoryError({ message, locale }: { message: string; locale: Locale }) {
  return (
    <div className="history-error" role="alert">
      <strong>{locale === "zh-CN" ? "本地协商记录暂时不可用" : "Local consultation history is unavailable"}</strong>
      <span>{message}</span>
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
  const prototype = CouncilOrchestrator.prototype as ObservablePrototype;
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

function archiveToCompletion(archive: ConsultationArchive): ConsultationCompletionDetail {
  return {
    report: archive.report,
    events: [...archive.events],
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

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

const root = document.getElementById("consultation-theater-root");
if (!root) throw new Error("ChatChat Consultation Theater root is missing.");
createRoot(root).render(
  <StrictMode>
    <ConsultationTheaterPortal />
  </StrictMode>,
);
