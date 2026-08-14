import { useEffect, useMemo, useState } from "react";
import type { CouncilEvent, CouncilParticipant } from "../../core/types.js";
import type { Locale } from "../../i18n/index.js";
import {
  deriveEvidenceLedger,
  evidenceDisplayState,
  EVIDENCE_VERIFICATIONS_STORAGE_KEY,
  type EvidenceRecord,
  type EvidenceVerificationSnapshot,
} from "../../evidence/evidence-ledger.js";
import { focusConsultationEvent } from "../provenance-wire.js";
import { EvidenceGapRadar } from "./EvidenceGapRadar.js";
import "./evidence-board.css";

declare const chrome: any;

interface EvidenceBoardProps {
  participants: readonly CouncilParticipant[];
  events: readonly CouncilEvent[];
  locale: Locale;
  verificationSnapshot?: Readonly<Record<string, EvidenceVerificationSnapshot>>;
  readOnly?: boolean;
}

const COPY = {
  en: {
    kicker: "EVIDENCE LEDGER",
    title: "Receipts, not vibes",
    body: "ChatChat separates three facts: a model supplied a source, the source was reachable when checked, and other AIs may still dispute what it proves.",
    archive: "ARCHIVE SNAPSHOT",
    checkAll: "Check public sources",
    checking: "Checking…",
    none: "No structured evidence has been submitted yet.",
    source: "SOURCE",
    sourceDate: "SOURCE DATE",
    observed: "CHECKED",
    submittedBy: "SUBMITTED BY",
    noDate: "not supplied",
    noSafeUrl: "no safe http(s) source",
    unchecked: "NOT CHECKED",
    reachable: "REACHABLE",
    unavailable: "UNAVAILABLE",
    unsupported: "NO SAFE URL",
    disputed: "DISPUTED",
    changedMind: "CHANGED A VIEW",
    openSource: "Open source",
    checkSource: "Check source",
    note: "Reachable means the public URL answered ChatChat's bounded fetch. It does not mean the claim is true.",
    archiveNote: "Archive replay uses the evidence state frozen with that consultation. It makes no source-check request.",
    permissionDenied: "Source access was not granted.",
  },
  "zh-CN": {
    kicker: "证据账本",
    title: "有票据，不靠气氛",
    body: "ChatChat 会严格分开三件事：模型给了一个来源、这个来源在检查时能访问、以及其他 AI 仍然可以质疑它到底证明了什么。",
    archive: "历史快照",
    checkAll: "检查公开来源",
    checking: "检查中…",
    none: "目前还没有参与者提交结构化证据。",
    source: "来源",
    sourceDate: "来源日期",
    observed: "检查时间",
    submittedBy: "提交者",
    noDate: "未提供",
    noSafeUrl: "没有安全的 http(s) 来源",
    unchecked: "尚未检查",
    reachable: "来源可达",
    unavailable: "无法访问",
    unsupported: "无安全链接",
    disputed: "存在质疑",
    changedMind: "触发改口",
    openSource: "打开来源",
    checkSource: "检查来源",
    note: "“来源可达”只表示这个公开 URL 回应了 ChatChat 的有限检查，不代表主张已经被证明。",
    archiveNote: "历史回放只读取这场协商当时冻结的证据状态，不会重新请求来源。",
    permissionDenied: "没有获得这个来源的网站访问权限。",
  },
} as const;

export function EvidenceBoard({
  participants,
  events,
  locale,
  verificationSnapshot,
  readOnly = false,
}: EvidenceBoardProps) {
  const copy = COPY[locale];
  const records = useMemo(() => deriveEvidenceLedger(participants, events), [participants, events]);
  const [verifications, setVerifications] = useState<Record<string, EvidenceVerificationSnapshot>>(
    () => ({ ...(verificationSnapshot ?? {}) }),
  );
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (verificationSnapshot) {
      setVerifications({ ...verificationSnapshot });
      return;
    }
    const store = chrome.storage.session ?? chrome.storage.local;
    void store.get(EVIDENCE_VERIFICATIONS_STORAGE_KEY).then((value: Record<string, unknown>) => {
      setVerifications(normalizeVerifications(value[EVIDENCE_VERIFICATIONS_STORAGE_KEY]));
    });
    const onStorage = (changes: Record<string, { newValue?: unknown }>) => {
      if (!changes[EVIDENCE_VERIFICATIONS_STORAGE_KEY]) return;
      setVerifications(normalizeVerifications(changes[EVIDENCE_VERIFICATIONS_STORAGE_KEY].newValue));
    };
    chrome.storage?.onChanged?.addListener(onStorage);
    return () => chrome.storage?.onChanged?.removeListener(onStorage);
  }, [verificationSnapshot]);

  async function checkRecord(record: EvidenceRecord) {
    if (readOnly || !record.sourceUrl || busyIds.has(record.evidenceEventId)) return;
    setError(null);
    setBusyIds((current) => new Set(current).add(record.evidenceEventId));
    try {
      const granted = await ensureSourcePermissions([record.sourceUrl]);
      if (!granted) throw new Error(copy.permissionDenied);
      const verification = await requestVerification(record.sourceUrl);
      await saveVerification(record.evidenceEventId, verification);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(record.evidenceEventId);
        return next;
      });
    }
  }

  async function checkAll() {
    if (readOnly) return;
    const checkable = records.filter((record) => record.sourceUrl && !busyIds.has(record.evidenceEventId));
    if (!checkable.length) return;
    setError(null);
    setBusyIds(new Set(checkable.map((record) => record.evidenceEventId)));
    try {
      const urls = checkable.map((record) => record.sourceUrl!);
      const granted = await ensureSourcePermissions(urls);
      if (!granted) throw new Error(copy.permissionDenied);
      for (const record of checkable) {
        const verification = await requestVerification(record.sourceUrl!);
        await saveVerification(record.evidenceEventId, verification);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusyIds(new Set());
    }
  }

  async function saveVerification(eventId: string, verification: EvidenceVerificationSnapshot) {
    const store = chrome.storage.session ?? chrome.storage.local;
    const existing = await store.get(EVIDENCE_VERIFICATIONS_STORAGE_KEY);
    const next = {
      ...normalizeVerifications(existing[EVIDENCE_VERIFICATIONS_STORAGE_KEY]),
      [eventId]: verification,
    };
    await store.set({ [EVIDENCE_VERIFICATIONS_STORAGE_KEY]: next });
    setVerifications(next);
  }

  return (
    <>
      <section className={`evidence-board ${readOnly ? "is-archive" : ""}`}>
        <div className="evidence-board__heading">
          <div><span>{copy.kicker}</span><h3>{copy.title}</h3><p>{copy.body}</p></div>
          {readOnly ? <b className="evidence-archive-badge">{copy.archive}</b> : records.some((record) => record.sourceUrl) ? (
            <button type="button" onClick={() => void checkAll()} disabled={busyIds.size > 0}>
              {busyIds.size ? copy.checking : copy.checkAll}
            </button>
          ) : null}
        </div>

        {records.length ? (
          <div className="evidence-list">
            {records.map((record) => {
              const verification = verifications[record.evidenceEventId];
              const state = evidenceDisplayState(record, verification);
              const busy = busyIds.has(record.evidenceEventId);
              return (
                <article className={`evidence-card source-${state.sourceState}`} key={record.evidenceEventId}>
                  <div className="evidence-card__top">
                    <div className="evidence-source-mark">📎</div>
                    <div><strong>{record.claim}</strong><span>R{record.round} · {copy.submittedBy} {record.actorName}</span></div>
                    <div className="evidence-badges">
                      <span className={`source-badge badge-${state.sourceState}`}>{sourceStateLabel(state.sourceState, copy)}</span>
                      {state.disputed ? <span className="badge-disputed">⚔ {copy.disputed}</span> : null}
                      {state.changedMind ? <span className="badge-influence">↻ {copy.changedMind}</span> : null}
                    </div>
                  </div>
                  <p>{record.content}</p>
                  <dl>
                    <div><dt>{copy.source}</dt><dd>{record.sourceHost ?? copy.noSafeUrl}</dd></div>
                    <div><dt>{copy.sourceDate}</dt><dd>{record.sourceDate ?? copy.noDate}</dd></div>
                    <div><dt>{copy.observed}</dt><dd>{verification ? formatObserved(verification.observedAt, locale) : copy.unchecked}</dd></div>
                  </dl>
                  {verification?.title ? <div className="evidence-page-title">“{verification.title}”</div> : null}
                  {verification?.statusCode ? <small>HTTP {verification.statusCode} · {verification.contentType || "unknown content type"}{verification.truncated ? " · bounded" : ""}</small> : null}
                  {!readOnly ? (
                    <div className="evidence-actions">
                      {record.sourceUrl ? <button type="button" onClick={() => void chrome.tabs.create({ url: record.sourceUrl, active: true })}>{copy.openSource}</button> : null}
                      {record.sourceUrl ? <button type="button" className="primary" disabled={busy} onClick={() => void checkRecord(record)}>{busy ? copy.checking : copy.checkSource}</button> : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : <div className="evidence-empty">{copy.none}</div>}

        <p className="evidence-boundary">⚠ {readOnly ? copy.archiveNote : copy.note}</p>
        {error ? <p className="evidence-error">{error}</p> : null}
      </section>

      <EvidenceGapRadar
        participants={participants}
        events={events}
        verifications={verifications}
        locale={locale}
        onFocusEvent={focusConsultationEvent}
      />
    </>
  );
}

async function ensureSourcePermissions(urls: readonly string[]): Promise<boolean> {
  const origins = [...new Set(urls.map((value) => `${new URL(value).origin}/*`))];
  if (!origins.length) return true;
  const descriptor = { origins };
  if (await chrome.permissions.contains(descriptor)) return true;
  return chrome.permissions.request(descriptor);
}

async function requestVerification(url: string): Promise<EvidenceVerificationSnapshot> {
  const response = await chrome.runtime.sendMessage({ type: "VERIFY_EVIDENCE_SOURCE", url });
  if (!response?.ok || !response.result) {
    throw new Error(response?.error || "Evidence source check failed.");
  }
  return response.result as EvidenceVerificationSnapshot;
}

function sourceStateLabel(state: ReturnType<typeof evidenceDisplayState>["sourceState"], copy: typeof COPY.en | typeof COPY["zh-CN"]): string {
  if (state === "reachable") return copy.reachable;
  if (state === "unavailable") return copy.unavailable;
  if (state === "unsupported") return copy.unsupported;
  return copy.unchecked;
}

function normalizeVerifications(value: unknown): Record<string, EvidenceVerificationSnapshot> {
  return value && typeof value === "object" ? value as Record<string, EvidenceVerificationSnapshot> : {};
}

function formatObserved(value: string, locale: Locale): string {
  try {
    return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  } catch {
    return value;
  }
}
