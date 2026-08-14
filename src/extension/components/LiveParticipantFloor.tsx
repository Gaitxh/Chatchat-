import { useMemo } from "react";
import type {
  CouncilEvent,
  CouncilEventKind,
  CouncilParticipant,
  CouncilParticipantTurnUpdate,
  CouncilPhaseUpdate,
} from "../../core/types.js";
import { researchLaneDefinition } from "../../consultation/research-lanes.js";
import type { Locale } from "../../i18n/index.js";
import { LiveAgenda } from "./LiveAgenda.js";
import "./live-participant-floor.css";

interface LiveParticipantFloorProps {
  participants: readonly CouncilParticipant[];
  events: readonly CouncilEvent[];
  phase: CouncilPhaseUpdate | null;
  activities: Readonly<Record<string, CouncilParticipantTurnUpdate>>;
  locale: Locale;
}

const COPY = {
  en: {
    eyebrow: "LIVE PARTICIPANTS",
    title: "Every AI is working its own seat",
    body: "Participants in one batch read the same immutable meeting snapshot and work in parallel. A faster website never gets more authority.",
    sealed: "Independent analysis",
    debate: "Open consultation",
    final: "Final positions",
    waiting: "Waiting for this round",
    workingSealed: "Forming an independent view",
    workingDebate: "Reviewing the shared meeting record",
    workingFinal: "Forming a final position",
    completed: "Turn complete",
    failed: "Turn failed",
    noAction: "No public action yet",
    latestStance: "Current stance",
    researchFocus: "Research focus",
    equalLane: "equal authority",
    evidenceDesk: "EVIDENCE DESK",
    evidenceTitle: "Evidence placed on the table",
    noEvidence: "No participant has submitted structured evidence yet.",
    source: "source",
    round: "Round",
    finalRound: "Final",
    eventBacked: "Actions below come from structured contributions — not inferred prose.",
    stats: "meeting actions",
  },
  "zh-CN": {
    eyebrow: "实时协商席",
    title: "每个 AI 都在自己的席位上工作",
    body: "同一批次的参与者读取同一个不可变会议快照，并行完成自己的分析；网站响应更快不会获得更高权力。",
    sealed: "独立分析",
    debate: "公开协商",
    final: "最终立场",
    waiting: "等待本轮开始",
    workingSealed: "正在独立分析提案",
    workingDebate: "正在阅读共享会议记录",
    workingFinal: "正在形成最终意见",
    completed: "本轮工作完成",
    failed: "本轮失败",
    noAction: "还没有公开动作",
    latestStance: "当前立场",
    researchFocus: "研究焦点",
    equalLane: "权力完全平等",
    evidenceDesk: "证据桌",
    evidenceTitle: "已经放上桌面的证据",
    noEvidence: "目前还没有参与者提交结构化证据。",
    source: "来源",
    round: "第",
    finalRound: "最终",
    eventBacked: "下面的动作来自结构化 contribution，不从普通文字里猜剧情。",
    stats: "会议动作",
  },
} as const;

const ACTION_META: Record<CouncilEventKind, { icon: string; en: string; "zh-CN": string }> = {
  argument: { icon: "◉", en: "published a view", "zh-CN": "发表观点" },
  challenge: { icon: "⚔", en: "challenged a peer", "zh-CN": "发起质疑" },
  evidence: { icon: "📎", en: "submitted evidence", "zh-CN": "提交证据" },
  support: { icon: "🤝", en: "supported a peer", "zh-CN": "支持同伴" },
  defense: { icon: "🛡", en: "defended a claim", "zh-CN": "进行辩护" },
  revision: { icon: "↻", en: "revised a position", "zh-CN": "修改立场" },
  concede: { icon: "🏳", en: "conceded a point", "zh-CN": "公开让步" },
  question: { icon: "?", en: "asked a question", "zh-CN": "提出追问" },
  uncertain: { icon: "≈", en: "marked uncertainty", "zh-CN": "标记不确定性" },
  final_position: { icon: "◎", en: "submitted final position", "zh-CN": "提交最终意见" },
};

export function LiveParticipantFloor({
  participants,
  events,
  phase,
  activities,
  locale,
}: LiveParticipantFloorProps) {
  const copy = COPY[locale];
  const round = phase?.round ?? Math.max(1, ...events.map((event) => event.round));
  const evidence = useMemo(
    () => events.filter((event): event is Extract<CouncilEvent, { kind: "evidence" }> => event.kind === "evidence").slice(-3).reverse(),
    [events],
  );
  const roundCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const event of events) counts.set(event.round, (counts.get(event.round) ?? 0) + 1);
    return counts;
  }, [events]);

  return (
    <section className="live-participant-floor">
      <header className="live-participant-floor__header">
        <div>
          <span>{copy.eyebrow}</span>
          <h3>{copy.title}</h3>
          <p>{copy.body}</p>
        </div>
        <div className={`live-phase-chip phase-${phase?.phase ?? "sealed"}`}>
          <b>{phaseLabel(phase, locale)}</b>
          <small>{phase?.phase === "final" ? copy.finalRound : locale === "zh-CN" ? `${copy.round} ${round} 轮` : `${copy.round} ${round}`}</small>
        </div>
      </header>

      <LiveAgenda phase={phase} events={events} participants={participants} locale={locale} />
      <RoundRail phase={phase} events={events} counts={roundCounts} locale={locale} />

      <div className="live-participant-grid">
        {participants.map((participant) => (
          <ParticipantCard
            key={participant.id}
            participant={participant}
            activity={activities[participant.id]}
            events={events}
            phase={phase}
            locale={locale}
          />
        ))}
      </div>

      <div className="live-floor-proof-note">⌁ {copy.eventBacked}</div>

      <div className="live-evidence-desk">
        <div className="live-evidence-desk__heading">
          <span>{copy.evidenceDesk}</span>
          <strong>{copy.evidenceTitle}</strong>
          <b>{evidence.length}</b>
        </div>
        {evidence.length ? (
          <div className="live-evidence-list">
            {evidence.map((item) => (
              <article key={item.id}>
                <b>📎</b>
                <div>
                  <strong>{participantName(participants, item.actorId)}</strong>
                  <p>{truncate(item.claim || item.content, 180)}</p>
                  <small>R{item.round}{item.source ? ` · ${copy.source}: ${sourceHost(item.source)}` : ""}</small>
                </div>
              </article>
            ))}
          </div>
        ) : <p className="live-evidence-empty">{copy.noEvidence}</p>}
      </div>
    </section>
  );
}

function ParticipantCard({
  participant,
  activity,
  events,
  phase,
  locale,
}: {
  participant: CouncilParticipant;
  activity: CouncilParticipantTurnUpdate | undefined;
  events: readonly CouncilEvent[];
  phase: CouncilPhaseUpdate | null;
  locale: Locale;
}) {
  const copy = COPY[locale];
  const actorEvents = events.filter((event) => event.actorId === participant.id);
  const latest = actorEvents.at(-1);
  const stance = [...actorEvents].reverse().find((event) => event.kind === "argument" || event.kind === "revision" || event.kind === "final_position");
  const kinds = activity?.contributionKinds ?? (latest ? [latest.kind] : []);
  const stats = eventStats(actorEvents);
  const lane = activity?.researchLane ? researchLaneDefinition(activity.researchLane) : null;
  const isWorking = activity?.state === "working" && activity.round === phase?.round && activity.phase === phase.phase;
  const status = isWorking
    ? workingText(phase?.phase ?? "sealed", locale)
    : activity?.state === "failed"
      ? copy.failed
      : activity?.state === "completed"
        ? copy.completed
        : copy.waiting;

  return (
    <article className={`live-participant-card ${isWorking ? "is-working" : ""} ${latest?.kind === "revision" ? "is-revised" : ""} ${activity?.state === "failed" ? "is-failed" : ""}`}>
      <div className="live-participant-card__top">
        <b className="live-participant-avatar">{monogram(participant.name)}</b>
        <div>
          <strong>{participant.name}</strong>
          <span>{status}</span>
        </div>
        <i className="live-participant-state-dot" aria-hidden="true" />
      </div>

      {lane ? (
        <div className="live-participant-lane" data-research-lane={lane.id}>
          <span>{lane.icon}</span>
          <div>
            <small>{copy.researchFocus}</small>
            <strong>{locale === "zh-CN" ? lane.zhCN.label : lane.en.label}</strong>
          </div>
          <i>{copy.equalLane}</i>
        </div>
      ) : null}

      <div className="live-participant-action">
        {kinds.length ? kinds.slice(0, 3).map((kind) => (
          <span key={kind}>{ACTION_META[kind].icon} {ACTION_META[kind][locale]}</span>
        )) : <span className="is-muted">{copy.noAction}</span>}
      </div>

      <div className="live-participant-stance">
        <small>{copy.latestStance}</small>
        <strong>{stance && "stance" in stance ? stance.stance : "—"}</strong>
      </div>

      <div className="live-participant-stats" aria-label={copy.stats}>
        <span>⚔ {stats.challenge}</span>
        <span>📎 {stats.evidence}</span>
        <span>🤝 {stats.support}</span>
        <span>↻ {stats.revision}</span>
      </div>
    </article>
  );
}

function RoundRail({
  phase,
  events,
  counts,
  locale,
}: {
  phase: CouncilPhaseUpdate | null;
  events: readonly CouncilEvent[];
  counts: ReadonlyMap<number, number>;
  locale: Locale;
}) {
  const maxRound = Math.max(phase?.round ?? 1, ...events.map((event) => event.round), 1);
  const rounds = Array.from({ length: maxRound }, (_, index) => index + 1);
  return (
    <div className="live-round-rail">
      {rounds.map((round) => {
        const current = phase?.round === round;
        const final = current && phase?.phase === "final";
        const complete = !current && round < (phase?.round ?? 1);
        return (
          <div key={round} className={`live-round-node ${current ? "is-current" : ""} ${complete ? "is-complete" : ""} ${final ? "is-final" : ""}`}>
            <b>{final ? "F" : `R${round}`}</b>
            <span>{counts.get(round) ?? 0}</span>
            <small>{current ? phaseLabel(phase, locale) : ""}</small>
          </div>
        );
      })}
    </div>
  );
}

function phaseLabel(phase: CouncilPhaseUpdate | null, locale: Locale): string {
  const copy = COPY[locale];
  if (phase?.phase === "debate") return copy.debate;
  if (phase?.phase === "final") return copy.final;
  return copy.sealed;
}

function workingText(phase: CouncilPhaseUpdate["phase"], locale: Locale): string {
  const copy = COPY[locale];
  if (phase === "debate") return copy.workingDebate;
  if (phase === "final") return copy.workingFinal;
  return copy.workingSealed;
}

function eventStats(events: readonly CouncilEvent[]): Record<"challenge" | "evidence" | "support" | "revision", number> {
  return {
    challenge: events.filter((event) => event.kind === "challenge").length,
    evidence: events.filter((event) => event.kind === "evidence").length,
    support: events.filter((event) => event.kind === "support").length,
    revision: events.filter((event) => event.kind === "revision").length,
  };
}

function participantName(participants: readonly CouncilParticipant[], actorId: string): string {
  return participants.find((participant) => participant.id === actorId)?.name ?? actorId;
}

function sourceHost(value: string): string {
  try { return new URL(value).hostname || value; } catch { return value; }
}

function truncate(value: string, max: number): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= max ? compact : `${compact.slice(0, max - 1)}…`;
}

function monogram(name: string): string {
  if (/deepseek/i.test(name)) return "D";
  if (/gemini/i.test(name)) return "Gm";
  if (/claude/i.test(name)) return "C";
  if (/qwen|通义/i.test(name)) return "Q";
  if (/gpt|chatgpt/i.test(name)) return "G";
  return name.slice(0, 2).toUpperCase();
}