import { useMemo } from "react";
import {
  buildInfluenceGraph,
  influenceEdgeLabel,
  type InfluenceAward,
  type InfluenceEdge,
} from "../../analysis/influence-graph.js";
import type {
  CouncilEvent,
  CouncilParticipant,
  CouncilReport,
} from "../../core/types.js";
import "../theater.css";

interface CouncilTheaterProps {
  events: readonly CouncilEvent[];
  participants: readonly CouncilParticipant[];
  report: CouncilReport;
}

export function CouncilTheater({
  events,
  participants,
  report,
}: CouncilTheaterProps) {
  const graph = useMemo(
    () => buildInfluenceGraph(events, participants),
    [events, participants],
  );
  const positions = layoutParticipants(graph.nodes.map((node) => node.participant));
  const byId = new Map(positions.map((item) => [item.participant.id, item]));

  return (
    <section className="council-theater">
      <header className="theater-heading">
        <div>
          <span className="panel-kicker">COUNCIL THEATER</span>
          <h2>谁影响了谁？</h2>
          <p>强关系只来自明确的 revision / concede；challenge、evidence、support 只是互动，不冒充“说服成功”。</p>
        </div>
        <div className="theater-legend">
          <span><i className="legend-line legend-line--strong" />改变立场</span>
          <span><i className="legend-line legend-line--interaction" />互动</span>
        </div>
      </header>

      <div className="theater-grid">
        <div className="influence-map">
          <svg viewBox="0 0 560 330" role="img" aria-label="Council influence graph">
            <defs>
              <marker id="arrow-strong" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                <path d="M0,0 L9,4.5 L0,9 z" className="arrow-strong" />
              </marker>
              <marker id="arrow-soft" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" className="arrow-soft" />
              </marker>
            </defs>

            {graph.edges.map((edge) => {
              const source = byId.get(edge.fromActorId);
              const target = byId.get(edge.toActorId);
              if (!source || !target) return null;
              const path = curvedPath(source, target, edge);
              const focus = edge.triggerEventIds.at(-1);
              return (
                <g
                  key={edge.id}
                  className={`influence-edge influence-edge--${edge.strength}`}
                  onClick={() => focus && focusBlackboardEvent(focus)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if ((event.key === "Enter" || event.key === " ") && focus) {
                      focusBlackboardEvent(focus);
                    }
                  }}
                  aria-label={`${nameOf(participants, edge.fromActorId)} ${influenceEdgeLabel(edge)} ${nameOf(participants, edge.toActorId)}`}
                >
                  <path className="influence-edge__hit" d={path} />
                  <path
                    className="influence-edge__path"
                    d={path}
                    markerEnd={edge.strength === "strong" ? "url(#arrow-strong)" : "url(#arrow-soft)"}
                  />
                </g>
              );
            })}

            {positions.map(({ participant, x, y }) => {
              const node = graph.nodes.find((item) => item.participant.id === participant.id)!;
              const final = report.positions.find((item) => item.participant.id === participant.id);
              return (
                <g className="influence-node" key={participant.id} transform={`translate(${x} ${y})`}>
                  <circle r="34" />
                  <text className="influence-node__name" textAnchor="middle" y="-4">{clipName(participant.name)}</text>
                  <text className="influence-node__stance" textAnchor="middle" y="13">{clipName(final?.stance ?? "—", 14)}</text>
                  {node.revisions + node.concessions > 0 ? (
                    <text className="influence-node__changed" textAnchor="middle" y="48">↻ {node.revisions + node.concessions}</text>
                  ) : null}
                </g>
              );
            })}
          </svg>

          {graph.transitions.length ? (
            <div className="changed-mind-trail">
              {graph.transitions.map((transition) => (
                <button
                  type="button"
                  key={transition.revisionEventId}
                  onClick={() => focusBlackboardEvent(transition.revisionEventId)}
                >
                  <strong>🔄 {nameOf(participants, transition.actorId)}</strong>
                  <span>{transition.fromStance ?? "?"} → {transition.toStance}</span>
                  <small>{transition.causedByEventIds.length ? `because of ${transition.causedByEventIds.length} event${transition.causedByEventIds.length === 1 ? "" : "s"}` : "self-revision"}</small>
                </button>
              ))}
            </div>
          ) : (
            <p className="theater-empty">这场廷议没有结构化 revision / concede，所以 ChatChat 不会虚构“谁说服了谁”。</p>
          )}
        </div>

        <div className="theater-awards">
          <Award title="🧠 Most Influential" award={graph.awards.mostInfluential} participants={participants} />
          <Award title="🔄 Most Open-Minded" award={graph.awards.mostOpenMinded} participants={participants} />
          <Award title="⚔️ Most Challenged" award={graph.awards.mostChallenged} participants={participants} />
          <Award title="📎 Evidence Broker" award={graph.awards.evidenceBroker} participants={participants} />
          <div className="theater-rule">
            <strong>The theatrical layer may celebrate an event.</strong>
            <span>It may not invent one.</span>
          </div>
        </div>
      </div>

      {graph.brokenReferences.length ? (
        <div className="theater-warning">⚠ 史册中有 {graph.brokenReferences.length} 个失效 event reference；图已安全忽略这些边。</div>
      ) : null}
    </section>
  );
}

function Award({
  title,
  award,
  participants,
}: {
  title: string;
  award: InfluenceAward | null;
  participants: readonly CouncilParticipant[];
}) {
  if (!award) {
    return <div className="award-card award-card--empty"><span>{title}</span><strong>—</strong><small>没有足够的事件证据</small></div>;
  }
  return (
    <button
      type="button"
      className="award-card"
      onClick={() => award.provenanceEventIds[0] && focusBlackboardEvent(award.provenanceEventIds[0])}
    >
      <span>{title}</span>
      <strong>{nameOf(participants, award.actorId)}</strong>
      <small>{award.score} traceable event{award.score === 1 ? "" : "s"}</small>
    </button>
  );
}

interface PositionedParticipant {
  participant: CouncilParticipant;
  x: number;
  y: number;
}

function layoutParticipants(participants: readonly CouncilParticipant[]): PositionedParticipant[] {
  const count = Math.max(1, participants.length);
  const centerX = 280;
  const centerY = 155;
  const radiusX = count <= 4 ? 180 : 205;
  const radiusY = count <= 4 ? 96 : 118;
  return participants.map((participant, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / count;
    return {
      participant,
      x: centerX + Math.cos(angle) * radiusX,
      y: centerY + Math.sin(angle) * radiusY,
    };
  });
}

function curvedPath(
  source: PositionedParticipant,
  target: PositionedParticipant,
  edge: InfluenceEdge,
): string {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / length;
  const normalY = dx / length;
  const direction = source.participant.id.localeCompare(target.participant.id) <= 0 ? 1 : -1;
  const bend = (edge.strength === "strong" ? 24 : 15) * direction;
  const mx = (source.x + target.x) / 2 + normalX * bend;
  const my = (source.y + target.y) / 2 + normalY * bend;
  const start = trimPoint(source, target, 40);
  const end = trimPoint(target, source, 42);
  return `M ${start.x} ${start.y} Q ${mx} ${my} ${end.x} ${end.y}`;
}

function trimPoint(
  source: Pick<PositionedParticipant, "x" | "y">,
  target: Pick<PositionedParticipant, "x" | "y">,
  amount: number,
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  return { x: source.x + (dx / length) * amount, y: source.y + (dy / length) * amount };
}

function focusBlackboardEvent(eventId: string) {
  const element = document.getElementById(`council-event-${eventId}`);
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  element.classList.remove("event-card--trace-focus");
  void element.clientWidth;
  element.classList.add("event-card--trace-focus");
  window.setTimeout(() => element.classList.remove("event-card--trace-focus"), 2200);
}

function nameOf(participants: readonly CouncilParticipant[], id: string) {
  return participants.find((item) => item.id === id)?.name ?? id;
}

function clipName(value: string, max = 12) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
