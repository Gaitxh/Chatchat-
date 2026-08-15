import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CouncilEvent, CouncilReport } from "../core/types.js";
import { ExecutionAuditHistoryStore } from "../history/execution-audit-history.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import { providerExecutionAuditSnapshot } from "../provider-sdk/execution-audit.js";
import {
  providerTransportAuditSnapshot,
  type ProviderExecutionMode,
} from "../provider-sdk/transport-audit.js";
import { buildProviderAttendanceAudit, type ProviderAttendanceAuditModel } from "../theater/provider-attendance.js";
import { FinalPositionFloor } from "./components/FinalPositionFloor.js";

const LIVE_EVENT = "chatchat:consultation-live";
const COMPLETE_EVENT = "chatchat:consultation-complete";
const OPEN_ARCHIVE_EVENT = "chatchat:consultation-open-archive";
const executionHistory = new ExecutionAuditHistoryStore();
const SYNTHETIC_SHOWCASE = new URLSearchParams(location.search).get("showcase") === "consultation";

interface CompletionDetail {
  report: CouncilReport;
  events: CouncilEvent[];
}

interface ArchiveDetail {
  archive?: {
    sessionId: string;
    report: CouncilReport;
    events: CouncilEvent[];
  };
}

interface FloorView extends CompletionDetail {
  attendance: ProviderAttendanceAuditModel | null;
  executionMode: ProviderExecutionMode | "unknown";
  archive: boolean;
}

function FinalPositionFloorPortal() {
  const [view, setView] = useState<FloorView | null>(null);
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));

  useEffect(() => {
    const onLive = () => {
      document.documentElement.classList.remove("chatchat-final-position-floor-active");
      setView(null);
    };
    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<CompletionDetail>).detail;
      if (!detail?.report || !Array.isArray(detail.events)) return;
      const participants = detail.report.positions.map((position) => position.participant);
      const transports = providerTransportAuditSnapshot(detail.report.sessionId);
      const execution = providerExecutionAuditSnapshot(detail.report.sessionId);
      const attendance = buildProviderAttendanceAudit(participants, transports, execution, detail.events);
      setView({
        report: detail.report,
        events: detail.events.map(cloneEvent),
        attendance,
        executionMode: transports[0]?.mode ?? (SYNTHETIC_SHOWCASE ? "synthetic-showcase" : "unknown"),
        archive: false,
      });
    };
    const onArchive = (event: Event) => {
      const archive = (event as CustomEvent<ArchiveDetail>).detail?.archive;
      if (!archive?.report || !Array.isArray(archive.events)) return;
      const report = archive.report;
      const events = archive.events.map(cloneEvent);
      void executionHistory.load(archive.sessionId)
        .then((saved) => {
          const participants = report.positions.map((position) => position.participant);
          const attendance = saved
            ? buildProviderAttendanceAudit(participants, saved.transports, saved.execution, events)
            : null;
          setView({
            report,
            events,
            attendance,
            executionMode: saved?.mode ?? "unknown",
            archive: true,
          });
        })
        .catch(() => setView({
          report,
          events,
          attendance: null,
          executionMode: "unknown",
          archive: true,
        }));
    };

    window.addEventListener(LIVE_EVENT, onLive);
    window.addEventListener(COMPLETE_EVENT, onComplete);
    window.addEventListener(OPEN_ARCHIVE_EVENT, onArchive);
    return () => {
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

  useEffect(() => {
    const root = document.getElementById("final-position-floor-root");
    if (!root || !view) return;

    let settled = false;
    const place = () => {
      if (settled) return;
      if (view.archive) {
        document.documentElement.classList.remove("chatchat-final-position-floor-active");
        const theater = document.getElementById("consultation-theater-root");
        if (theater?.parentElement) {
          theater.parentElement.insertBefore(root, theater);
          settled = true;
        }
        return;
      }

      document.documentElement.classList.add("chatchat-final-position-floor-active");
      const integrityCard = document.querySelector(".meeting-integrity-card");
      const integrityRoot = integrityCard?.closest("#meeting-integrity-root");
      if (integrityRoot?.parentElement) {
        integrityRoot.insertAdjacentElement("afterend", root);
        settled = true;
        return;
      }
      const outcome = document.querySelector(".outcome-card");
      if (outcome?.parentElement) outcome.insertAdjacentElement("afterend", root);
    };

    place();
    requestAnimationFrame(() => requestAnimationFrame(place));
    const observer = new MutationObserver(place);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [view]);

  if (!view) return null;
  return (
    <FinalPositionFloor
      report={view.report}
      events={view.events}
      attendance={view.attendance}
      executionMode={view.executionMode}
      locale={locale}
      archive={view.archive}
    />
  );
}

function cloneEvent(event: CouncilEvent): CouncilEvent {
  if (event.kind === "revision") return { ...event, ...(event.causedBy ? { causedBy: [...event.causedBy] } : {}) };
  if (event.kind === "final_position") return { ...event, ...(event.caveats ? { caveats: [...event.caveats] } : {}) };
  return { ...event };
}

const root = document.getElementById("final-position-floor-root");
if (!root) throw new Error("ChatChat Final Position Floor root is missing.");
createRoot(root).render(<StrictMode><FinalPositionFloorPortal /></StrictMode>);
