import type { Locale } from "../../i18n/index.js";
import type { ConsultationHistorySummary } from "../../history/consultation-history.js";
import type { InvestigationTrailEdge } from "../../history/investigation-trail.js";
import { consultationModeDefinition } from "../../consultation/modes.js";
import { requestOpenConsultationArchive } from "../history-wire.js";
import "./meeting-index.css";

interface MeetingIndexProps {
  items: readonly ConsultationHistorySummary[];
  trailEdges: readonly InvestigationTrailEdge[];
  locale: Locale;
}

export function MeetingIndex({ items, trailEdges, locale }: MeetingIndexProps) {
  const zh = locale === "zh-CN";
  if (!items.length) return null;
  const childEdge = new Map(trailEdges.map((edge) => [edge.childSessionId, edge]));
  const childCount = new Map<string, number>();
  for (const edge of trailEdges) childCount.set(edge.parentSessionId, (childCount.get(edge.parentSessionId) ?? 0) + 1);

  return (
    <section className="meeting-index">
      <header>
        <div>
          <span>{zh ? "会议索引" : "MEETING INDEX"}</span>
          <h3>{zh ? "不用点进去，也知道这场会发生过什么。" : "Know what kind of meeting it was before opening it."}</h3>
        </div>
        <b>LOCAL · RECENT</b>
      </header>

      <div className="meeting-index-list">
        {items.slice(0, 6).map((item) => {
          const mode = consultationModeDefinition(item.mode ?? "balanced");
          const modeLabel = zh ? mode.zhCN.label : mode.en.label;
          const incoming = childEdge.get(item.sessionId);
          const branches = childCount.get(item.sessionId) ?? 0;
          return (
            <button
              type="button"
              className={`meeting-index-card ${incoming ? "is-follow-up" : ""}`}
              key={item.sessionId}
              onClick={() => requestOpenConsultationArchive(item.sessionId)}
            >
              <div className="meeting-index-mode">
                <span>{mode.icon}</span>
                <div><strong>{modeLabel}</strong><small>{formatDate(item.createdAt, locale)}</small></div>
              </div>
              <p>{item.proposalPreview}</p>
              <div className="meeting-index-stats">
                <span>{item.participantCount} AI</span>
                <span>{item.rounds}{zh ? "轮" : "r"}</span>
                <span>⚔ {item.challengeCount ?? 0}</span>
                <span>📎 {item.evidenceCount}</span>
                <span>↻ {item.revisionCount}</span>
                {item.concessionCount ? <span>🏳 {item.concessionCount}</span> : null}
              </div>
              <div className="meeting-index-footer">
                <em>{item.consensusStance ?? (zh ? "无单一领先立场" : "No single leader")}</em>
                <strong>{Math.round(item.consensusRatio * 100)}%</strong>
              </div>
              {incoming ? (
                <div className="meeting-index-follow-up">
                  ↳ {zh ? incoming.labelZhCN : incoming.labelEn}
                </div>
              ) : branches ? (
                <div className="meeting-index-branches">
                  {zh ? `↳ ${branches} 条 follow-up 分支` : `↳ ${branches} follow-up branch${branches === 1 ? "" : "es"}`}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function formatDate(value: string, locale: Locale): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}
