import { useEffect, useMemo, useState } from "react";
import type {
  CouncilEvent,
  CouncilParticipant,
  CouncilReport,
} from "../../core/types.js";
import {
  buildCouncilInfluenceGraph,
  deriveCouncilAwards,
  type AggregatedInfluenceEdge,
  type InfluenceEdge,
} from "../../theater/influence.js";
import { eventPresentation, eventText } from "../council-view.js";
import "../theater.css";

interface CouncilTheaterProps {
  participants: readonly CouncilParticipant[];
  events: readonly CouncilEvent[];
  report: CouncilReport;
}

type ReplaySpeed = "1x" | "2x" | "instant";

interface Point {
  x: number;
  y: number;
}

export function CouncilTheater({
  participants,
  events,
  report,
}: CouncilTheaterProps) {
  const [cursor, setCursor] = useState(events.length);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<ReplaySpeed>("1x");

  useEffect(() => {
    setCursor(events.length);
    setPlaying(false);
  }, [events.at(-1)?.id, events.length]);

  useEffect(() => {
    if (!playing) return;
    if (speed === "instant") {
      setCursor(events.length);
      setPlaying(false);
      return;
    }
    if (cursor >= events.length) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(
      () => setCursor((current) => Math.min(events.length, current + 1)),
      speed === "2x" ? 360 : 720,
    );
    return () => window.clearTimeout(timer);
  }, [cursor, events.length, playing, speed]);

  const visibleEvents = useMemo(
    () => events.slice(0, cursor),
    [cursor, events],
  );
  const complete = cursor >= events.length;
  const graph = useMemo(
    () => buildCouncilInfluenceGraph(participants, visibleEvents),
    [participants, visibleEvents],
  );
  const awards = useMemo(
    () => deriveCouncilAwards(graph, visibleEvents, complete ? report : null),
    [complete, graph, report, visibleEvents],
  );
  const revisions = graph.edges.filter(
    (edge) => edge.kind === "revision" && edge.stanceTransition,
  );

  const restart = () => {
    setCursor(0);
    setPlaying(true);
  };

  const stage = replayStage(visibleEvents, events);
  const lastEvent = visibleEvents.at(-1);

  return (
    <section className="council-theater">
      <header className="council-theater__header">
        <div>
          <span className="eyebrow">COUNCIL THEATER · 议会剧场</span>
          <h2>Who moved the room?</h2>
          <p>
            这里不猜“谁说服了谁”。所有箭头都来自 Blackboard 的结构化引用：
            challenge / evidence 是互动；只有 revision.causedBy 或 concede 才会亮成强影响。
          </p>
        </div>
        <ReplayBadge stage={stage} cursor={cursor} total={events.length} />
      </header>

      <div className="council-theater__grid">
        <div className="influence-panel">
          <div className="theater-subhead">
            <div>
              <span className="eyebrow">INFLUENCE MAP</span>
              <h3>说服关系图</h3>
            </div>
            <div className="influence-legend">
              <span><i className="legend-line legend-line--strong" /> Changed mind / concede</span>
              <span><i className="legend-line" /> Interaction</span>
            </div>
          </div>
          <InfluenceMap
            participants={participants}
            edges={graph.aggregatedEdges}
            onFocusEvent={focusBlackboardEvent}
          />
          {graph.unresolvedReferences.length ? (
            <div className="graph-warning">
              ⚠ {graph.unresolvedReferences.length} broken event reference{graph.unresolvedReferences.length === 1 ? "" : "s"} omitted from the graph.
            </div>
          ) : null}
        </div>

        <div className="replay-panel">
          <div className="theater-subhead">
            <div>
              <span className="eyebrow">LOCAL REPLAY</span>
              <h3>廷议回放</h3>
            </div>
            <span className={`replay-stage replay-stage--${stage.toLowerCase()}`}>{stage}</span>
          </div>

          <div className="replay-controls">
            <button type="button" onClick={restart}>↺ REPLAY</button>
            <button
              type="button"
              onClick={() => setPlaying((current) => !current)}
              disabled={cursor >= events.length && !playing}
            >
              {playing ? "Ⅱ PAUSE" : "▶ PLAY"}
            </button>
            <div className="speed-switch" aria-label="Replay speed">
              {(["1x", "2x", "instant"] as const).map((value) => (
                <button
                  type="button"
                  className={speed === value ? "is-active" : ""}
                  key={value}
                  onClick={() => {
                    setSpeed(value);
                    if (value === "instant") {
                      setCursor(events.length);
                      setPlaying(false);
                    }
                  }}
                >
                  {value === "instant" ? "ALL" : value}
                </button>
              ))}
            </div>
          </div>

          <input
            className="replay-scrubber"
            type="range"
            min={0}
            max={events.length}
            value={cursor}
            onChange={(event) => {
              setPlaying(false);
              setCursor(Number(event.target.value));
            }}
            aria-label="Replay event cursor"
          />

          <div className="replay-now">
            {lastEvent ? (
              <>
                <span className="replay-now__icon">{eventPresentation[lastEvent.kind].icon}</span>
                <div>
                  <strong>{participantName(participants, lastEvent.actorId)}</strong>
                  <span>{eventPresentation[lastEvent.kind].label} · Round {lastEvent.round}</span>
                  <p>{eventText(lastEvent)}</p>
                </div>
                <button type="button" onClick={() => focusBlackboardEvent(lastEvent.id)}>VIEW ↗</button>
              </>
            ) : (
              <div className="replay-empty">
                <strong>王令已下，史官尚未翻页。</strong>
                <span>按 PLAY，让事件一条条重新进入议政板。</span>
              </div>
            )}
          </div>

          <div className="replay-progress">
            <span>{cursor}/{events.length} events</span>
            <span>{graph.edges.length} traceable influence links</span>
          </div>
        </div>
      </div>

      <ChangedMindTrails
        edges={revisions}
        participants={participants}
        onFocusEvent={focusBlackboardEvent}
      />

      {awards.length ? (
        <div className="council-awards">
          <div className="theater-subhead">
            <div>
              <span className="eyebrow">AFTER-COUNCIL TITLES</span>
              <h3>事后封赏 · 不反馈给模型</h3>
            </div>
            <small>Only event-derived titles are shown.</small>
          </div>
          <div className="award-grid">
            {awards.map((award) => (
              <button
                type="button"
                className="award-card"
                key={award.kind}
                onClick={() => award.provenanceEventIds[0] && focusBlackboardEvent(award.provenanceEventIds[0])}
              >
                <b>{award.icon}</b>
                <div>
                  <span>{award.title}</span>
                  <strong>{participantName(participants, award.participantId)}</strong>
                  <small>{award.detail}</small>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function InfluenceMap({
  participants,
  edges,
  onFocusEvent,
}: {
  participants: readonly CouncilParticipant[];
  edges: readonly AggregatedInfluenceEdge[];
  onFocusEvent(eventId: string): void;
}) {
  const points = participantPoints(participants);
  return (
    <svg className="influence-map" viewBox="0 0 760 430" role="img" aria-label="Directed Council influence graph">
      <defs>
        <marker id="arrow-interaction" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" className="arrow-interaction" />
        </marker>
        <marker id="arrow-strong" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" className="arrow-strong" />
        </marker>
      </defs>

      <ellipse cx="380" cy="216" rx="205" ry="138" className="influence-table" />
      <circle cx="380" cy="216" r="58" className="influence-seal" />
      <text x="380" y="211" textAnchor="middle" className="influence-seal-crown">♛</text>
      <text x="380" y="238" textAnchor="middle" className="influence-seal-label">COUNCIL</text>

      {edges.map((edge, index) => {
        const source = points.get(edge.sourceActorId);
        const target = points.get(edge.targetActorId);
        if (!source || !target) return null;
        const path = curvedEdge(source, target, index, edge.strength === "strong");
        const count = edge.strongCount + edge.interactionCount;
        return (
          <g
            className={`influence-edge influence-edge--${edge.strength}`}
            key={edge.id}
            role="button"
            tabIndex={0}
            onClick={() => edge.eventIds[0] && onFocusEvent(edge.eventIds[0])}
            onKeyDown={(event) => {
              if ((event.key === "Enter" || event.key === " ") && edge.eventIds[0]) {
                event.preventDefault();
                onFocusEvent(edge.eventIds[0]);
              }
            }}
          >
            <path
              d={path.d}
              markerEnd={edge.strength === "strong" ? "url(#arrow-strong)" : "url(#arrow-interaction)"}
            />
            <circle cx={path.label.x} cy={path.label.y} r={edge.strength === "strong" ? 15 : 12} />
            <text x={path.label.x} y={path.label.y + 4} textAnchor="middle">{count}</text>
            <title>{edgeLabel(edge)}</title>
          </g>
        );
      })}

      {participants.map((participant) => {
        const point = points.get(participant.id)!;
        const real = participant.provider !== "mock";
        return (
          <g className={`influence-node ${real ? "influence-node--real" : ""}`} key={participant.id} transform={`translate(${point.x} ${point.y})`}>
            <circle r="48" />
            <circle r="39" className="influence-node__inner" />
            <text y="-4" textAnchor="middle" className="influence-node__name">{shortName(participant.name)}</text>
            <text y="17" textAnchor="middle" className="influence-node__provider">{real ? "LIVE WEB" : "MOCK"}</text>
          </g>
        );
      })}
    </svg>
  );
}

function ChangedMindTrails({
  edges,
  participants,
  onFocusEvent,
}: {
  edges: readonly InfluenceEdge[];
  participants: readonly CouncilParticipant[];
  onFocusEvent(eventId: string): void;
}) {
  if (!edges.length) return null;
  const groups = new Map<string, InfluenceEdge[]>();
  for (const edge of edges) {
    const current = groups.get(edge.sourceEventId) ?? [];
    current.push(edge);
    groups.set(edge.sourceEventId, current);
  }

  return (
    <div className="changed-mind-trails">
      <div className="theater-subhead">
        <div>
          <span className="eyebrow">CHANGED MIND TRAILS</span>
          <h3>谁让谁改口了？</h3>
        </div>
        <small>Only explicit revision.causedBy links appear here.</small>
      </div>
      <div className="trail-grid">
        {[...groups.values()].map((group) => {
          const first = group[0]!;
          const target = participantName(participants, first.targetActorId);
          const causes = group.map((edge) => participantName(participants, edge.sourceActorId));
          return (
            <button
              type="button"
              className="trail-card"
              key={first.sourceEventId}
              onClick={() => onFocusEvent(first.sourceEventId)}
            >
              <div className="trail-card__actors">
                <span>{unique(causes).join(" + ")}</span>
                <b>→</b>
                <strong>{target}</strong>
              </div>
              <div className="trail-card__transition">
                <span>{first.stanceTransition?.from ?? "Unknown"}</span>
                <b>→</b>
                <strong>{first.stanceTransition?.to}</strong>
              </div>
              <small>trace: {shortEvent(first.causedByEventId)} → {shortEvent(first.sourceEventId)}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReplayBadge({ stage, cursor, total }: { stage: string; cursor: number; total: number }) {
  return (
    <div className="theater-badge">
      <b>{stage === "SEALED" ? "🕯️" : stage === "FINAL" ? "📜" : stage === "COMPLETE" ? "🏛️" : "⚔️"}</b>
      <div><strong>{stage}</strong><span>{cursor}/{total} events visible</span></div>
    </div>
  );
}

function participantPoints(participants: readonly CouncilParticipant[]): Map<string, Point> {
  const center = { x: 380, y: 216 };
  const radiusX = 286;
  const radiusY = 154;
  const count = Math.max(participants.length, 1);
  const start = count === 2 ? Math.PI : -Math.PI * 0.75;
  const points = new Map<string, Point>();
  participants.forEach((participant, index) => {
    const angle = count === 2
      ? start + index * Math.PI
      : start + index * ((Math.PI * 2) / count);
    points.set(participant.id, {
      x: center.x + Math.cos(angle) * radiusX,
      y: center.y + Math.sin(angle) * radiusY,
    });
  });
  return points;
}

function curvedEdge(source: Point, target: Point, index: number, strong: boolean) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.max(Math.hypot(dx, dy), 1);
  const ux = dx / length;
  const uy = dy / length;
  const start = { x: source.x + ux * 54, y: source.y + uy * 54 };
  const end = { x: target.x - ux * 58, y: target.y - uy * 58 };
  const normal = { x: -uy, y: ux };
  const bend = (strong ? 22 : 13) * (index % 2 === 0 ? 1 : -1);
  const control = {
    x: (start.x + end.x) / 2 + normal.x * bend,
    y: (start.y + end.y) / 2 + normal.y * bend,
  };
  return {
    d: `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`,
    label: {
      x: (start.x + 2 * control.x + end.x) / 4,
      y: (start.y + 2 * control.y + end.y) / 4,
    },
  };
}

function replayStage(visibleEvents: readonly CouncilEvent[], allEvents: readonly CouncilEvent[]): "READY" | "SEALED" | "DEBATE" | "FINAL" | "COMPLETE" {
  if (!visibleEvents.length) return "READY";
  if (visibleEvents.length >= allEvents.length) return "COMPLETE";
  const last = visibleEvents.at(-1)!;
  const finalRound = Math.max(...allEvents.map((event) => event.round));
  if (last.round === 1) return "SEALED";
  if (last.round === finalRound) return "FINAL";
  return "DEBATE";
}

function focusBlackboardEvent(eventId: string) {
  const element = document.getElementById(`council-event-${eventId}`);
  if (!element) return;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  element.focus({ preventScroll: true });
  element.animate(
    [
      { boxShadow: "0 0 0 0 rgba(241,209,138,0)" },
      { boxShadow: "0 0 0 4px rgba(241,209,138,.55), 0 0 36px rgba(241,209,138,.22)" },
      { boxShadow: "0 0 0 0 rgba(241,209,138,0)" },
    ],
    { duration: 1700, easing: "ease-out" },
  );
}

function edgeLabel(edge: AggregatedInfluenceEdge): string {
  const kinds = Object.entries(edge.kinds)
    .map(([kind, count]) => `${kind} ×${count}`)
    .join(", ");
  return `${edge.strength === "strong" ? "Strong influence" : "Interaction"}: ${kinds}`;
}

function participantName(participants: readonly CouncilParticipant[], id: string): string {
  return participants.find((participant) => participant.id === id)?.name ?? id;
}

function shortName(name: string): string {
  return name.length > 12 ? `${name.slice(0, 11)}…` : name;
}

function shortEvent(id: string | null): string {
  if (!id) return "event?";
  return id.length > 13 ? `…${id.slice(-11)}` : id;
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
