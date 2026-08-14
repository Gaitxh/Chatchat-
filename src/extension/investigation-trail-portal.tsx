import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConsultationHistoryStore } from "../history/consultation-history.js";
import type { InvestigationTrailEdge } from "../history/investigation-trail.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import { InvestigationTrail } from "./components/InvestigationTrail.js";
import { BrowserInvestigationTrailStore } from "./investigation-trail-store.js";
import { INVESTIGATION_TRAIL_UPDATED_EVENT } from "./investigation-trail-wire.js";

const COMPLETE_EVENT = "chatchat:consultation-complete";
const trailStore = new BrowserInvestigationTrailStore();
const historyStore = new ConsultationHistoryStore();

function InvestigationTrailPortal() {
  const [edges, setEdges] = useState<InvestigationTrailEdge[]>([]);
  const [knownSessionIds, setKnownSessionIds] = useState<Set<string>>(new Set());
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));

  useEffect(() => {
    void refresh();
    const refreshSoon = () => window.setTimeout(() => void refresh(), 40);
    window.addEventListener(INVESTIGATION_TRAIL_UPDATED_EVENT, refreshSoon);
    window.addEventListener(COMPLETE_EVENT, refreshSoon);
    return () => {
      window.removeEventListener(INVESTIGATION_TRAIL_UPDATED_EVENT, refreshSoon);
      window.removeEventListener(COMPLETE_EVENT, refreshSoon);
    };
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => setLocale(normalizeLocale(document.documentElement.lang)));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = document.getElementById("investigation-trail-root");
    if (!root || !edges.length) return;
    const history = document.getElementById("consultation-history-root");
    const receipt = document.getElementById("consultation-receipt-root");
    const setup = document.querySelector(".consultation-app .setup-card");
    const app = history?.parentElement
      ?? receipt?.parentElement
      ?? setup?.parentElement
      ?? document.querySelector(".consultation-app");
    if (!app) return;
    if (history?.parentElement === app) app.insertBefore(root, history);
    else if (receipt?.parentElement === app) app.insertBefore(root, receipt.nextSibling);
    else if (setup?.parentElement === app) app.insertBefore(root, setup);
    else app.append(root);
  }, [edges.length]);

  async function refresh() {
    try {
      const [nextEdges, summaries] = await Promise.all([
        trailStore.list(),
        historyStore.list(24),
      ]);
      setEdges(nextEdges);
      setKnownSessionIds(new Set(summaries.map((item) => item.sessionId)));
    } catch {
      setEdges([]);
      setKnownSessionIds(new Set());
    }
  }

  const known = useMemo(() => knownSessionIds, [knownSessionIds]);
  if (!edges.length) return null;
  return <InvestigationTrail edges={edges} locale={locale} knownSessionIds={known} />;
}

const root = document.getElementById("investigation-trail-root");
if (!root) throw new Error("ChatChat Investigation Trail root is missing.");
createRoot(root).render(
  <StrictMode>
    <InvestigationTrailPortal />
  </StrictMode>,
);
