import { useMemo } from "react";
import type { CouncilEvent } from "../../core/types.js";
import type { Locale } from "../../i18n/index.js";
import {
  deriveLiveRoomDynamics,
  type LiveMoment,
  type LiveMomentKind,
} from "../../theater/live-moments.js";
import "./live-moments.css";

interface LiveMomentsProps {
  participants: readonly { id: string; name: string }[];
  events: readonly CouncilEvent[];
  locale: Locale;
}

const COPY = {
  en: {
    eyebrow: "LIVE MOMENTS",
    title: "The meeting has a plot now",
    body: "Every card below is backed by explicit Blackboard events. Spectacle is allowed; invented drama is not.",
    heat: "ROOM HEAT",
    heatNote: "interaction intensity · not answer quality",
    empty: "No public turning point yet. Independent positions are still forming.",
    round: "R{round}",
    alignedNote: "Alignment is not proof of truth.",
    unknown: "Unknown participant",
  },
  "zh-CN": {
    eyebrow: "直播关键时刻",
    title: "这场会议开始有剧情了",
    body: "下面每张卡片都必须由真实 Blackboard 事件触发。可以有戏，但不允许编剧情。",
    heat: "会议热度",
    heatNote: "只表示互动强度 · 不表示答案质量",
    empty: "暂时还没有公开的关键转折。各个 AI 仍在形成自己的独立立场。",
    round: "第 {round} 轮",
    alignedNote: "立场对齐不等于事实已经被证明。",
    unknown: "未知参与者",
  },
} as const;

const MOMENT_COPY: Record<LiveMomentKind, { icon: string; en: string; "zh-CN": string }> = {
  clash: { icon: "⚔", en: "CLASH", "zh-CN": "正面交锋" },
  evidence_drop: { icon: "📎", en: "EVIDENCE DROP", "zh-CN": "证据空投" },
  evidence_challenged: { icon: "🔎", en: "EVIDENCE UNDER FIRE", "zh-CN": "证据遭到质疑" },
  alliance: { icon: "🤝", en: "ALLIANCE", "zh-CN": "出现同盟" },
  plot_twist: { icon: "↻", en: "PLOT TWIST", "zh-CN": "剧情反转" },
  evidence_turn: { icon: "🧾", en: "RECEIPTS CHANGED A MIND", "zh-CN": "证据让 AI 改口" },
  concession: { icon: "🏳", en: "CONCESSION", "zh-CN": "公开让步" },
  lone_dissenter: { icon: "🧍", en: "LONE VOICE", "zh-CN": "孤独反对者" },
  split_room: { icon: "⚡", en: "ROOM SPLIT", "zh-CN": "会议室分裂" },
  alignment_surge: { icon: "📈", en: "ALIGNMENT SURGE", "zh-CN": "立场快速靠拢" },
  full_alignment: { icon: "◎", en: "ROOM ALIGNED", "zh-CN": "全场立场对齐" },
};

export function LiveMoments({ participants, events, locale }: LiveMomentsProps) {
  const copy = COPY[locale];
  const dynamics = useMemo(
    () => deriveLiveRoomDynamics(
      participants.map((participant) => ({ id: participant.id, name: participant.name, provider: participant.id })),
      events,
    ),
    [participants, events],
  );
  const recent = dynamics.moments.slice(-4).reverse();

  return (
    <div className="live-moments">
      <div className="live-moments__heading">
        <div><span>{copy.eyebrow}</span><h3>{copy.title}</h3><p>{copy.body}</p></div>
        <HeatGauge heat={dynamics.heat} locale={locale} label={copy.heat} note={copy.heatNote} />
      </div>
      {recent.length ? (
        <div className="moment-reel">
          {recent.map((moment, index) => (
            <MomentCard key={moment.id} moment={moment} participants={participants} locale={locale} roundTemplate={copy.round} alignedNote={copy.alignedNote} unknown={copy.unknown} latest={index === 0} />
          ))}
        </div>
      ) : <p className="moment-empty">{copy.empty}</p>}
    </div>
  );
}

function HeatGauge({ heat, locale, label, note }: { heat: number; locale: Locale; label: string; note: string }) {
  const state = heatState(heat, locale);
  return (
    <div className={`heat-gauge heat-${state.key}`}>
      <div><span>{label}</span><b>{heat}</b></div>
      <div className="heat-track"><i style={{ width: `${heat}%` }} /></div>
      <strong>{state.label}</strong><small>{note}</small>
    </div>
  );
}

function MomentCard({ moment, participants, locale, roundTemplate, alignedNote, unknown, latest }: {
  moment: LiveMoment;
  participants: readonly { id: string; name: string }[];
  locale: Locale;
  roundTemplate: string;
  alignedNote: string;
  unknown: string;
  latest: boolean;
}) {
  const meta = MOMENT_COPY[moment.kind];
  return (
    <article className={`moment-card moment-${moment.kind} ${latest ? "is-latest" : ""}`}>
      <b className="moment-icon">{meta.icon}</b>
      <div className="moment-main">
        <div className="moment-topline"><strong>{meta[locale]}</strong><span>{roundTemplate.replace("{round}", String(moment.round))}</span></div>
        <p>{momentDetail(moment, participants, locale, unknown)}</p>
        {moment.kind === "full_alignment" ? <small>{alignedNote}</small> : null}
      </div>
    </article>
  );
}

function momentDetail(moment: LiveMoment, participants: readonly { id: string; name: string }[], locale: Locale, unknown: string): string {
  const actor = participantName(participants, moment.actorId, unknown);
  const target = participantName(participants, moment.targetActorId, unknown);
  if (moment.kind === "clash") return locale === "zh-CN" ? `${actor} 公开质疑 ${target} 的观点。` : `${actor} directly challenged ${target}.`;
  if (moment.kind === "evidence_challenged") return locale === "zh-CN" ? `${actor} 对 ${target} 提交的证据发起质疑。` : `${actor} challenged evidence submitted by ${target}.`;
  if (moment.kind === "evidence_drop") {
    const source = moment.sourceHost ? ` · ${moment.sourceHost}` : "";
    return locale === "zh-CN" ? `${actor} 把一条结构化证据放上了桌面${source}。` : `${actor} put structured evidence on the table${source}.`;
  }
  if (moment.kind === "alliance") return locale === "zh-CN" ? `${actor} 明确支持了 ${target} 的一条观点。` : `${actor} explicitly backed a point from ${target}.`;
  if (moment.kind === "plot_twist" || moment.kind === "evidence_turn") {
    const transition = moment.fromStance ? `${moment.fromStance} → ${moment.toStance ?? "?"}` : moment.toStance ?? "?";
    if (moment.kind === "evidence_turn") return locale === "zh-CN" ? `${actor} 因为明确引用的证据修改了立场：${transition}` : `${actor} revised after explicitly linked evidence: ${transition}`;
    return locale === "zh-CN" ? `${actor} 公开改口：${transition}` : `${actor} publicly changed position: ${transition}`;
  }
  if (moment.kind === "concession") return moment.targetActorId ? (locale === "zh-CN" ? `${actor} 对 ${target} 的观点作出明确让步。` : `${actor} explicitly conceded a point to ${target}.`) : (locale === "zh-CN" ? `${actor} 作出了一次明确让步。` : `${actor} explicitly conceded a point.`);
  if (moment.kind === "lone_dissenter") return locale === "zh-CN" ? `${actor} 暂时成为唯一坚持“${moment.stance ?? "?"}”的参与者。` : `${actor} is currently the only participant holding “${moment.stance ?? "?"}”.`;
  if (moment.kind === "split_room") return locale === "zh-CN" ? "当前已公开立场形成势均力敌的两派。" : "The currently submitted positions split the room evenly.";
  if (moment.kind === "alignment_surge") return locale === "zh-CN" ? `最近一次明确立场让对齐度从 ${moment.alignmentBefore ?? 0}% 跃升到 ${moment.alignmentAfter ?? 0}%。` : `One explicit position moved alignment from ${moment.alignmentBefore ?? 0}% to ${moment.alignmentAfter ?? 0}%.`;
  if (moment.kind === "full_alignment") return locale === "zh-CN" ? `目前已公开立场全部落在“${moment.stance ?? "?"}”。` : `All currently submitted positions now land on “${moment.stance ?? "?"}”.`;
  return "";
}

function participantName(participants: readonly { id: string; name: string }[], id: string | undefined, fallback: string): string {
  if (!id) return fallback;
  return participants.find((participant) => participant.id === id)?.name ?? fallback;
}

function heatState(heat: number, locale: Locale): { key: string; label: string } {
  if (heat >= 75) return { key: "wild", label: locale === "zh-CN" ? "🔥 激烈" : "🔥 WILD" };
  if (heat >= 50) return { key: "hot", label: locale === "zh-CN" ? "⚡ 升温" : "⚡ HEATED" };
  if (heat >= 25) return { key: "active", label: locale === "zh-CN" ? "◉ 活跃" : "◉ ACTIVE" };
  return { key: "calm", label: locale === "zh-CN" ? "○ 平静" : "○ CALM" };
}
