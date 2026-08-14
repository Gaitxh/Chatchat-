import type {
  CouncilParticipant,
  CouncilResearchLane,
} from "../../core/types.js";
import { researchLaneDefinition } from "../../consultation/research-lanes.js";
import type { Locale } from "../../i18n/index.js";
import "./research-roster.css";

interface ResearchRosterProps {
  participants: readonly CouncilParticipant[];
  assignments: Readonly<Record<string, CouncilResearchLane>>;
  locale: Locale;
}

export function ResearchRoster({ participants, assignments, locale }: ResearchRosterProps) {
  const zh = locale === "zh-CN";
  const rows = participants
    .map((participant) => {
      const laneId = assignments[participant.id];
      return laneId ? { participant, lane: researchLaneDefinition(laneId) } : null;
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  if (!rows.length) return null;

  return (
    <section className="research-roster">
      <header>
        <div>
          <span>{zh ? "研究分工" : "RESEARCH ROSTER"}</span>
          <h3>{zh ? "这场会里，每位 AI 重点查了什么？" : "What did each AI investigate?"}</h3>
          <p>{zh
            ? "研究焦点只负责增加信息多样性，不增加任何席位的权力。真正影响他人的证据仍必须公开进入共享事件流。"
            : "Research focus diversifies what gets investigated; it never increases a seat's authority. Evidence can influence peers only after it is published into the shared event stream."}</p>
        </div>
        <b>{zh ? "等权" : "EQUAL AUTHORITY"}</b>
      </header>

      <div className="research-roster__grid">
        {rows.map(({ participant, lane }) => (
          <article key={participant.id} data-research-roster-lane={lane.id}>
            <b>{lane.icon}</b>
            <div>
              <strong>{participant.name}</strong>
              <span>{zh ? lane.zhCN.label : lane.en.label}</span>
              <small>{zh ? lane.zhCN.goal : lane.en.goal}</small>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
