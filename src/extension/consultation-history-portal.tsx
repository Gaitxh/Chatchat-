import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  deriveEvidenceLedger,
  type EvidenceVerificationSnapshot,
} from "../evidence/evidence-ledger.js";
import { EvidenceHistoryStore } from "../history/evidence-history.js";
import {
  ExecutionAuditHistoryStore,
  type ExecutionAuditHistoryArchive,
} from "../history/execution-audit-history.js";
import {
  ConsultationHistoryStore,
  type ConsultationArchive,
  type ConsultationHistorySummary,
} from "../history/consultation-history.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import {
  buildProviderAttendanceAudit,
  type ProviderAttendanceAuditModel,
  type ProviderTurnAttendanceAudit,
} from "../theater/provider-attendance.js";
import {
  announceConsultationHistoryUpdated,
  CONSULTATION_HISTORY_UPDATED_EVENT,
} from "./history-wire.js";
import "./consultation-history-portal.css";
export const OPEN_ARCHIVE_EVENT = "chatchat:consultation-open-archive";
const store = new ConsultationHistoryStore();
const evidenceHistory = new EvidenceHistoryStore();
const executionHistory = new ExecutionAuditHistoryStore();

export interface OpenArchiveDetail {
  archive: ConsultationArchive;
}

interface HistoryStoryStats {
  challenges: number;
  observedEvidence: number;
  reachableEvidence: number;
  disputedEvidence: number;
  influentialEvidence: number;
  providerTurns: number;
  verifiedProviderTurns: number;
  repairedProviderTurns: number;
  fallbackProviderTurns: number;
  failedProviderTurns: number;
  executionMode: ExecutionAuditHistoryArchive["mode"] | null;
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
  providerTurns: string;
  verified: string;
  repaired: string;
  fallback: string;
  failed: string;
  auditTitle: string;
  auditBody: string;
  auditSnapshot: string;
  auditResponse: string;
  auditParsed: string;
  auditBoard: string;
  auditIds: string;
  noAudit: string;
  delete: string;
  clear: string;
  emptyTitle: string;
  emptyBody: string;
  missing: string;
}

const EN: HistoryCopy = {
  eyebrow: "CONSULTATION HISTORY",
  title: "Meetings worth replaying",
  body: "Recent consultations stay in this browser as event-backed meeting cards. Open one to replay the room exactly as it was — including frozen evidence observations and Provider execution receipts — without calling an AI provider again.",
  participants: "participants",
  rounds: "rounds",
  events: "events",
  minority: "minority survives",
  evidence: "evidence",
  observed: "observed",
  challenged: "challenges",
  influenced: "evidence → revision",
  providerTurns: "Provider turns",
  verified: "verified",
  repaired: "repaired",
  fallback: "fallback",
  failed: "failed",
  auditTitle: "Frozen Provider attendance receipt",
  auditBody: "This replay uses the raw transport + parse/repair receipt saved when the meeting closed, combined with the frozen Blackboard events. It never calls a Provider again and does not infer hidden reasoning.",
  auditSnapshot: "snapshot",
  auditResponse: "response",
  auditParsed: "parsed",
  auditBoard: "board",
  auditIds: "Audit IDs",
  noAudit: "This archive predates durable Provider execution receipts.",
  delete: "Delete consultation",
  clear: "Clear local history",
  emptyTitle: "No saved consultation yet",
  emptyBody: "Finish a consultation and ChatChat will archive the structured meeting locally.",
  missing: "This local consultation archive no longer exists.",
};

const ZH: HistoryCopy = {
  eyebrow: "协商记录",
  title: "值得重新播放的会议",
  body: "最近的协商会以“会议录像卡”的方式留在这个浏览器里。打开旧记录可以回放当时的事件、冻结证据观察和 Provider 执行收据，不会再次调用任何 AI。",
  participants: "位参与者",
  rounds: "轮",
  events: "个事件",
  minority: "少数意见保留",
  evidence: "条证据",
  observed: "来源已观察",
  challenged: "次质疑",
  influenced: "证据促成改口",
  providerTurns: "Provider 轮次",
  verified: "已验证",
  repaired: "修复后通过",
  fallback: "fallback",
  failed: "失败",
  auditTitle: "冻结的 Provider 出席收据",
  auditBody: "这里使用闭会时保存的原始 transport + parse/repair 票据，再和冻结 Blackboard events 重新推导审计。不会重新调用 Provider，也不会猜模型隐藏思维。",
  auditSnapshot: "快照",
  auditResponse: "页面响应",
  auditParsed: "解析",
  auditBoard: "黑板",
  auditIds: "审计 ID",
  noAudit: "这条旧记录产生于 Provider 执行收据持久化之前。",
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
  const [openAudit, setOpenAudit] = useState<ProviderAttendanceAuditModel | null>(null);
  const [openAuditMode, setOpenAuditMode] = useState<ExecutionAuditHistoryArchive["mode"] | null>(null);
  const copy = useMemo(() => (locale === "zh-CN" ? ZH : EN), [locale]);

  useEffect(() => {
    void refresh();
    const onHistoryUpdated = () => void refresh();
    window.addEventListener(CONSULTATION_HISTORY_UPDATED_EVENT, onHistoryUpdated);
    const languageObserver = new MutationObserver(() => {
      setLocale(normalizeLocale(document.documentElement.lang));
    });
    languageObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });

    return () => {
      languageObserver.disconnect();
      window.removeEventListener(CONSULTATION_HISTORY_UPDATED_EVENT, onHistoryUpdated);
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
            const [archive, evidenceArchive, executionArchive] = await Promise.all([
              store.load(summary.sessionId),
              evidenceHistory.load(summary.sessionId),
              executionHistory.load(summary.sessionId),
            ]);
            if (!archive) return [summary.sessionId, emptyStoryStats()] as const;
            return [
              summary.sessionId,
              deriveStoryStats(archive, evidenceArchive?.verifications ?? {}, executionArchive),
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

  async function openArchive(sessionId: string) {
    setBusy(`open:${sessionId}`);
    setError(null);
    try {
      const [archive, executionArchive] = await Promise.all([
        store.load(sessionId),
        executionHistory.load(sessionId),
      ]);
      if (!archive) throw new Error(copy.missing);
      setOpenSessionId(sessionId);
      if (executionArchive) {
        setOpenAudit(buildProviderAttendanceAudit(
          archive.report.positions.map((position) => position.participant),
          executionArchive.transports,
          executionArchive.execution,
          archive.events,
        ));
        setOpenAuditMode(executionArchive.mode);
      } else {
        setOpenAudit(null);
        setOpenAuditMode(null);
      }
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
      await Promise.all([store.delete(sessionId), evidenceHistory.delete(sessionId), executionHistory.delete(sessionId)]);
      if (openSessionId === sessionId) {
        setOpenSessionId(null);
        setOpenAudit(null);
        setOpenAuditMode(null);
      }
      announceConsultationHistoryUpdated();
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
      await Promise.all([store.clear(), evidenceHistory.clear(), executionHistory.clear()]);
      setOpenSessionId(null);
      setOpenAudit(null);
      setOpenAuditMode(null);
      announceConsultationHistoryUpdated();
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
            const isOpen = openSessionId === item.sessionId;
            return (
              <article className={`history-entry ${isOpen ? "is-open" : ""}`} key={item.sessionId}>
                <button className="history-entry-main" type="button" onClick={() => void openArchive(item.sessionId)} disabled={Boolean(busy)}>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  <div>
                    <strong>{item.proposalPreview}</strong>
                    <span>{formatDate(item.createdAt, locale)} · {item.participantCount} {copy.participants} · {item.rounds} {copy.rounds}</span>
                    <div className="history-story-pills">
                      {story.providerTurns ? <i>✓ {story.verifiedProviderTurns}/{story.providerTurns} {copy.providerTurns}</i> : null}
                      {story.repairedProviderTurns ? <i>↺ {story.repairedProviderTurns} {copy.repaired}</i> : null}
                      {story.fallbackProviderTurns ? <i>≈ {story.fallbackProviderTurns} {copy.fallback}</i> : null}
                      {story.failedProviderTurns ? <i>! {story.failedProviderTurns} {copy.failed}</i> : null}
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
                {isOpen ? (
                  openAudit ? (
                    <HistoricalExecutionAudit model={openAudit} mode={openAuditMode ?? "unknown"} copy={copy} locale={locale} />
                  ) : (
                    <div className="history-execution-missing">{copy.noAudit}</div>
                  )
                ) : null}
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

function HistoricalExecutionAudit({
  model,
  mode,
  copy,
  locale,
}: {
  model: ProviderAttendanceAuditModel;
  mode: ExecutionAuditHistoryArchive["mode"];
  copy: HistoryCopy;
  locale: Locale;
}) {
  const zh = locale === "zh-CN";
  return (
    <section
      className="history-execution-audit"
      data-history-execution-audit="loaded"
      data-history-execution-session={model.sessionId ?? ""}
      data-history-execution-mode={mode}
    >
      <header>
        <div>
          <span>LOCAL · EXECUTION RECEIPT</span>
          <strong>{copy.auditTitle}</strong>
          <p>{copy.auditBody}</p>
        </div>
        <div>
          <b>{model.verifiedTurns}/{model.totalTurns}</b>
          <small>{copy.verified}</small>
        </div>
      </header>
      <div className="history-execution-mode">
        {mode === "synthetic-showcase" ? "DEMO · SYNTHETIC RECEIPT" : mode === "live-provider-tabs" ? "LIVE PROVIDER RECEIPT" : "LEGACY / UNKNOWN MODE"}
      </div>
      <div className="history-execution-seats">
        {model.seats.filter((seat) => seat.turns.length).map((seat) => (
          <article key={seat.actorId} className="history-execution-seat" data-history-execution-seat={seat.actorId}>
            <div className="history-execution-seat__head">
              <div><strong>{seat.participantName}</strong><span>{seat.host ?? seat.providerId}</span></div>
              <b>{seat.verifiedTurns}/{seat.turns.length}</b>
            </div>
            <div className="history-execution-turns">
              {seat.turns.map((turn) => <HistoricalExecutionTurn key={turn.key} turn={turn} copy={copy} zh={zh} />)}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function HistoricalExecutionTurn({
  turn,
  copy,
  zh,
}: {
  turn: ProviderTurnAttendanceAudit;
  copy: HistoryCopy;
  zh: boolean;
}) {
  const verified = turn.state === "published" || turn.state === "repaired";
  return (
    <div
      className={`history-execution-turn state-${turn.state}`}
      data-history-execution-turn={turn.state}
      data-history-execution-snapshot-count={turn.snapshotEventIds.length}
      data-history-execution-published-count={turn.publishedEventIds.length}
    >
      <div className="history-execution-turn__head">
        <span>{turn.phase.toUpperCase()} · R{turn.round}</span>
        <b>{verified ? "✓ " : ""}{historyTurnLabel(turn, copy, zh)}</b>
      </div>
      <div className="history-execution-chain">
        <span>{copy.auditSnapshot} {turn.snapshotEventIds.length}</span><i>→</i>
        <span>{turn.transportReceived ? copy.auditResponse : turn.transportFailed ? copy.failed : "—"}</span><i>→</i>
        <span>{copy.auditParsed} {turn.contributionKinds.length}</span><i>→</i>
        <span>{copy.auditBoard} {turn.publishedEventIds.length}</span>
      </div>
      {(turn.snapshotEventIds.length || turn.publishedEventIds.length || turn.error) ? (
        <details>
          <summary>{copy.auditIds}</summary>
          {turn.snapshotEventIds.length ? <p><b>{copy.auditSnapshot}</b>{turn.snapshotEventIds.map((id) => <code key={id}>{id}</code>)}</p> : null}
          {turn.publishedEventIds.length ? <p><b>{copy.auditBoard}</b>{turn.publishedEventIds.map((id) => <code key={id}>{id}</code>)}</p> : null}
          {turn.error ? <p className="history-execution-error">{turn.error}</p> : null}
        </details>
      ) : null}
    </div>
  );
}

function historyTurnLabel(turn: ProviderTurnAttendanceAudit, copy: HistoryCopy, zh: boolean): string {
  if (turn.state === "published") return copy.verified;
  if (turn.state === "repaired") return copy.repaired;
  if (turn.state === "fallback") return copy.fallback;
  if (turn.state === "failed") return copy.failed;
  if (turn.state === "response_captured") return zh ? "只有页面响应" : "response only";
  if (turn.state === "structured_parsed") return zh ? "已解析，未观察到发布" : "parsed, not published";
  if (turn.state === "prompt_sent") return zh ? "只有 Prompt" : "prompt only";
  return zh ? "仅启动" : "started only";
}

function deriveStoryStats(
  archive: ConsultationArchive,
  verifications: Readonly<Record<string, EvidenceVerificationSnapshot>>,
  executionArchive: ExecutionAuditHistoryArchive | null,
): HistoryStoryStats {
  const evidence = deriveEvidenceLedger(
    archive.report.positions.map((position) => position.participant),
    archive.events,
  );
  const audit = executionArchive
    ? buildProviderAttendanceAudit(
        archive.report.positions.map((position) => position.participant),
        executionArchive.transports,
        executionArchive.execution,
        archive.events,
      )
    : null;
  return {
    challenges: archive.events.filter((event) => event.kind === "challenge").length,
    observedEvidence: evidence.filter((record) => Boolean(verifications[record.evidenceEventId])).length,
    reachableEvidence: evidence.filter((record) => verifications[record.evidenceEventId]?.state === "reachable").length,
    disputedEvidence: evidence.filter((record) => record.challengeEventIds.length > 0).length,
    influentialEvidence: evidence.filter((record) => record.downstreamRevisionEventIds.length > 0).length,
    providerTurns: audit?.totalTurns ?? 0,
    verifiedProviderTurns: audit?.verifiedTurns ?? 0,
    repairedProviderTurns: audit?.repairedTurns ?? 0,
    fallbackProviderTurns: audit?.fallbackTurns ?? 0,
    failedProviderTurns: audit?.failedTurns ?? 0,
    executionMode: executionArchive?.mode ?? null,
  };
}

function emptyStoryStats(): HistoryStoryStats {
  return {
    challenges: 0,
    observedEvidence: 0,
    reachableEvidence: 0,
    disputedEvidence: 0,
    influentialEvidence: 0,
    providerTurns: 0,
    verifiedProviderTurns: 0,
    repairedProviderTurns: 0,
    fallbackProviderTurns: 0,
    failedProviderTurns: 0,
    executionMode: null,
  };
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
