import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CouncilEvent, CouncilReport } from "../core/types.js";
import {
  deriveEvidenceLedger,
  EVIDENCE_VERIFICATIONS_STORAGE_KEY,
  type EvidenceVerificationSnapshot,
} from "../evidence/evidence-ledger.js";
import { EvidenceHistoryStore } from "../history/evidence-history.js";
import {
  ConsultationHistoryStore,
  createConsultationArchive,
  type ConsultationArchive,
  type ConsultationHistorySummary,
} from "../history/consultation-history.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import "./consultation-history-portal.css";

declare const chrome: any;

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

interface HistoryStoryStats {
  challenges: number;
  observedEvidence: number;
  reachableEvidence: number;
  disputedEvidence: number;
  influentialEvidence: number;
}

interface HistoryCopy {
  eyebrow: string;
  title: string;
  body: string;
  participants: string;
  rounds: string;
  events: string;
  minority: string;
  evidence: string;
  observed: string;
  challenged: string;
  influenced: string;
  delete: string;
  clear: string;
  emptyTitle: string;
  emptyBody: string;
  missing: string;
}

const EN: HistoryCopy = {
  eyebrow: "CONSULTATION HISTORY",
  title: "Meetings worth replaying",
  body: "Recent consultations stay in this browser as event-backed meeting cards. Open one to replay the room exactly as it was — including frozen evidence observations — without calling an AI provider again.",
  participants: "participants",
  rounds: "rounds",
  events: "events",
  minority: "minority survives",
  evidence: "evidence",
  observed: "observed",
  challenged: "challenges",
  influenced: "evidence → revision",
  delete: "Delete consultation",
  clear: "Clear local history",
  emptyTitle: "No saved consultation yet",
  emptyBody: "Finish a consultation and ChatChat will archive the structured meeting locally.",
  missing: "This local consultation archive no longer exists.",
};

const ZH: HistoryCopy = {
  eyebrow: "协商记录",
  title: "值得重新播放的会议",
  body: "最近的协商会以“会议录像卡”的方式留在这个浏览器里。打开旧记录可以回放当时的事件与冻结证据观察，不会再次调用任何 AI。",
  participants: "位参与者",
  rounds: "轮",
  events: "个事件",
  minority: "少数意见保留",
  evidence: "条证据",
  observed: "来源已观察",
  challenged: "次质疑",
  influenced: "证据促成改口",
  delete: "删除这场协商",
  clear: "清空本地记录",
  emptyTitle: "还没有保存过协商",
  emptyBody: "完成第一场协商后，ChatChat 会把结构化会议记录保存在本机浏览器。",
  missing: "这条本地协商记录已经不存在。",
};

function ConsultationHistoryPortal() {
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));
  const [items, setItems] = useState<ConsultationHistorySummary[]>([]);
  const [storyStats, setStoryStats] = useState<Record<string, HistoryStoryStats>>({});
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
      const summaries = await store.list(12);
      setItems(summaries);
      const entries = await Promise.all(
        summaries.map(async (summary) => {
          try {
            const [archive, evidenceArchive] = await Promise.all([
              store.load(summary.sessionId),
              evidenceHistory.load(summary.sessionId),
            ]);
            if (!archive) return [summary.sessionId, emptyStoryStats()] as const;
            return [
              summary.sessionId,
              deriveStoryStats(archive, evidenceArchive?.verifications ?? {}),
            ] as const;
          } catch {
            return [summary.sessionId, emptyStoryStats()] as const;
          }
        }),
      );
      setStoryStats(Object.fromEntries(entries));
    } catch (caught) {
      setError(message(caught));
    }
  }

  async function saveCompleted(report: CouncilReport, events: CouncilEvent[]) {
    try {
      const evidenceSnapshot = await currentEvidenceSnapshot(events);
      await Promise.all([
        store.save(createConsultationArchive(report, events)),
        evidenceHistory.save(report.sessionId, evidenceSnapshot),
      ]);
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
          {items.map((item, index) => {
            const story = storyStats[item.sessionId] ?? emptyStoryStats();
            return (
              <article className={`history-entry ${openSessionId === item.sessionId ? "is-open" : ""}`} key={item.sessionId}>
                <button className="history-entry-main" type="button" onClick={() => void openArchive(item.sessionId)} disabled={Boolean(busy)}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <div>
                    <strong>{item.proposalPreview}</strong>
                    <span>{formatDate(item.createdAt, locale)} · {item.participantCount} {copy.participants} · {item.rounds} {copy.rounds}</span>
                    <div className="history-story-pills">
                      {item.evidenceCount ? <i>📎 {item.evidenceCount} {copy.evidence}</i> : null}
                      {story.observedEvidence ? <i>👁 {story.observedEvidence} {copy.observed}</i> : null}
                      {story.challenges ? <i>⚔ {story.challenges} {copy.challenged}</i> : null}
                      {item.revisionCount ? <i>↻ {item.revisionCount}</i> : null}
                      {story.influentialEvidence ? <i>🧾 {story.influentialEvidence} {copy.influenced}</i> : null}
                      {item.minoritySurvives ? <i>🧍 {copy.minority}</i> : null}
                    </div>
                    <small>{item.eventCount} {copy.events}{story.reachableEvidence ? ` · ✓ ${story.reachableEvidence}` : ""}{story.disputedEvidence ? ` · ⚠ ${story.disputedEvidence}` : ""}</small>
                  </div>
                  <em>{Math.round(item.consensusRatio * 100)}%</em>
                </button>
                <button className="history-delete" type="button" onClick={() => void remove(item.sessionId)} disabled={Boolean(busy)} aria-label={copy.delete}>×</button>
              </article>
            );
          })}
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

async function currentEvidenceSnapshot(
  events: readonly CouncilEvent[],
): Promise<Record<string, EvidenceVerificationSnapshot>> {
  if (typeof chrome === "undefined" || !chrome.storage) return {};
  const storeArea = chrome.storage.session ?? chrome.storage.local;
  const stored = await storeArea.get(EVIDENCE_VERIFICATIONS_STORAGE_KEY);
  const all = normalizeVerifications(stored[EVIDENCE_VERIFICATIONS_STORAGE_KEY]);
  const eventIds = new Set(events.filter((event) => event.kind === "evidence").map((event) => event.id));
  return Object.fromEntries(Object.entries(all).filter(([eventId]) => eventIds.has(eventId)));
}

function deriveStoryStats(
  archive: ConsultationArchive,
  verifications: Readonly<Record<string, EvidenceVerificationSnapshot>>,
): HistoryStoryStats {
  const evidence = deriveEvidenceLedger(
    archive.report.positions.map((position) => position.participant),
    archive.events,
  );
  return {
    challenges: archive.events.filter((event) => event.kind === "challenge").length,
    observedEvidence: evidence.filter((record) => Boolean(verifications[record.evidenceEventId])).length,
    reachableEvidence: evidence.filter((record) => verifications[record.evidenceEventId]?.state === "reachable").length,
    disputedEvidence: evidence.filter((record) => record.challengeEventIds.length > 0).length,
    influentialEvidence: evidence.filter((record) => record.downstreamRevisionEventIds.length > 0).length,
  };
}

function emptyStoryStats(): HistoryStoryStats {
  return {
    challenges: 0,
    observedEvidence: 0,
    reachableEvidence: 0,
    disputedEvidence: 0,
    influentialEvidence: 0,
  };
}

function normalizeVerifications(value: unknown): Record<string, EvidenceVerificationSnapshot> {
  return value && typeof value === "object"
    ? value as Record<string, EvidenceVerificationSnapshot>
    : {};
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
