import type {
  CouncilHistorySummary,
  HistoryBackend,
} from "../../history/index.js";
import "../historian.css";

interface HistorianPanelProps {
  entries: readonly CouncilHistorySummary[];
  backend: HistoryBackend | null;
  error: string | null;
  activeSessionId: string | null;
  disabled: boolean;
  onOpen: (sessionId: string) => void;
}

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function HistorianPanel({
  entries,
  backend,
  error,
  activeSessionId,
  disabled,
  onOpen,
}: HistorianPanelProps) {
  const backendLabel =
    backend === "sqlite"
      ? "SQLITE · LOCAL APP DATA"
      : backend === "browser"
        ? "BROWSER · LOCAL STORAGE"
        : "OPENING ARCHIVE…";

  return (
    <section className="historian-panel">
      <div className="historian-heading">
        <div>
          <span className="historian-kicker">📚 COURT CHRONICLE</span>
          <h2>史官 · 历次廷议</h2>
        </div>
        <span className={`history-backend backend-${backend ?? "loading"}`}>
          {backendLabel}
        </span>
      </div>

      <p className="historian-note">
        每次御令、Blackboard 事件和最终奏议都只保存在这台设备上。点击旧案可重新展开整场廷议。
      </p>

      {error ? (
        <div className="history-warning">史官落笔失败：{error}</div>
      ) : null}

      {entries.length === 0 ? (
        <div className="empty-chronicle">
          <span>卷一</span>
          <p>史册尚空。第一场廷议结束后会自动记档。</p>
        </div>
      ) : (
        <div className="chronicle-list">
          {entries.map((entry, index) => {
            const isActive = entry.sessionId === activeSessionId;
            return (
              <button
                type="button"
                className={`chronicle-entry ${isActive ? "is-active" : ""}`}
                key={entry.sessionId}
                disabled={disabled}
                onClick={() => onOpen(entry.sessionId)}
              >
                <span className="chronicle-index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="chronicle-copy">
                  <strong>{entry.question}</strong>
                  <small>
                    {dateFormatter.format(new Date(entry.createdAt))} · {entry.rounds} rounds · {entry.eventCount} events
                  </small>
                </span>
                <span className="chronicle-verdict">
                  <b>{entry.consensusStance ?? "未决"}</b>
                  <small>{Math.round(entry.consensusRatio * 100)}%</small>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
