import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CouncilEvent, CouncilReport } from "../core/types.js";
import { EvidenceHistoryStore } from "../history/evidence-history.js";
import {
  ConsultationHistoryStore,
  createConsultationArchive,
  type ConsultationArchive,
  type ConsultationHistorySummary,
} from "../history/consultation-history.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import "./consultation-history-portal.css";

const COMPLETE_EVENT = "chatchat:consultation-complete";
export const OPEN_ARCHIVE_EVENT = "chatchat:consultation-open-archive";
const store = new ConsultationHistoryStore();
const evidenceHistory = new EvidenceHistoryStore();

interface CompletionDetail {
  report: CouncilReport;
  events: CouncilEvent[];
}

export interface OpenArchiveDetail {
  archive: ConsultationArchive;
}

interface HistoryCopy {
  eyebrow: string;
  title: string;
  body: string;
  participants: string;
  rounds: string;
  events: string;
  minority: string;
  delete: string;
  clear: string;
  emptyTitle: string;
  emptyBody: string;
  missing: string;
}

const EN: HistoryCopy = {
  eyebrow: "CONSULTATION HISTORY",
  title: "Meetings worth remembering",
  body: "Recent consultations stay in this browser. Open one to replay the same event stream without calling an AI provider again.",
  participants: "participants",
  rounds: "rounds",
  events: "events",
  minority: "minority survives",
  delete: "Delete consultation",
  clear: "Clear local history",
  emptyTitle: "No saved consultation yet",
  emptyBody: "Finish a consultation and ChatChat will archive the structured meeting locally.",
  missing: "This local consultation archive no longer exists.",
};

const ZH: HistoryCopy = {
  eyebrow: "协商记录",
  title: "值得记住的会议",
  body: "最近的协商只保存在这个浏览器里。打开旧记录可以直接回放同一条事件流，不会再次调用任何 AI。",
  participants: "位参与者",
  rounds: "轮",
  events: "个事件",
  minority: "少数意见保留",
  delete: "删除这场协商",
  clear: "清空本地记录",
  emptyTitle: "还没有保存过协商",
  emptyBody: "完成第一场协商后，ChatChat 会把结构化会议记录保存在本机浏览器。",
  missing: "这条本地协商记录已经不存在。",
};

function ConsultationHistoryPortal() {
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));
  const [items, setItems] = useState<ConsultationHistorySummary[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const copy = useMemo(() => (locale === "zh-CN" ? ZH : EN), [locale]);

  useEffect(() => {
    void refresh();
    const languageObserver = new MutationObserver(() => {
      setLocale(normalizeLocale(document.documentElement.lang));
    });
    languageObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });

    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<CompletionDetail>).detail;
      if (!detail?.report || !Array.isArray(detail.events)) return;
      void saveCompleted(detail.report, detail.events);
    };
    window.addEventListener(COMPLETE_EVENT, onComplete);
    return () => {
      languageObserver.disconnect();
      window.removeEventListener(COMPLETE_EVENT, onComplete);
    };
  }, []);

  useEffect(() => {
    const root = document.getElementById("consultation-history-root");
    const setup = document.querySelector(".consultation-app .setup-card");
    const app = setup?.parentElement ?? document.querySelector(".consultation-app");
    if (!root || !app) return;
    if (setup) app.insertBefore(root, setup);
    else app.append(root);
  }, [items.length]);

  async function refresh() {
    try {
      setError(null);
      setItems(await store.list(12));
    } catch (caught) {
      setError(message(caught));
    }
  }

  async function saveCompleted(report: CouncilReport, events: CouncilEvent[]) {
    try {
      await store.save(createConsultationArchive(report, events));
      await refresh();
    } catch (caught) {
      setError(message(caught));
    }
  }

  async function openArchive(sessionId: string) {
    setBusy(`open:${sessionId}`);
    setError(null);
    try {
      const archive = await store.load(sessionId);
      if (!archive) throw new Error(copy.missing);
      setOpenSessionId(sessionId);
      window.dispatchEvent(new CustomEvent<OpenArchiveDetail>(OPEN_ARCHIVE_EVENT, {
        detail: { archive },
      }));
      window.setTimeout(() => {
        document.querySelector(".consultation-theater")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  async function remove(sessionId: string) {
    setBusy(`delete:${sessionId}`);
    setError(null);
    try {
      await Promise.all([store.delete(sessionId), evidenceHistory.delete(sessionId)]);
      if (openSessionId === sessionId) setOpenSessionId(null);
      await refresh();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  async function clearAll() {
    if (!items.length) return;
    setBusy("clear");
    setError(null);
    try {
      await Promise.all([store.clear(), evidenceHistory.clear()]);
      setOpenSessionId(null);
      await refresh();
    } catch (caught) {
      setError(message(caught));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="consultation-history">
      <header className="history-heading">
        <div>
          <span>{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.body}</p>
        </div>
        <div className="history-local-badge">INDEXEDDB · LOCAL</div>
      </header>

      {error ? <p className="history-error">{error}</p> : null}

      {items.length ? (
        <div className="history-list">
          {items.map((item, index) => (
            <article className={`history-entry ${openSessionId === item.sessionId ? "is-open" : ""}`} key={item.sessionId}>
              <button className="history-entry-main" type="button" onClick={() => void openArchive(item.sessionId)} disabled={Boolean(busy)}>
                <b>{String(index + 1).padStart(2, "0")}</b>
                <div>
                  <strong>{item.proposalPreview}</strong>
                  <span>{formatDate(item.createdAt, locale)} · {item.participantCount} {copy.participants} · {item.rounds} {copy.rounds}</span>
                  <small>
                    {item.eventCount} {copy.events}
                    {item.revisionCount ? ` · ↻ ${item.revisionCount}` : ""}
                    {item.evidenceCount ? ` · 📎 ${item.evidenceCount}` : ""}
                    {item.minoritySurvives ? ` · ${copy.minority}` : ""}
                  </small>
                </div>
                <em>{Math.round(item.consensusRatio * 100)}%</em>
              </button>
              <button className="history-delete" type="button" onClick={() => void remove(item.sessionId)} disabled={Boolean(busy)} aria-label={copy.delete}>×</button>
            </article>
          ))}
          <button className="history-clear" type="button" onClick={() => void clearAll()} disabled={Boolean(busy)}>{copy.clear}</button>
        </div>
      ) : (
        <div className="history-empty">
          <b>↺</b><strong>{copy.emptyTitle}</strong><p>{copy.emptyBody}</p>
        </div>
      )}
    </section>
  );
}

function formatDate(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function message(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

const root = document.getElementById("consultation-history-root");
if (!root) throw new Error("ChatChat Consultation History root is missing.");
createRoot(root).render(
  <StrictMode>
    <ConsultationHistoryPortal />
  </StrictMode>,
);
