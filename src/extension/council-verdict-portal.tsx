import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CouncilEvent, CouncilReport } from "../core/types.js";
import type { ConsultationArchive } from "../history/consultation-history.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import { CouncilVerdictReadout } from "./components/CouncilVerdictReadout.js";

const LIVE_EVENT = "chatchat:consultation-live";
const COMPLETE_EVENT = "chatchat:consultation-complete";
const OPEN_ARCHIVE_EVENT = "chatchat:consultation-open-archive";

interface CompletionDetail {
  report: CouncilReport;
  events: CouncilEvent[];
}

interface OpenArchiveDetail {
  archive: ConsultationArchive;
}

function CouncilVerdictPortal() {
  const [completion, setCompletion] = useState<CompletionDetail | null>(null);
  const [archiveMode, setArchiveMode] = useState(false);
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));

  useEffect(() => {
    const onLive = () => {
      setCompletion(null);
      setArchiveMode(false);
      delete document.documentElement.dataset.chatchatVerdictStage;
    };
    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<CompletionDetail>).detail;
      if (!detail?.report || !Array.isArray(detail.events)) return;
      setCompletion({ report: detail.report, events: [...detail.events] });
      setArchiveMode(false);
    };
    const onArchive = (event: Event) => {
      const archive = (event as CustomEvent<OpenArchiveDetail>).detail?.archive;
      if (!archive?.report || !Array.isArray(archive.events)) return;
      setCompletion({ report: archive.report, events: [...archive.events] });
      setArchiveMode(true);
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
    const observer = new MutationObserver(() => {
      setLocale(normalizeLocale(document.documentElement.lang));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!completion) return;
    const root = document.getElementById("council-verdict-root");
    if (!(root instanceof HTMLElement)) return;

    const place = () => {
      const app = document.querySelector(".consultation-app");
      if (!(app instanceof HTMLElement)) return;
      const outcome = app.querySelector(".outcome-card");
      if (outcome?.parentElement === app) {
        if (root.parentElement !== app || root.nextElementSibling !== outcome) app.insertBefore(root, outcome);
      } else {
        const finalFloor = document.getElementById("final-position-floor-root");
        if (finalFloor?.parentElement === app) {
          if (root.parentElement !== app || root.nextElementSibling !== finalFloor) app.insertBefore(root, finalFloor);
        } else if (root.parentElement !== app) {
          app.append(root);
        }
      }
      root.dataset.chatchatVisualLayer = "stage";
      document.documentElement.dataset.chatchatVerdictStage = "ready";
    };

    place();
    const app = document.querySelector(".consultation-app");
    if (!(app instanceof HTMLElement)) return;
    const observer = new MutationObserver(place);
    observer.observe(app, { childList: true });
    const frame = window.requestAnimationFrame(place);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [completion]);

  if (!completion) return null;
  return (
    <CouncilVerdictReadout
      report={completion.report}
      events={completion.events}
      locale={locale}
      archive={archiveMode}
    />
  );
}

const root = document.getElementById("council-verdict-root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <CouncilVerdictPortal />
    </StrictMode>,
  );
}
