import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CouncilEvent, CouncilParticipant, CouncilReport } from "../core/types.js";
import type { ConsultationArchive } from "../history/consultation-history.js";
import { ExecutionAuditHistoryStore } from "../history/execution-audit-history.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import {
  cloneProviderExecutionAudit,
  PROVIDER_EXECUTION_AUDIT_EVENT,
  type ProviderExecutionAuditEvent,
} from "../provider-sdk/execution-audit.js";
import {
  cloneProviderTransportAudit,
  PROVIDER_TRANSPORT_AUDIT_EVENT,
  type ProviderTransportAuditRecord,
} from "../provider-sdk/transport-audit.js";
import { deriveProviderMemoryCoverage } from "../theater/provider-memory-coverage.js";
import { ProviderMemoryCoverage } from "./components/ProviderMemoryCoverage.js";
import { focusConsultationEvent } from "./provenance-wire.js";

const LIVE_EVENT = "chatchat:consultation-live";
const COMPLETE_EVENT = "chatchat:consultation-complete";
const OPEN_ARCHIVE_EVENT = "chatchat:consultation-open-archive";
const executionHistory = new ExecutionAuditHistoryStore();

interface ConsultationLiveDetail {
  participants?: CouncilParticipant[];
  events?: CouncilEvent[];
}

interface ConsultationCompletionDetail {
  report: CouncilReport;
  events: CouncilEvent[];
}

interface OpenArchiveDetail {
  archive: ConsultationArchive;
}

function ProviderMemoryPortal() {
  const [participants, setParticipants] = useState<CouncilParticipant[]>([]);
  const [events, setEvents] = useState<CouncilEvent[]>([]);
  const [execution, setExecution] = useState<ProviderExecutionAuditEvent[]>([]);
  const [transports, setTransports] = useState<ProviderTransportAuditRecord[]>([]);
  const [archive, setArchive] = useState(false);
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));
  const sessionRef = useRef<string | null>(null);

  useEffect(() => {
    const onExecution = (event: Event) => {
      const detail = (event as CustomEvent<ProviderExecutionAuditEvent>).detail;
      if (!detail?.sessionId) return;
      if (archive) return;
      if (sessionRef.current && detail.sessionId !== sessionRef.current) {
        sessionRef.current = detail.sessionId;
        setExecution([]);
        setTransports([]);
      } else {
        sessionRef.current = detail.sessionId;
      }
      setExecution((current) => [...current, cloneProviderExecutionAudit(detail)].slice(-720));
    };
    const onTransport = (event: Event) => {
      const detail = (event as CustomEvent<ProviderTransportAuditRecord>).detail;
      if (!detail?.sessionId || archive) return;
      sessionRef.current ??= detail.sessionId;
      setTransports((current) => [...current, cloneProviderTransportAudit(detail)].slice(-720));
    };
    const onLive = (event: Event) => {
      const detail = (event as CustomEvent<ConsultationLiveDetail>).detail;
      const incomingEvents = Array.isArray(detail?.events) ? detail.events : [];
      const incomingSession = incomingEvents[0]?.sessionId ?? null;
      if (archive) {
        setArchive(false);
        setExecution([]);
        setTransports([]);
      }
      if (incomingSession && sessionRef.current && incomingSession !== sessionRef.current) {
        setExecution([]);
        setTransports([]);
      }
      if (incomingSession) sessionRef.current = incomingSession;
      if (Array.isArray(detail?.participants)) setParticipants(detail.participants.map((item) => ({ ...item })));
      if (Array.isArray(detail?.events)) setEvents(detail.events.map(cloneEvent));
    };
    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<ConsultationCompletionDetail>).detail;
      if (!detail?.report || !Array.isArray(detail.events)) return;
      if (archive) return;
      sessionRef.current = detail.report.sessionId;
      setParticipants(detail.report.positions.map((position) => ({ ...position.participant })));
      setEvents(detail.events.map(cloneEvent));
    };
    const onArchive = (event: Event) => {
      const item = (event as CustomEvent<OpenArchiveDetail>).detail?.archive;
      if (!item?.report || !Array.isArray(item.events)) return;
      sessionRef.current = item.sessionId;
      setArchive(true);
      setParticipants(item.report.positions.map((position) => ({ ...position.participant })));
      setEvents(item.events.map(cloneEvent));
      setExecution([]);
      setTransports([]);
      void executionHistory.load(item.sessionId).then((saved) => {
        if (sessionRef.current !== item.sessionId) return;
        setExecution(saved?.execution.map(cloneProviderExecutionAudit) ?? []);
        setTransports(saved?.transports.map(cloneProviderTransportAudit) ?? []);
      }).catch(() => {
        if (sessionRef.current !== item.sessionId) return;
        setExecution([]);
        setTransports([]);
      });
    };

    window.addEventListener(PROVIDER_EXECUTION_AUDIT_EVENT, onExecution);
    window.addEventListener(PROVIDER_TRANSPORT_AUDIT_EVENT, onTransport);
    window.addEventListener(LIVE_EVENT, onLive);
    window.addEventListener(COMPLETE_EVENT, onComplete);
    window.addEventListener(OPEN_ARCHIVE_EVENT, onArchive);
    return () => {
      window.removeEventListener(PROVIDER_EXECUTION_AUDIT_EVENT, onExecution);
      window.removeEventListener(PROVIDER_TRANSPORT_AUDIT_EVENT, onTransport);
      window.removeEventListener(LIVE_EVENT, onLive);
      window.removeEventListener(COMPLETE_EVENT, onComplete);
      window.removeEventListener(OPEN_ARCHIVE_EVENT, onArchive);
    };
  }, [archive]);

  useEffect(() => {
    const observer = new MutationObserver(() => setLocale(normalizeLocale(document.documentElement.lang)));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  const model = useMemo(
    () => deriveProviderMemoryCoverage(participants, events, execution, transports),
    [participants, events, execution, transports],
  );

  if (!model.rounds.length) return null;
  return (
    <ProviderMemoryCoverage
      model={model}
      locale={locale}
      archive={archive}
      onFocusEvent={focusConsultationEvent}
    />
  );
}

function cloneEvent(event: CouncilEvent): CouncilEvent {
  if (event.kind === "revision") return { ...event, ...(event.causedBy ? { causedBy: [...event.causedBy] } : {}) };
  if (event.kind === "final_position") return { ...event, ...(event.caveats ? { caveats: [...event.caveats] } : {}) };
  return { ...event };
}

const root = document.getElementById("provider-memory-root");
if (!root) throw new Error("ChatChat Provider Memory Coverage root is missing.");
createRoot(root).render(<StrictMode><ProviderMemoryPortal /></StrictMode>);
