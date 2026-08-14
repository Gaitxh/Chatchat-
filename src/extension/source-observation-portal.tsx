import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CouncilEvent, CouncilParticipant, CouncilReport } from "../core/types.js";
import {
  deriveEvidenceLedger,
  EVIDENCE_VERIFICATIONS_STORAGE_KEY,
  type EvidenceRecord,
} from "../evidence/evidence-ledger.js";
import { sourceAgeDays, type EvidenceSourceObservation } from "../evidence/source-metadata.js";
import { EvidenceHistoryStore } from "../history/evidence-history.js";
import type { ConsultationArchive } from "../history/consultation-history.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import "./source-observation-portal.css";

declare const chrome: any;

const LIVE_EVENT = "chatchat:consultation-live";
const COMPLETE_EVENT = "chatchat:consultation-complete";
const OPEN_ARCHIVE_EVENT = "chatchat:consultation-open-archive";
const evidenceHistory = new EvidenceHistoryStore();

interface LiveDetail { participants: CouncilParticipant[]; events: CouncilEvent[]; }
interface CompleteDetail { report: CouncilReport; events: CouncilEvent[]; }
interface ArchiveDetail { archive: ConsultationArchive; }
interface ObservationCandidate { record: EvidenceRecord; observation: EvidenceSourceObservation | undefined; }
interface VisibleObservation { record: EvidenceRecord; observation: EvidenceSourceObservation; }

function SourceObservationPortal() {
  const [live, setLive] = useState<LiveDetail | null>(null);
  const [completion, setCompletion] = useState<CompleteDetail | null>(null);
  const [archive, setArchive] = useState<ConsultationArchive | null>(null);
  const [observations, setObservations] = useState<Record<string, EvidenceSourceObservation>>({});
  const [archiveObservations, setArchiveObservations] = useState<Record<string, EvidenceSourceObservation>>({});
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));

  useEffect(() => {
    void reloadObservations();
    const onLive = (event: Event) => {
      const detail = (event as CustomEvent<LiveDetail>).detail;
      if (Array.isArray(detail?.participants) && Array.isArray(detail?.events)) {
        setArchive(null);
        setLive({ participants: [...detail.participants], events: [...detail.events] });
      }
    };
    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<CompleteDetail>).detail;
      if (detail?.report && Array.isArray(detail.events)) {
        setArchive(null);
        setCompletion({ report: detail.report, events: [...detail.events] });
      }
    };
    const onArchive = (event: Event) => {
      const detail = (event as CustomEvent<ArchiveDetail>).detail;
      if (!detail?.archive) return;
      setArchive(detail.archive);
      setLive(null);
      setCompletion(null);
      void evidenceHistory.load(detail.archive.sessionId).then((saved) => {
        setArchiveObservations(saved?.verifications ?? {});
      }).catch(() => setArchiveObservations({}));
    };
    const onStorage = (changes: Record<string, { newValue?: unknown }>) => {
      if (!changes[EVIDENCE_VERIFICATIONS_STORAGE_KEY]) return;
      setObservations(normalizeObservationMap(changes[EVIDENCE_VERIFICATIONS_STORAGE_KEY].newValue));
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
    if (!completion) return;
    const frozen = relevantObservations(completion.events, observations);
    if (!Object.keys(frozen).length) return;
    void evidenceHistory.save(completion.report.sessionId, frozen).catch(() => {
      // History sidecars are useful but must never interrupt the consultation UI.
    });
  }, [completion, observations]);

  useEffect(() => {
    const root = document.getElementById("source-observation-root");
    const evidence = document.getElementById("evidence-root");
    const history = document.getElementById("consultation-history-root");
    const app = evidence?.parentElement ?? history?.parentElement ?? document.querySelector(".consultation-app");
    if (!root || !app) return;
    if (evidence && evidence.parentElement === app) {
      app.insertBefore(root, evidence.nextSibling);
    } else if (history && history.parentElement === app) {
      app.insertBefore(root, history);
    } else {
      app.append(root);
    }
  }, [live?.events.length, completion?.events.length, archive?.sessionId]);

  async function reloadObservations() {
    const store = chrome.storage.session ?? chrome.storage.local;
    const value = await store.get(EVIDENCE_VERIFICATIONS_STORAGE_KEY);
    setObservations(normalizeObservationMap(value[EVIDENCE_VERIFICATIONS_STORAGE_KEY]));
  }

  const data = archive
    ? { participants: archive.report.positions.map((position) => position.participant), events: archive.events }
    : completion
      ? { participants: completion.report.positions.map((position) => position.participant), events: completion.events }
      : live;
  const observationMap = archive ? archiveObservations : observations;
  const records = useMemo(
    () => data ? deriveEvidenceLedger(data.participants, data.events) : [],
    [data?.events, data?.participants],
  );
  const candidates: ObservationCandidate[] = records.map((record) => ({
    record,
    observation: observationMap[record.evidenceEventId],
  }));
  const visible = candidates.filter(isVisibleObservation);

  if (!visible.length) return null;
  const zh = locale === "zh-CN";

  return (
    <section className={`source-observation-board ${archive ? "is-archive" : ""}`}>
      <header>
        <div>
          <span>{zh ? "来源观察" : "SOURCE OBSERVATION"}</span>
          <h3>{zh ? "页面实际留下了什么？" : "What did the page actually expose?"}</h3>
          <p>{archive
            ? (zh ? "这是这场历史协商当时冻结的来源观察快照。回放不会重新联网，也不会用今天的页面改写过去。" : "This is the source-observation snapshot frozen with the historical consultation. Replay makes no network request and does not rewrite the past with today's page.")
            : (zh ? "这些是 ChatChat 在有限、无凭证的读取中观察到的页面数据，不是对主张真伪的裁决。" : "These are bounded, credential-free page observations. They are not a verdict on whether a claim is true.")}
          </p>
        </div>
        <b>{archive ? (zh ? "历史快照 · 零网络" : "ARCHIVE · ZERO NETWORK") : "STATIC · BOUNDED · LOCAL"}</b>
      </header>
      <div className="source-observation-list">
        {visible.map(({ record, observation }) => {
          const ageDays = sourceAgeDays(observation.pageDate ?? record.sourceDate, observation.observedAt);
          return (
            <article key={record.evidenceEventId}>
              <div className="source-observation-title">
                <strong>{record.sourceHost ?? record.claim}</strong>
                <span>{record.actorName} · R{record.round}</span>
              </div>
              {observation.title ? <h4>{observation.title}</h4> : null}
              {observation.description ? <p className="source-description">{observation.description}</p> : null}
              {observation.excerpt ? <blockquote>{observation.excerpt}</blockquote> : null}
              <dl>
                {(observation.pageDate ?? record.sourceDate) ? (
                  <div><dt>{zh ? "页面 / 来源日期" : "PAGE / SOURCE DATE"}</dt><dd>{observation.pageDate ?? record.sourceDate}<small>{dateKind(observation.pageDateKind, locale)}</small></dd></div>
                ) : null}
                {ageDays !== null ? (
                  <div><dt>{zh ? "年龄信号" : "AGE SIGNAL"}</dt><dd>{ageDays} {zh ? "天" : "days"}<small>{zh ? "中性信号 · 不自动判定“过时”" : "neutral signal · not automatically stale"}</small></dd></div>
                ) : null}
                {observation.bodyHash ? (
                  <div><dt>{zh ? "内容指纹" : "CONTENT FINGERPRINT"}</dt><dd><code>{observation.bodyHash}</code></dd></div>
                ) : null}
                {typeof observation.textCharacters === "number" ? (
                  <div><dt>{zh ? "可读文本规模" : "READABLE TEXT"}</dt><dd>{observation.textCharacters.toLocaleString()} {zh ? "字符" : "characters"}<small>{observation.truncated ? (zh ? "读取已按安全预算截断" : "bounded by safety budget") : ""}</small></dd></div>
                ) : null}
              </dl>
              <small className="source-observed-at">{zh ? "观察于" : "Observed"} {formatTime(observation.observedAt, locale)}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function relevantObservations(
  events: readonly CouncilEvent[],
  observations: Readonly<Record<string, EvidenceSourceObservation>>,
): Record<string, EvidenceSourceObservation> {
  const ids = new Set(events.filter((event) => event.kind === "evidence").map((event) => event.id));
  return Object.fromEntries(
    Object.entries(observations).filter(([eventId]) => ids.has(eventId)),
  );
}

function normalizeObservationMap(value: unknown): Record<string, EvidenceSourceObservation> {
  return value && typeof value === "object" ? value as Record<string, EvidenceSourceObservation> : {};
}

function hasObservationDetail(observation: EvidenceSourceObservation | undefined): observation is EvidenceSourceObservation {
  return Boolean(
    observation?.state === "reachable" &&
    (observation.description || observation.excerpt || observation.pageDate || observation.bodyHash || observation.textCharacters),
  );
}

function isVisibleObservation(candidate: ObservationCandidate): candidate is VisibleObservation {
  return hasObservationDetail(candidate.observation);
}

function dateKind(kind: EvidenceSourceObservation["pageDateKind"], locale: Locale): string {
  const zh = locale === "zh-CN";
  if (kind === "published") return zh ? "发布信号" : "published signal";
  if (kind === "modified") return zh ? "修改信号" : "modified signal";
  return zh ? "页面日期信号" : "page date signal";
}

function formatTime(value: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return value;
  }
}

const root = document.getElementById("source-observation-root");
if (root) {
  createRoot(root).render(<StrictMode><SourceObservationPortal /></StrictMode>);
}
