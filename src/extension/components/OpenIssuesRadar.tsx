import type { CouncilEvent, CouncilParticipant } from "../../core/types.js";
import {
  deriveOpenMeetingIssues,
  type OpenMeetingIssueKind,
} from "../../consultation/open-issues.js";
import type { Locale } from "../../i18n/index.js";
import { focusConsultationEvent } from "../provenance-wire.js";
import "./open-issues-radar.css";

interface OpenIssuesRadarProps {
  participants: readonly CouncilParticipant[];
  events: readonly CouncilEvent[];
  locale: Locale;
  compact?: boolean;
}

const META: Record<OpenMeetingIssueKind, { icon: string; en: string; zh: string }> = {
  open_question: { icon: "?", en: "Open question", zh: "未回应追问" },
  challenged_claim: { icon: "⚔", en: "Challenge awaiting response", zh: "待回应质疑" },
  evidence_awaiting_response: { icon: "📎", en: "Evidence awaiting response", zh: "待回应证据" },
  explicit_uncertainty: { icon: "≈", en: "Explicit uncertainty", zh: "明确不确定性" },
};

export function OpenIssuesRadar({ participants, events, locale, compact = false }: OpenIssuesRadarProps) {
  const zh = locale === "zh-CN";
  const issues = deriveOpenMeetingIssues(participants, events);
  const visible = issues.slice(0, compact ? 3 : 5);
  const counts = Object.fromEntries(
    Object.keys(META).map((kind) => [kind, issues.filter((issue) => issue.kind === kind).length]),
  ) as Record<OpenMeetingIssueKind, number>;

  return (
    <section
      className={`open-issues-radar ${issues.length ? "has-open-issues" : "is-clear"} ${compact ? "is-compact" : ""}`}
      data-open-issue-count={issues.length}
    >
      <header>
        <div>
          <span>{zh ? "开放议题" : "OPEN ISSUES"}</span>
          <strong>{issues.length
            ? zh ? `还有 ${issues.length} 项结构化议题未被明确回应` : `${issues.length} structured issue${issues.length === 1 ? "" : "s"} still await explicit response`
            : zh ? "当前没有未回应的结构化议题" : "No structured issue is currently awaiting response"}</strong>
          <p>{zh
            ? "只根据 Blackboard 的显式引用更新状态。没有任何 AI 可以靠一句“讨论充分”把问题抹掉。"
            : "Status changes only from explicit Blackboard references. No AI can erase an issue by merely saying the discussion is complete."}</p>
        </div>
        <b>{issues.length}</b>
      </header>

      <div className="open-issues-radar__counts">
        {(Object.keys(META) as OpenMeetingIssueKind[]).map((kind) => (
          <span key={kind} className={counts[kind] ? "has-count" : ""}>
            {META[kind].icon} {zh ? META[kind].zh : META[kind].en} · {counts[kind]}
          </span>
        ))}
      </div>

      {visible.length ? (
        <div className="open-issues-radar__list">
          {visible.map((issue) => {
            const meta = META[issue.kind];
            const handoff = issue.targetActorName
              ? zh ? ` → 等待 ${issue.targetActorName}` : ` → awaiting ${issue.targetActorName}`
              : "";
            return (
              <button
                key={issue.id}
                type="button"
                data-open-issue-kind={issue.kind}
                data-open-issue-event={issue.sourceEventId}
                data-open-issue-target={issue.targetActorId ?? ""}
                onClick={() => focusConsultationEvent(issue.sourceEventId)}
              >
                <b>{meta.icon}</b>
                <div>
                  <span>{zh ? meta.zh : meta.en} · R{issue.round} · {issue.actorName}{handoff}</span>
                  <strong>{truncate(issue.content, 190)}</strong>
                </div>
                <i>↗</i>
              </button>
            );
          })}
        </div>
      ) : null}
      {issues.length > visible.length ? (
        <small className="open-issues-radar__more">+{issues.length - visible.length} {zh ? "项仍保留在事件图中" : "more retained in the event graph"}</small>
      ) : null}
    </section>
  );
}

function truncate(value: string, max: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 1)}…`;
}
