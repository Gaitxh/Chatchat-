import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CouncilEvent, CouncilParticipant, CouncilReport } from "../core/types.js";
import { deriveEvidenceLedger, type EvidenceRecord } from "../evidence/evidence-ledger.js";
import { sourceAgeDays, type EvidenceSourceObservation } from "../evidence/source-metadata.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import "./source-observation-portal.css";

declare const chrome: any;

const LIVE_EVENT = "chatchat:consultation-live";
const COMPLETE_EVENT = "chatchat:consultation-complete";
const STORAGE_KEY = "chatchat.evidence.verifications.v1";

interface LiveDetail { participants: CouncilParticipant[]; events: CouncilEvent[]; }
interface CompleteDetail { report: CouncilReport; events: CouncilEvent[]; }
interface ObservationCandidate { record: EvidenceRecord; observation: EvidenceSourceObservation | undefined; }
interface VisibleObservation { record: EvidenceRecord; observation: EvidenceSourceObservation; }

function SourceObservationPortal() {
  const [live, setLive] = useState<LiveDetail | null>(null);
  const [completion, setCompletion] = useState<CompleteDetail | null>(null);
  const [observations, setObservations] = useState<Record<string, EvidenceSourceObservation>>({});
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));

  useEffect(() => {
    void reloadObservations();
    const onLive = (event: Event) => {
      const detail = (event as CustomEvent<LiveDetail>).detail;
      if (Array.isArray(detail?.participants) && Array.isArray(detail?.events)) {
        setLive({ participants: [...detail.participants], events: [...detail.events] });
      }
    };
    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<CompleteDetail>).detail;
      if (detail?.report && Array.isArray(detail.events)) {
        setCompletion({ report: detail.report, events: [...detail.events] });
      }
    };
    const onStorage = (changes: Record<string, { newValue?: unknown }>) => {
      if (!changes[STORAGE_KEY]) return;
      setObservations(normalizeObservationMap(changes[STORAGE_KEY].newValue));
    };
    window.addEventListener(LIVE_EVENT, onLive);
    window.addEventListener(COMPLETE_EVENT, onComplete);
    chrome.storage?.onChanged?.addListener(onStorage);
    return () => {
      window.removeEventListener(LIVE_EVENT, onLive);
      window.removeEventListener(COMPLETE_EVENT, onComplete);
      chrome.storage?.onChanged?.removeListener(onStorage);
    };
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => setLocale(normalizeLocale(document.documentElement.lang)));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

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
  }, [live?.events.length, completion?.events.length]);

  async function reloadObservations() {
    const store = chrome.storage.session ?? chrome.storage.local;
    const value = await store.get(STORAGE_KEY);
    setObservations(normalizeObservationMap(value[STORAGE_KEY]));
  }

  const data = completion
    ? { participants: completion.report.positions.map((position) => position.participant), events: completion.events }
    : live;
  const records = useMemo(
    () => data ? deriveEvidenceLedger(data.participants, data.events) : [],
    [data?.events, data?.participants],
  );
  const candidates: ObservationCandidate[] = records.map((record) => ({
    record,
    observation: observations[record.evidenceEventId],
  }));
  const visible = candidates.filter(isVisibleObservation);

  if (!visible.length) return null;
  const zh = locale === "zh-CN";

  return (
    <section className="source-observation-board">
      <header>
        <div>
          <span>{zh ? "来源观察" : "SOURCE OBSERVATION"}</span>
          <h3>{zh ? "页面实际留下了什么？" : "What did the page actually expose?"}</h3>
          <p>{zh ? "这些是 ChatChat 在有限、无凭证的读取中观察到的页面数据，不是对主张真伪的裁决。" : "These are bounded, credential-free page observations. They are not a verdict on whether a claim is true."}</p>
        </div>
        <b>STATIC · BOUNDED · LOCAL</b>
      </header>
      <div className="source-observation-list">
        {visible.map(({ record, observation }) => {
          const ageDays = sourceAgeDays(observation.pageDate, observation.observedAt);
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
                {observation.pageDate ? (
                  <div><dt>{zh ? "页面日期信号" : "PAGE DATE SIGNAL"}</dt><dd>{observation.pageDate}<small>{dateKind(observation.pageDateKind, locale)}</small></dd></div>
                ) : null}
                {ageDays !== null ? (
                  <div><dt>{zh ? "日期距离" : "AGE SIGNAL"}</dt><dd>{ageDays} {zh ? "天" : "days"}<small>{zh ? "不自动判定“过时”" : "not automatically stale"}</small></dd></div>
                ) : null}
                {observation.bodyHash ? (
                  <div><dt>{zh ? "内容指纹" : "CONTENT FINGERPRINT"}</dt><dd><code>{observation.bodyHash}</code></dd></div>
                ) : null}
                {typeof observation.textCharacters === "number" ? (
                  <div><dt>{zh ? "可读文本规模" : "READABLE TEXT"}</dt><dd>{observation.textCharacters.toLocaleString()} {zh ? "字符" : "characters"}</dd></div>
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

if (document.documentElement.dataset.surface === "web-app") {
  const root = document.getElementById("source-observation-root");
  if (!root) throw new Error("ChatChat Source Observation root is missing.");
  createRoot(root).render(<StrictMode><SourceObservationPortal /></StrictMode>);
}
