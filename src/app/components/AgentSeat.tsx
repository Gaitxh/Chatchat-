import type { CouncilParticipant } from "../../core/types.js";
import type { CouncilUiStage } from "../useCouncilSession.js";
import type { PositionEvent } from "../council-view.js";
import { confidencePercent } from "../council-view.js";

interface AgentSeatProps {
  participant: CouncilParticipant;
  position: PositionEvent | undefined;
  stage: CouncilUiStage;
  active: boolean;
  placement: string;
}

const sigils: Record<string, string> = {
  "mock-gpt": "G",
  "mock-claude": "C",
  "mock-gemini": "✦",
  "mock-deepseek": "D",
};

function statusText(
  stage: CouncilUiStage,
  active: boolean,
  hasPosition: boolean,
): string {
  if (stage === "idle") return "待命";
  if (stage === "sealed") return hasPosition ? "奏议已封存" : "密室思考中";
  if (stage === "debate") return active ? "正在发言" : "旁听 · 审议";
  if (stage === "final") return active ? "提交最终立场" : "形成最终意见";
  if (stage === "complete") return "廷议结束";
  return "连接中断";
}

export function AgentSeat({
  participant,
  position,
  stage,
  active,
  placement,
}: AgentSeatProps) {
  const sealed = stage === "sealed";

  return (
    <article
      className={`agent-seat ${placement} actor-${participant.id} ${active ? "is-active" : ""}`}
    >
      <div className="agent-portrait" aria-hidden="true">
        <span>{sigils[participant.id] ?? participant.name.slice(0, 1)}</span>
        <i className="presence-dot" />
      </div>
      <div className="agent-copy">
        <div className="agent-heading">
          <strong>{participant.name}</strong>
          <span className="provider-badge">MOCK</span>
        </div>
        <span className="agent-role">{participant.role ?? "Council Member"}</span>
        <div className="agent-status">
          <span className={active ? "pulse-dot" : "quiet-dot"} />
          {statusText(stage, active, Boolean(position))}
        </div>
        {position ? (
          <div className="position-chip" title={position.content}>
            <span className="position-label">
              {sealed ? "仅国王可见" : "立场"}
            </span>
            <strong>{position.stance}</strong>
            <small>{confidencePercent(position.confidence)}</small>
          </div>
        ) : null}
      </div>
    </article>
  );
}
