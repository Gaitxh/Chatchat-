import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CouncilEvent, CouncilReport } from "../core/types.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import { RelationshipMap } from "./components/RelationshipMap.js";

const COMPLETE_EVENT = "chatchat:consultation-complete";

interface CompletionDetail {
  report: CouncilReport;
  events: CouncilEvent[];
}

function RelationshipSummaryPortal() {
  const [completion, setCompletion] = useState<CompletionDetail | null>(null);
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));

  useEffect(() => {
    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<CompletionDetail>).detail;
      if (!detail?.report || !Array.isArray(detail.events)) return;
      setCompletion({ report: detail.report, events: [...detail.events] });
    };
    window.addEventListener(COMPLETE_EVENT, onComplete);
    const languageObserver = new MutationObserver(() => setLocale(normalizeLocale(document.documentElement.lang)));
    languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => {
      window.removeEventListener(COMPLETE_EVENT, onComplete);
      languageObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!completion) return;
    const root = document.getElementById("relationship-summary-root");
    const theater = document.getElementById("consultation-theater-root");
    const app = theater?.parentElement ?? document.querySelector(".consultation-app");
    if (!root || !app) return;
    if (theater && theater.parentElement === app) app.insertBefore(root, theater);
    else app.append(root);
  }, [completion]);

  if (!completion) return null;
  const participants = completion.report.positions.map((position) => ({
    id: position.participant.id,
    name: position.participant.name,
  }));

  return (
    <section className="consultation-card relationship-summary-card">
      <RelationshipMap participants={participants} events={completion.events} locale={locale} />
    </section>
  );
}

if (document.documentElement.dataset.surface === "web-app") {
  const root = document.getElementById("relationship-summary-root");
  if (!root) throw new Error("ChatChat relationship summary root is missing.");
  createRoot(root).render(<StrictMode><RelationshipSummaryPortal /></StrictMode>);
}
