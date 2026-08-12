import type { CouncilEvent, CouncilParticipant } from "../../core/types.js";
import { latestPosition } from "../council-view.js";
import type { CouncilUiStage } from "../useCouncilSession.js";
import { AgentSeat } from "./AgentSeat.js";

interface RoundTableProps {
  participants: readonly CouncilParticipant[];
  events: readonly CouncilEvent[];
  stage: CouncilUiStage;
  round: number;
  activeActorId: string | null;
  question: string;
}

const placements = ["seat-nw", "seat-ne", "seat-sw", "seat-se"];

const stageCopy: Record<
  CouncilUiStage,
  { eyebrow: string; title: string; detail: string }
> = {
  idle: {
    eyebrow: "THE THRONE IS QUIET",
    title: "等待国王下令",
    detail: "四位智囊已就座。",
  },
  sealed: {
    eyebrow: "ROUND 1 · SEALED",
    title: "密室奏议",
    detail: "每位智囊独立思考，彼此不可见。",
  },
  debate: {
    eyebrow: "OPEN COUNCIL",
    title: "公开廷议",
    detail: "质询、举证、答辩与改口自动进行。",
  },
  final: {
    eyebrow: "FINAL POSITIONS",
    title: "形成最终奏议",
    detail: "每位智囊提交独立最终立场。",
  },
  complete: {
    eyebrow: "COUNCIL ADJOURNED",
    title: "廷议结束",
    detail: "共识与少数意见都已保留。",
  },
  error: {
    eyebrow: "COUNCIL INTERRUPTED",
    title: "廷议中断",
    detail: "请检查本地运行状态后重试。",
  },
};

export function RoundTable({
  participants,
  events,
  stage,
  round,
  activeActorId,
  question,
}: RoundTableProps) {
  const copy = stageCopy[stage];

  return (
    <section className={`round-table-scene stage-${stage}`}>
      <div className="ambient-ring ring-one" />
      <div className="ambient-ring ring-two" />

      <div className="council-table" aria-label="AI Council round table">
        <div className="table-inlay" />
        <div className="royal-seal">
          <span className="crown">♛</span>
          <span className="seal-label">KING'S COMMAND</span>
          <p>{question || "你的问题将在这里成为本次廷议的唯一御令。"}</p>
        </div>
      </div>

      {participants.map((participant, index) => (
        <AgentSeat
          key={participant.id}
          participant={participant}
          position={latestPosition(events, participant.id)}
          stage={stage}
          active={activeActorId === participant.id}
          placement={placements[index] ?? "seat-se"}
        />
      ))}

      <div className="stage-banner" role="status" aria-live="polite">
        <span>{copy.eyebrow}</span>
        <strong>{copy.title}</strong>
        <small>
          {round > 0 ? `Round ${round} · ` : ""}
          {copy.detail}
        </small>
      </div>
    </section>
  );
}
