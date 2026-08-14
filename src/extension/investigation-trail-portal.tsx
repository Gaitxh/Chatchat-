import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ConsultationHistoryStore } from "../history/consultation-history.js";
import type { InvestigationTrailEdge } from "../history/investigation-trail.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import { InvestigationTrail } from "./components/InvestigationTrail.js";
import { BrowserInvestigationTrailStore } from "./investigation-trail-store.js";
import {
  announceInvestigationTrailUpdated,
  INVESTIGATION_TRAIL_UPDATED_EVENT,
} from "./investigation-trail-wire.js";

const COMPLETE_EVENT = "chatchat:consultation-complete";
const trailStore = new BrowserInvestigationTrailStore();
const historyStore = new ConsultationHistoryStore();

function InvestigationTrailPortal() {
  const [edges, setEdges] = useState<InvestigationTrailEdge[]>([]);
  const [knownSessionIds, setKnownSessionIds] = useState<Set<string>>(new Set());
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));
  const previouslyKnownRef = useRef<Set<string>>(new Set());
  const refreshQueuedRef = useRef(false);

  useEffect(() => {
    void refresh();
    const refreshSoon = () => queueRefresh();
    window.addEventListener(INVESTIGATION_TRAIL_UPDATED_EVENT, refreshSoon);
    window.addEventListener(COMPLETE_EVENT, refreshSoon);

    const historyObserver = new MutationObserver(() => queueRefresh());
    const observeHistory = () => {
      const historyRoot = document.getElementById("consultation-history-root");
      if (!historyRoot) return false;
      historyObserver.observe(historyRoot, { childList: true, subtree: true });
      return true;
    };
    if (!observeHistory()) {
      const pageObserver = new MutationObserver(() => {
        if (observeHistory()) pageObserver.disconnect();
      });
      pageObserver.observe(document.body, { childList: true, subtree: true });
      window.setTimeout(() => pageObserver.disconnect(), 15_000);
    }

    return () => {
      historyObserver.disconnect();
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

  function queueRefresh() {
    if (refreshQueuedRef.current) return;
    refreshQueuedRef.current = true;
    window.setTimeout(() => {
      refreshQueuedRef.current = false;
      void refresh();
    }, 80);
  }

  async function refresh() {
    try {
      const [storedEdges, summaries] = await Promise.all([
        trailStore.list(),
        historyStore.list(24),
      ]);
      const currentKnown = new Set(summaries.map((item) => item.sessionId));
      const lostKnown = [...previouslyKnownRef.current].filter((sessionId) => !currentKnown.has(sessionId));

      let nextEdges = storedEdges;
      if (lostKnown.length) {
        nextEdges = storedEdges.filter(
          (edge) => !lostKnown.includes(edge.parentSessionId) && !lostKnown.includes(edge.childSessionId),
        );
        if (nextEdges.length !== storedEdges.length) {
          await trailStore.replace(nextEdges);
          announceInvestigationTrailUpdated();
        }
      }

      previouslyKnownRef.current = new Set([
        ...previouslyKnownRef.current,
        ...currentKnown,
      ]);
      for (const lost of lostKnown) previouslyKnownRef.current.delete(lost);

      setEdges(nextEdges);
      setKnownSessionIds(currentKnown);
    } catch {
      setEdges([]);
      setKnownSessionIds(new Set());
    }
  }

  if (!edges.length) return null;
  return <InvestigationTrail edges={edges} locale={locale} knownSessionIds={knownSessionIds} />;
}

const root = document.getElementById("investigation-trail-root");
if (!root) throw new Error("ChatChat Investigation Trail root is missing.");
createRoot(root).render(
  <StrictMode>
    <InvestigationTrailPortal />
  </StrictMode>,
);
