import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ConsultationHistoryStore,
  type ConsultationHistorySummary,
} from "../history/consultation-history.js";
import type { InvestigationTrailEdge } from "../history/investigation-trail.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import { MeetingIndex } from "./components/MeetingIndex.js";
import { BrowserInvestigationTrailStore } from "./investigation-trail-store.js";
import { INVESTIGATION_TRAIL_UPDATED_EVENT } from "./investigation-trail-wire.js";

const COMPLETE_EVENT = "chatchat:consultation-complete";
const historyStore = new ConsultationHistoryStore();
const trailStore = new BrowserInvestigationTrailStore();

function MeetingIndexPortal() {
  const [items, setItems] = useState<ConsultationHistorySummary[]>([]);
  const [edges, setEdges] = useState<InvestigationTrailEdge[]>([]);
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));

  useEffect(() => {
    void refresh();
    const refreshSoon = () => window.setTimeout(() => void refresh(), 60);
    window.addEventListener(COMPLETE_EVENT, refreshSoon);
    window.addEventListener(INVESTIGATION_TRAIL_UPDATED_EVENT, refreshSoon);

    const historyRoot = document.getElementById("consultation-history-root");
    const observer = historyRoot ? new MutationObserver(refreshSoon) : null;
    observer?.observe(historyRoot!, { childList: true, subtree: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener(COMPLETE_EVENT, refreshSoon);
      window.removeEventListener(INVESTIGATION_TRAIL_UPDATED_EVENT, refreshSoon);
    };
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => setLocale(normalizeLocale(document.documentElement.lang)));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = document.getElementById("meeting-index-root");
    if (!root || !items.length) return;
    const trail = document.getElementById("investigation-trail-root");
    const history = document.getElementById("consultation-history-root");
    const receipt = document.getElementById("consultation-receipt-root");
    const setup = document.querySelector(".consultation-app .setup-card");
    const app = history?.parentElement
      ?? trail?.parentElement
      ?? receipt?.parentElement
      ?? setup?.parentElement
      ?? document.querySelector(".consultation-app");
    if (!app) return;

    if (trail?.parentElement === app) app.insertBefore(root, trail);
    else if (history?.parentElement === app) app.insertBefore(root, history);
    else if (receipt?.parentElement === app) app.insertBefore(root, receipt.nextSibling);
    else if (setup?.parentElement === app) app.insertBefore(root, setup);
    else app.append(root);
  }, [items.length, edges.length]);

  async function refresh() {
    try {
      const [nextItems, nextEdges] = await Promise.all([
        historyStore.list(12),
        trailStore.list(),
      ]);
      setItems(nextItems);
      setEdges(nextEdges);
    } catch {
      setItems([]);
      setEdges([]);
    }
  }

  if (!items.length) return null;
  return <MeetingIndex items={items} trailEdges={edges} locale={locale} />;
}

const root = document.getElementById("meeting-index-root");
if (!root) throw new Error("ChatChat Meeting Index root is missing.");
createRoot(root).render(
  <StrictMode>
    <MeetingIndexPortal />
  </StrictMode>,
);
