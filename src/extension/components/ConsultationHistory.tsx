import type { Locale } from "../../i18n/index.js";
import type { ConsultationHistorySummary } from "../../consultation/history.js";
import "./consultation-history.css";

interface ConsultationHistoryProps {
  entries: readonly ConsultationHistorySummary[];
  locale: Locale;
  activeSessionId: string | null;
  viewingHistorical: boolean;
  hasCurrentConsultation: boolean;
  busy: boolean;
  onOpen(sessionId: string): void;
  onRemove(sessionId: string): void;
  onClear(): void;
  onReturnCurrent(): void;
}

const COPY = {
  en: {
    eyebrow: "CONSULTATION HISTORY",
    title: "Your local consultation memory",
    body: "Completed consultations are stored in this browser only. Open any record to replay its structured event history without contacting an AI provider.",
    local: "INDEXEDDB · LOCAL",
    count: (value: number) => `${value} saved consultation${value === 1 ? "" : "s"}`,
    emptyTitle: "No saved consultations yet",
    emptyBody: "Finish a consultation and it will appear here automatically.",
    open: "OPEN REPLAY",
    remove: "DELETE",
    clear: "CLEAR HISTORY",
    returnCurrent: "RETURN TO CURRENT",
    archive: "ARCHIVE REPLAY",
    rounds: (value: number) => `${value} round${value === 1 ? "" : "s"}`,
    events: (value: number) => `${value} event${value === 1 ? "" : "s"}`,
    participants: (value: number) => `${value} participant${value === 1 ? "" : "s"}`,
    revisions: (value: number) => `${value} changed mind`,
    alignment: (value: number) => `${value}% aligned`,
    minority: "different position preserved",
    noShared: "no shared position",
    privacy: "Full proposal and event text stay inside the local archive. Nothing is uploaded by ChatChat.",
    confirmClear: "Clear all locally saved ChatChat consultation history?",
  },
  "zh-CN": {
    eyebrow: "协商记录",
    title: "只属于你的本地协商记忆",
    body: "完成的协商只保存在这个浏览器里。打开任何旧记录都可以直接回放结构化事件，不会再次联系任何 AI Provider。",
    local: "INDEXEDDB · 本地",
    count: (value: number) => `已保存 ${value} 场协商`,
    emptyTitle: "还没有协商记录",
    emptyBody: "完成第一场协商后，它会自动出现在这里。",
    open: "打开回放",
    remove: "删除",
    clear: "清空记录",
    returnCurrent: "返回当前协商",
    archive: "历史回放",
    rounds: (value: number) => `${value} 轮`,
    events: (value: number) => `${value} 个事件`,
    participants: (value: number) => `${value} 位参与者`,
    revisions: (value: number) => `${value} 次改口`,
    alignment: (value: number) => `${value}% 立场一致`,
    minority: "保留不同立场",
    noShared: "没有共同立场",
    privacy: "完整提案和事件正文只存在本地 archive 中，ChatChat 不会自动上传这些内容。",
    confirmClear: "确定清空浏览器中保存的全部 ChatChat 协商记录吗？",
  },
} as const;

export function ConsultationHistory({
  entries,
  locale,
  activeSessionId,
  viewingHistorical,
  hasCurrentConsultation,
  busy,
  onOpen,
  onRemove,
  onClear,
  onReturnCurrent,
}: ConsultationHistoryProps) {
  const copy = COPY[locale];
  return (
    <section className="consultation-history">
      <header className="consultation-history__header">
        <div>
          <span>{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
          <p>{copy.body}</p>
        </div>
        <div className="history-local-badge">
          <strong>{copy.local}</strong>
          <small>{copy.count(entries.length)}</small>
        </div>
      </header>

      {viewingHistorical ? (
        <div className="history-replay-banner">
          <div><b>↺ {copy.archive}</b><span>{copy.privacy}</span></div>
          {hasCurrentConsultation ? (
            <button type="button" onClick={onReturnCurrent}>{copy.returnCurrent}</button>
          ) : null}
        </div>
      ) : null}

      {entries.length ? (
        <div className="history-list">
          {entries.map((entry) => {
            const active = entry.sessionId === activeSessionId;
            return (
              <article className={`history-entry ${active ? "is-active" : ""}`} key={entry.sessionId}>
                <button type="button" className="history-entry__main" onClick={() => onOpen(entry.sessionId)} disabled={busy}>
                  <div className="history-entry__topline">
                    <time dateTime={entry.createdAt}>{formatDate(entry.createdAt, locale)}</time>
                    <span>{entry.consensusStance ?? copy.noShared}</span>
                  </div>
                  <strong>{entry.questionPreview}</strong>
                  <div className="history-entry__meta">
                    <span>{copy.participants(entry.participantCount)}</span>
                    <span>{copy.rounds(entry.rounds)}</span>
                    <span>{copy.events(entry.eventCount)}</span>
                    <span>{copy.revisions(entry.changedMindCount)}</span>
                    <span>{copy.alignment(Math.round(entry.consensusRatio * 100))}</span>
                    {entry.minorityOpinionPresent ? <span className="is-minority">{copy.minority}</span> : null}
                  </div>
                </button>
                <div className="history-entry__actions">
                  <button type="button" onClick={() => onOpen(entry.sessionId)} disabled={busy}>{copy.open}</button>
                  <button type="button" className="danger" onClick={() => onRemove(entry.sessionId)} disabled={busy}>{copy.remove}</button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="history-empty">
          <b>◷</b>
          <strong>{copy.emptyTitle}</strong>
          <p>{copy.emptyBody}</p>
        </div>
      )}

      <footer className="consultation-history__footer">
        <span>🔒 {copy.privacy}</span>
        {entries.length ? (
          <button
            type="button"
            className="history-clear"
            disabled={busy}
            onClick={() => {
              if (window.confirm(copy.confirmClear)) onClear();
            }}
          >{copy.clear}</button>
        ) : null}
      </footer>
    </section>
  );
}

function formatDate(value: string, locale: Locale): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "zh-CN" ? "zh-CN" : "en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
