import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CouncilEvent, CouncilReport } from "../core/types.js";
import {
  EVIDENCE_VERIFICATIONS_STORAGE_KEY,
  type EvidenceVerificationSnapshot,
} from "../evidence/evidence-ledger.js";
import { ExecutionAuditHistoryStore } from "../history/execution-audit-history.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import type { ConsultationReceiptExecutionIntegrity } from "../consultation/receipt-integrity.js";
import { providerExecutionAuditSnapshot } from "../provider-sdk/execution-audit.js";
import { providerTransportAuditSnapshot } from "../provider-sdk/transport-audit.js";
import { buildProviderAttendanceAudit } from "../theater/provider-attendance.js";
import { deriveMeetingExecutionIntegrity } from "../theater/meeting-integrity.js";
import { ConsultationReceiptCard } from "./components/ConsultationReceipt.js";
import {
  OPEN_ARCHIVE_EVENT,
  type OpenArchiveDetail,
} from "./consultation-history-portal.js";

declare const chrome: any;

const COMPLETE_EVENT = "chatchat:consultation-complete";
const EVIDENCE_VERIFICATIONS_UPDATED_EVENT = "chatchat:evidence-verifications-updated";
const executionHistory = new ExecutionAuditHistoryStore();

interface CompletionDetail {
  report: CouncilReport;
  events: CouncilEvent[];
}

interface VerificationUpdateDetail {
  verifications?: Record<string, EvidenceVerificationSnapshot>;
}

function ConsultationReceiptPortal() {
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));
  const [report, setReport] = useState<CouncilReport | null>(null);
  const [events, setEvents] = useState<CouncilEvent[]>([]);
  const [verifications, setVerifications] = useState<Record<string, EvidenceVerificationSnapshot>>({});
  const [executionIntegrity, setExecutionIntegrity] = useState<ConsultationReceiptExecutionIntegrity | undefined>();
  const [archive, setArchive] = useState(false);

  useEffect(() => {
    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<CompletionDetail>).detail;
      if (!detail?.report || !Array.isArray(detail.events)) return;
      const sessionId = detail.report.sessionId;
      setReport(detail.report);
      setEvents(detail.events);
      setArchive(false);
      setExecutionIntegrity(deriveLiveExecutionIntegrity(detail.report, detail.events));
      void readCurrentVerifications().then(setVerifications);
    };
    const onArchive = (event: Event) => {
      const detail = (event as CustomEvent<OpenArchiveDetail>).detail;
      if (!detail?.archive) return;
      setReport(detail.archive.report);
      setEvents(detail.archive.events);
      setArchive(true);
      setExecutionIntegrity(undefined);
      void Promise.all([
        readCurrentVerifications(),
        executionHistory.load(detail.archive.sessionId),
      ]).then(([current, auditArchive]) => {
        setVerifications(current);
        if (!auditArchive) {
          setExecutionIntegrity(undefined);
          return;
        }
        const attendance = buildProviderAttendanceAudit(
          detail.archive.report.positions.map((position) => position.participant),
          auditArchive.transports,
          auditArchive.execution,
          detail.archive.events,
        );
        setExecutionIntegrity({
          mode: auditArchive.mode,
          integrity: deriveMeetingExecutionIntegrity(attendance),
        });
      });
    };
    const onVerificationUpdate = (event: Event) => {
      const detail = (event as CustomEvent<VerificationUpdateDetail>).detail;
      if (!detail?.verifications) return;
      setVerifications(detail.verifications);
    };
    const observer = new MutationObserver(() => setLocale(normalizeLocale(document.documentElement.lang)));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    window.addEventListener(COMPLETE_EVENT, onComplete);
    window.addEventListener(OPEN_ARCHIVE_EVENT, onArchive);
    window.addEventListener(EVIDENCE_VERIFICATIONS_UPDATED_EVENT, onVerificationUpdate);
    return () => {
      observer.disconnect();
      window.removeEventListener(COMPLETE_EVENT, onComplete);
      window.removeEventListener(OPEN_ARCHIVE_EVENT, onArchive);
      window.removeEventListener(EVIDENCE_VERIFICATIONS_UPDATED_EVENT, onVerificationUpdate);
    };
  }, []);

  useEffect(() => {
    const root = document.getElementById("consultation-receipt-root");
    const history = document.getElementById("consultation-history-root");
    const setup = document.querySelector(".consultation-app .setup-card");
    const app = setup?.parentElement ?? document.querySelector(".consultation-app");
    if (!root || !app) return;
    if (history?.parentElement === app) app.insertBefore(root, history);
    else if (setup) app.insertBefore(root, setup);
    else app.append(root);
  }, [report]);

  if (!report) return null;
  return (
    <ConsultationReceiptCard
      report={report}
      events={events}
      verifications={verifications}
      executionIntegrity={executionIntegrity}
      locale={locale}
      archive={archive}
    />
  );
}

function deriveLiveExecutionIntegrity(
  report: CouncilReport,
  events: readonly CouncilEvent[],
): ConsultationReceiptExecutionIntegrity | undefined {
  const transports = providerTransportAuditSnapshot(report.sessionId);
  const execution = providerExecutionAuditSnapshot(report.sessionId);
  if (!transports.length && !execution.length) return undefined;
  const attendance = buildProviderAttendanceAudit(
    report.positions.map((position) => position.participant),
    transports,
    execution,
    events,
  );
  return {
    mode: transports[0]?.mode ?? "unknown",
    integrity: deriveMeetingExecutionIntegrity(attendance),
  };
}

async function readCurrentVerifications(): Promise<Record<string, EvidenceVerificationSnapshot>> {
  if (typeof chrome === "undefined" || !chrome.storage) return {};
  const storeArea = chrome.storage.session ?? chrome.storage.local;
  const stored = await storeArea.get(EVIDENCE_VERIFICATIONS_STORAGE_KEY);
  const value = stored[EVIDENCE_VERIFICATIONS_STORAGE_KEY];
  return value && typeof value === "object"
    ? value as Record<string, EvidenceVerificationSnapshot>
    : {};
}

const root = document.getElementById("consultation-receipt-root");
if (!root) throw new Error("ChatChat Consultation Receipt root is missing.");
createRoot(root).render(
  <StrictMode>
    <ConsultationReceiptPortal />
  </StrictMode>,
);
