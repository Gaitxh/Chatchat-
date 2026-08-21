import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CouncilEvent, CouncilParticipant, CouncilReport } from "../core/types.js";
import type { ConsultationArchive } from "../history/consultation-history.js";
import { ExecutionAuditHistoryStore } from "../history/execution-audit-history.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import {
  cloneProviderExecutionAudit,
  providerExecutionAuditSnapshot,
  PROVIDER_EXECUTION_AUDIT_EVENT,
  type ProviderExecutionAuditEvent,
} from "../provider-sdk/execution-audit.js";
import {
  cloneProviderTransportAudit,
  providerTransportAuditSnapshot,
  PROVIDER_TRANSPORT_AUDIT_EVENT,
  type ProviderTransportAuditRecord,
} from "../provider-sdk/transport-audit.js";
import { deriveMeetingMemoryIntegrity } from "../theater/meeting-memory-integrity.js";
import { deriveProviderMemoryCoverage } from "../theater/provider-memory-coverage.js";
import { deriveProviderMemoryFairness } from "../theater/provider-memory-fairness.js";
import { deriveProviderMemoryGaps } from "../theater/provider-memory-gaps.js";
import { ProviderMemoryCoverage } from "./components/ProviderMemoryCoverage.js";
import { ProviderMemoryFairness } from "./components/ProviderMemoryFairness.js";
import { ProviderMemoryGaps } from "./components/ProviderMemoryGaps.js";
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
  const archiveRef = useRef(false);

  useEffect(() => {
    const syncLiveAudit = (sessionId: string) => {
      setExecution(providerExecutionAuditSnapshot(sessionId));
      setTransports(providerTransportAuditSnapshot(sessionId));
    };
    const onExecution = (event: Event) => {
      const detail = (event as CustomEvent<ProviderExecutionAuditEvent>).detail;
      if (!detail?.sessionId || archiveRef.current) return;
      if (sessionRef.current && detail.sessionId !== sessionRef.current) {
        sessionRef.current = detail.sessionId;
        setExecution([]);
        setTransports([]);
      } else {
        sessionRef.current = detail.sessionId;
      }
      setExecution((current) => appendUniqueExecution(current, detail));
    };
    const onTransport = (event: Event) => {
      const detail = (event as CustomEvent<ProviderTransportAuditRecord>).detail;
      if (!detail?.sessionId || archiveRef.current) return;
      sessionRef.current ??= detail.sessionId;
      setTransports((current) => appendUniqueTransport(current, detail));
    };
    const onLive = (event: Event) => {
      const detail = (event as CustomEvent<ConsultationLiveDetail>).detail;
      const incomingEvents = Array.isArray(detail?.events) ? detail.events : [];
      const incomingSession = incomingEvents[0]?.sessionId ?? sessionRef.current;
      if (archiveRef.current) {
        archiveRef.current = false;
        setArchive(false);
        setExecution([]);
        setTransports([]);
      }
      if (incomingSession && sessionRef.current && incomingSession !== sessionRef.current) {
        setExecution([]);
        setTransports([]);
      }
      if (incomingSession) {
        sessionRef.current = incomingSession;
        syncLiveAudit(incomingSession);
      }
      if (Array.isArray(detail?.participants)) setParticipants(detail.participants.map((item) => ({ ...item })));
      if (Array.isArray(detail?.events)) setEvents(detail.events.map(cloneEvent));
    };
    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<ConsultationCompletionDetail>).detail;
      if (!detail?.report || !Array.isArray(detail.events) || archiveRef.current) return;
      sessionRef.current = detail.report.sessionId;
      syncLiveAudit(detail.report.sessionId);
      setParticipants(detail.report.positions.map((position) => ({ ...position.participant })));
      setEvents(detail.events.map(cloneEvent));
    };
    const onArchive = (event: Event) => {
      const item = (event as CustomEvent<OpenArchiveDetail>).detail?.archive;
      if (!item?.report || !Array.isArray(item.events)) return;
      sessionRef.current = item.sessionId;
      archiveRef.current = true;
      setArchive(true);
      setParticipants(item.report.positions.map((position) => ({ ...position.participant })));
      setEvents(item.events.map(cloneEvent));
      setExecution([]);
      setTransports([]);
      void executionHistory.load(item.sessionId).then((saved) => {
        if (sessionRef.current !== item.sessionId || !archiveRef.current) return;
        setExecution(saved?.execution.map(cloneProviderExecutionAudit) ?? []);
        setTransports(saved?.transports.map(cloneProviderTransportAudit) ?? []);
      }).catch(() => {
        if (sessionRef.current !== item.sessionId || !archiveRef.current) return;
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
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => setLocale(normalizeLocale(document.documentElement.lang)));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  const coverage = useMemo(
    () => deriveProviderMemoryCoverage(participants, events, execution, transports),
    [participants, events, execution, transports],
  );
  const gaps = useMemo(
    () => deriveProviderMemoryGaps(participants, events, coverage),
    [participants, events, coverage],
  );
  const integrity = useMemo(() => deriveMeetingMemoryIntegrity(coverage, gaps), [coverage, gaps]);
  const fairness = useMemo(
    () => deriveProviderMemoryFairness(participants, execution, transports),
    [participants, execution, transports],
  );

  if (!coverage.rounds.length) return null;
  return (
    <div
      className="provider-memory-view"
      data-provider-memory-view={archive ? "archive" : "live"}
      data-provider-memory-view-session={coverage.sessionId ?? ""}
    >
      <ProviderMemoryCoverage model={coverage} integrity={integrity} locale={locale} archive={archive} onFocusEvent={focusConsultationEvent} />
      <ProviderMemoryFairness model={fairness} locale={locale} archive={archive} />
      <ProviderMemoryGaps model={gaps} locale={locale} onFocusEvent={focusConsultationEvent} />
    </div>
  );
}

function appendUniqueExecution(current: readonly ProviderExecutionAuditEvent[], event: ProviderExecutionAuditEvent): ProviderExecutionAuditEvent[] {
  const key = `${event.sessionId}|${event.actorId}|${event.phase}|${event.round}|${event.stage}|${event.attempt ?? 0}|${event.observedAt}`;
  if (current.some((item) => `${item.sessionId}|${item.actorId}|${item.phase}|${item.round}|${item.stage}|${item.attempt ?? 0}|${item.observedAt}` === key)) return [...current];
  return [...current, cloneProviderExecutionAudit(event)].slice(-720);
}

function appendUniqueTransport(current: readonly ProviderTransportAuditRecord[], record: ProviderTransportAuditRecord): ProviderTransportAuditRecord[] {
  const key = `${record.sessionId}|${record.actorId}|${record.phase}|${record.round}|${record.state}|${record.repairAttempt ? 1 : 0}|${record.observedAt}`;
  if (current.some((item) => `${item.sessionId}|${item.actorId}|${item.phase}|${item.round}|${item.state}|${item.repairAttempt ? 1 : 0}|${item.observedAt}` === key)) return [...current];
  return [...current, cloneProviderTransportAudit(record)].slice(-720);
}

function cloneEvent(event: CouncilEvent): CouncilEvent {
  if (event.kind === "revision") return { ...event, ...(event.causedBy ? { causedBy: [...event.causedBy] } : {}) };
  if (event.kind === "final_position") return { ...event, ...(event.caveats ? { caveats: [...event.caveats] } : {}) };
  return { ...event };
}

const root = document.getElementById("provider-memory-root");
if (!root) throw new Error("ChatChat Provider Memory Coverage root is missing.");
createRoot(root).render(<StrictMode><ProviderMemoryPortal /></StrictMode>);
