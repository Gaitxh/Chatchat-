import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CouncilEvent, CouncilParticipant, CouncilReport } from "../core/types.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import { EvidenceBoard } from "./components/EvidenceBoard.js";

const LIVE_EVENT = "chatchat:consultation-live";
const COMPLETE_EVENT = "chatchat:consultation-complete";
interface LiveDetail { participants: CouncilParticipant[]; events: CouncilEvent[]; }
interface CompleteDetail { report: CouncilReport; events: CouncilEvent[]; }

function EvidencePortal() {
  const [live, setLive] = useState<LiveDetail | null>(null);
  const [completion, setCompletion] = useState<CompleteDetail | null>(null);
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));

  useEffect(() => {
    const onLive = (event: Event) => {
      const detail = (event as CustomEvent<LiveDetail>).detail;
      if (Array.isArray(detail?.participants) && Array.isArray(detail?.events)) setLive({ participants: [...detail.participants], events: [...detail.events] });
    };
    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<CompleteDetail>).detail;
      if (detail?.report && Array.isArray(detail.events)) setCompletion({ report: detail.report, events: [...detail.events] });
    };
    window.addEventListener(LIVE_EVENT, onLive);
    window.addEventListener(COMPLETE_EVENT, onComplete);
    return () => { window.removeEventListener(LIVE_EVENT, onLive); window.removeEventListener(COMPLETE_EVENT, onComplete); };
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => setLocale(normalizeLocale(document.documentElement.lang)));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = document.getElementById("evidence-root");
    if (!root) return;
    if (completion) {
      const setup = document.querySelector(".consultation-app .setup-card");
      const app = setup?.parentElement ?? document.querySelector(".consultation-app");
      if (!app) return;
      if (setup) app.insertBefore(root, setup); else app.append(root);
    } else if (live?.events.some((event) => event.kind === "evidence")) {
      const room = document.querySelector(".consultation-app .live-room-card");
      if (room && root.parentElement !== room) room.append(root);
    }
  }, [completion, live?.events]);

  if (completion) return <EvidenceBoard participants={completion.report.positions.map((p) => p.participant)} events={completion.events} locale={locale} />;
  if (!live?.events.some((event) => event.kind === "evidence")) return null;
  return <EvidenceBoard participants={live.participants} events={live.events} locale={locale} />;
}

const root = document.getElementById("evidence-root");
if (!root) throw new Error("ChatChat evidence root is missing.");
createRoot(root).render(<StrictMode><EvidencePortal /></StrictMode>);
