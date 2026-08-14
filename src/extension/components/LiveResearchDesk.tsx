import { useMemo } from "react";
import type {
  CouncilEvent,
  CouncilEventKind,
  CouncilParticipant,
  CouncilParticipantTurnUpdate,
} from "../../core/types.js";
import type { Locale } from "../../i18n/index.js";
import { buildResearchActivity } from "../../theater/research-activity.js";
import "./live-research-desk.css";

interface LiveResearchDeskProps {
  participants: readonly CouncilParticipant[];
  events: readonly CouncilEvent[];
  activities: Readonly<Record<string, CouncilParticipantTurnUpdate>>;
  locale: Locale;
  onFocusEvent(eventId: string): void;
}

const COPY = {
  en: {
    eyebrow: "LIVE RESEARCH DESK",
    title: "Different missions. Equal authority.",
    body: "Each AI gets a concrete research mission. This shows assigned work and published structured outputs—not private reasoning or invented browsing activity.",
    active: "investigating",
    evidence: "evidence events",
    waiting: "Research missions will light up as the round begins.",
    working: "INVESTIGATING",
    completed: "PUBLISHED",
    failed: "TURN FAILED",
    round: "Round",
    publicOutput: "public outputs",
    challenges: "challenges",
    revisions: "revisions",
    evidenceLabel: "evidence",
    latestEvidence: "LATEST EVIDENCE",
    trace: "trace",
  },
  "zh-CN": {
    eyebrow: "研究现场",
    title: "分工不同，权力相同",
    body: "每个 AI 都会收到明确的研究任务。这里仅展示任务和已经公开的结构化产出，不展示私有思维链，也不会把普通生成过程伪装成“联网研究”。",
    active: "正在调查",
    evidence: "条证据事件",
    waiting: "本轮开始后，各 AI 的研究任务会在这里逐个亮起。",
    working: "调查中",
    completed: "已公开产出",
    failed: "本轮失败",
    round: "第",
    publicOutput: "条公开产出",
    challenges: "质疑",
    revisions: "修正",
    evidenceLabel: "证据",
    latestEvidence: "最新证据",
    trace: "溯源",
  },
} as const;

const KIND_LABEL: Record<CouncilEventKind, { en: string; "zh-CN": string }> = {
  argument: { en: "view", "zh-CN": "观点" },
  challenge: { en: "challenge", "zh-CN": "质疑" },
  evidence: { en: "evidence", "zh-CN": "证据" },
  support: { en: "support", "zh-CN": "支持" },
  defense: { en: "defense", "zh-CN": "辩护" },
  revision: { en: "revision", "zh-CN": "修正" },
  concede: { en: "concede", "zh-CN": "让步" },
  question: { en: "question", "zh-CN": "追问" },
  uncertain: { en: "uncertain", "zh-CN": "不确定" },
  final_position: { en: "final", "zh-CN": "最终意见" },
};

export function LiveResearchDesk({
  participants,
  events,
  activities,
  locale,
  onFocusEvent,
}: LiveResearchDeskProps) {
  const copy = COPY[locale];
  const model = useMemo(
    () => buildResearchActivity(participants, events, activities),
    [participants, events, activities],
  );

  return (
    <section className="live-research-desk">
      <header className="live-research-desk__header">
        <div>
          <span>{copy.eyebrow}</span>
          <h3>{copy.title}</h3>
          <p>{copy.body}</p>
        </div>
        <div className="live-research-desk__stats">
          <b>{model.activeCount}</b><small>{copy.active}</small>
          <b data-research-evidence-count={model.publishedEvidenceCount}>{model.publishedEvidenceCount}</b><small>{copy.evidence}</small>
        </div>
      </header>

      {model.rows.length ? (
        <div className="research-desk-grid">
          {model.rows.map((row) => (
            <article
              className={`research-desk-card research-desk-card--${row.state}`}
              key={row.participantId}
              data-research-lane={row.lane}
              data-research-state={row.state}
            >
              <div className="research-desk-card__top">
                <div className="research-desk-avatar">{monogram(row.participantName)}</div>
                <div>
                  <strong>{row.participantName}</strong>
                  <span>{row.laneIcon} {locale === "zh-CN" ? row.laneLabelZhCN : row.laneLabelEn}</span>
                </div>
                <em>{stateLabel(row.state, locale)}</em>
              </div>

              <p className="research-desk-mission">
                {locale === "zh-CN" ? row.laneGoalZhCN : row.laneGoalEn}
              </p>

              <div className="research-desk-progress">
                <span>{locale === "zh-CN" ? `${copy.round} ${row.round} 轮` : `${copy.round} ${row.round}`}</span>
                <span><b>{row.publicEventCount}</b> {copy.publicOutput}</span>
                <span><b>{row.evidenceCount}</b> {copy.evidenceLabel}</span>
                <span><b>{row.challengeCount}</b> {copy.challenges}</span>
                <span><b>{row.revisionCount}</b> {copy.revisions}</span>
              </div>

              {row.contributionKinds.length ? (
                <div className="research-desk-kinds">
                  {row.contributionKinds.map((kind) => (
                    <span key={kind}>{KIND_LABEL[kind][locale]}</span>
                  ))}
                </div>
              ) : null}

              {row.latestEvidence ? (
                <button
                  className="research-desk-evidence"
                  type="button"
                  data-research-evidence-event={row.latestEvidence.eventId}
                  onClick={() => onFocusEvent(row.latestEvidence!.eventId)}
                >
                  <small>{copy.latestEvidence}</small>
                  <strong>{row.latestEvidence.claim}</strong>
                  <span>{row.latestEvidence.sourceHost ?? copy.trace} ↗</span>
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="research-desk-waiting"><i aria-hidden="true" />{copy.waiting}</div>
      )}
    </section>
  );
}

function stateLabel(state: CouncilParticipantTurnUpdate["state"], locale: Locale): string {
  return COPY[locale][state === "working" ? "working" : state === "completed" ? "completed" : "failed"];
}

function monogram(name: string): string {
  if (/deepseek/i.test(name)) return "D";
  if (/gemini/i.test(name)) return "Gm";
  if (/claude/i.test(name)) return "C";
  if (/qwen|通义/i.test(name)) return "Q";
  if (/gpt|chatgpt/i.test(name)) return "G";
  return name.slice(0, 2).toUpperCase();
}
