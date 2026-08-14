import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CouncilEvent, CouncilParticipant, CouncilReport } from "../core/types.js";
import type { ConsultationArchive } from "../history/consultation-history.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import { ConflictBoard } from "./components/ConflictBoard.js";
import { focusConsultationEvent } from "./provenance-wire.js";

const LIVE_EVENT = "chatchat:consultation-live";
const COMPLETE_EVENT = "chatchat:consultation-complete";
const OPEN_ARCHIVE_EVENT = "chatchat:consultation-open-archive";

interface LiveDetail {
  participants?: CouncilParticipant[];
  events?: CouncilEvent[];
}

interface CompletionDetail {
  report?: CouncilReport;
  events?: CouncilEvent[];
}

interface ArchiveDetail {
  archive?: ConsultationArchive;
}

interface ConflictView {
  participants: CouncilParticipant[];
  events: CouncilEvent[];
  live: boolean;
  archive: boolean;
}

function ConflictBoardPortal() {
  const [view, setView] = useState<ConflictView | null>(null);
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));

  useEffect(() => {
    const onLive = (event: Event) => {
      const detail = (event as CustomEvent<LiveDetail>).detail;
      if (!Array.isArray(detail?.participants) || !Array.isArray(detail?.events)) return;
      setView({
        participants: detail.participants.map((participant) => ({ ...participant })),
        events: detail.events.map((item) => ({ ...item })),
        live: true,
        archive: false,
      });
    };
    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<CompletionDetail>).detail;
      if (!detail?.report || !Array.isArray(detail.events)) return;
      setView({
        participants: detail.report.positions.map((position) => ({ ...position.participant })),
        events: detail.events.map((item) => ({ ...item })),
        live: false,
        archive: false,
      });
    };
    const onArchive = (event: Event) => {
      const archive = (event as CustomEvent<ArchiveDetail>).detail?.archive;
      if (!archive?.report || !Array.isArray(archive.events)) return;
      setView({
        participants: archive.report.positions.map((position) => ({ ...position.participant })),
        events: archive.events.map((item) => ({ ...item })),
        live: false,
        archive: true,
      });
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
    const root = document.getElementById("conflict-board-root");
    if (!root || !view) return;
    if (view.live) {
      const liveRoom = document.querySelector(".consultation-app .live-room-card");
      const theaterRoot = document.getElementById("consultation-theater-root");
      if (liveRoom && theaterRoot?.parentElement === liveRoom) {
        liveRoom.insertBefore(root, theaterRoot);
        return;
      }
    }
    const theaterRoot = document.getElementById("consultation-theater-root");
    if (theaterRoot?.parentElement) {
      theaterRoot.parentElement.insertBefore(root, theaterRoot);
      return;
    }
    const setup = document.querySelector(".consultation-app .setup-card");
    const app = setup?.parentElement ?? document.querySelector(".consultation-app");
    if (!app) return;
    if (setup) app.insertBefore(root, setup);
    else app.append(root);
  }, [view]);

  if (!view) return null;
  return (
    <ConflictBoard
      participants={view.participants}
      events={view.events}
      locale={locale}
      compact={view.live}
      archive={view.archive}
      onFocusEvent={focusConsultationEvent}
    />
  );
}

const root = document.getElementById("conflict-board-root");
if (!root) throw new Error("ChatChat Conflict Board root is missing.");
createRoot(root).render(
  <StrictMode>
    <ConflictBoardPortal />
  </StrictMode>,
);
