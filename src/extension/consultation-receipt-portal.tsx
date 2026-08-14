import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CouncilEvent, CouncilReport } from "../core/types.js";
import {
  EVIDENCE_VERIFICATIONS_STORAGE_KEY,
  type EvidenceVerificationSnapshot,
} from "../evidence/evidence-ledger.js";
import type { ConsultationArchive } from "../history/consultation-history.js";
import { EvidenceHistoryStore } from "../history/evidence-history.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import { ConsultationReceiptCard } from "./components/ConsultationReceipt.js";

declare const chrome: any;

const LIVE_EVENT = "chatchat:consultation-live";
const COMPLETE_EVENT = "chatchat:consultation-complete";
const OPEN_ARCHIVE_EVENT = "chatchat:consultation-open-archive";
const evidenceHistory = new EvidenceHistoryStore();

interface CompletionDetail {
  report: CouncilReport;
  events: CouncilEvent[];
}

interface ArchiveDetail {
  archive: ConsultationArchive;
}

function ConsultationReceiptPortal() {
  const [completion, setCompletion] = useState<CompletionDetail | null>(null);
  const [archiveMode, setArchiveMode] = useState(false);
  const [verifications, setVerifications] = useState<Record<string, EvidenceVerificationSnapshot>>({});
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));
  const archiveModeRef = useRef(false);

  useEffect(() => {
    const onLive = () => {
      archiveModeRef.current = false;
      setArchiveMode(false);
      setCompletion(null);
      setVerifications({});
    };
    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<CompletionDetail>).detail;
      if (!detail?.report || !Array.isArray(detail.events)) return;
      archiveModeRef.current = false;
      setArchiveMode(false);
      setCompletion({ report: detail.report, events: [...detail.events] });
      void readCurrentVerifications().then(setVerifications).catch(() => setVerifications({}));
    };
    const onArchive = (event: Event) => {
      const archive = (event as CustomEvent<ArchiveDetail>).detail?.archive;
      if (!archive?.report || !Array.isArray(archive.events)) return;
      archiveModeRef.current = true;
      setArchiveMode(true);
      setCompletion({ report: archive.report, events: [...archive.events] });
      void evidenceHistory.load(archive.sessionId)
        .then((saved) => setVerifications(saved?.verifications ?? {}))
        .catch(() => setVerifications({}));
    };
    const onStorage = (changes: Record<string, { newValue?: unknown }>) => {
      if (archiveModeRef.current) return;
      const change = changes[EVIDENCE_VERIFICATIONS_STORAGE_KEY];
      if (!change) return;
      setVerifications(normalizeVerifications(change.newValue));
    };

    window.addEventListener(LIVE_EVENT, onLive);
    window.addEventListener(COMPLETE_EVENT, onComplete);
    window.addEventListener(OPEN_ARCHIVE_EVENT, onArchive);
    chrome.storage?.onChanged?.addListener(onStorage);
    return () => {
      window.removeEventListener(LIVE_EVENT, onLive);
      window.removeEventListener(COMPLETE_EVENT, onComplete);
      window.removeEventListener(OPEN_ARCHIVE_EVENT, onArchive);
      chrome.storage?.onChanged?.removeListener(onStorage);
    };
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => setLocale(normalizeLocale(document.documentElement.lang)));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = document.getElementById("consultation-receipt-root");
    if (!root || !completion) return;
    const nextMove = document.getElementById("next-move-root");
    const history = document.getElementById("consultation-history-root");
    const setup = document.querySelector(".consultation-app .setup-card");
    const app = nextMove?.parentElement
      ?? history?.parentElement
      ?? setup?.parentElement
      ?? document.querySelector(".consultation-app");
    if (!app) return;

    if (nextMove?.parentElement === app) {
      app.insertBefore(root, nextMove.nextSibling);
    } else if (history?.parentElement === app) {
      app.insertBefore(root, history);
    } else if (setup?.parentElement === app) {
      app.insertBefore(root, setup);
    } else {
      app.append(root);
    }
  }, [completion, verifications]);

  if (!completion) return null;
  return (
    <ConsultationReceiptCard
      report={completion.report}
      events={completion.events}
      verifications={verifications}
      locale={locale}
      archive={archiveMode}
    />
  );
}

async function readCurrentVerifications(): Promise<Record<string, EvidenceVerificationSnapshot>> {
  const store = chrome.storage.session ?? chrome.storage.local;
  const value = await store.get(EVIDENCE_VERIFICATIONS_STORAGE_KEY);
  return normalizeVerifications(value[EVIDENCE_VERIFICATIONS_STORAGE_KEY]);
}

function normalizeVerifications(value: unknown): Record<string, EvidenceVerificationSnapshot> {
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
