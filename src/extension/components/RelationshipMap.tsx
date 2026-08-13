import { useMemo } from "react";
import type { CouncilEvent } from "../../core/types.js";
import type { Locale } from "../../i18n/index.js";
import { deriveRelationshipGraph, type RelationshipEdge, type RelationshipKind } from "../../theater/relationship-map.js";
import "./relationship-map.css";

export function RelationshipMap({ participants, events, locale }: {
  participants: readonly { id: string; name: string }[];
  events: readonly CouncilEvent[];
  locale: Locale;
}) {
  const graph = useMemo(() => deriveRelationshipGraph(
    participants.map((p) => ({ id: p.id, name: p.name, provider: p.id })), events,
  ), [participants, events]);
  const points = layout(participants.length);
  const pointById = new Map(participants.map((p, i) => [p.id, points[i]!]));
  const lastActor = events.at(-1)?.actorId;
  const copy = locale === "zh-CN"
    ? { kicker:"AI 关系战场", title:"谁正在影响谁？", body:"只有明确的结构化事件引用才会长出连线。普通文字提及不会。", empty:"目前还没有产生可追溯的跨 AI 关系。" }
    : { kicker:"RELATIONSHIP MAP", title:"Who is pushing whom?", body:"Only explicit structured event references create links. Prose mentions do not.", empty:"No explicit cross-participant relationship yet." };

  return <div className="relationship-map">
    <div className="relationship-map__heading"><div><span>{copy.kicker}</span><h4>{copy.title}</h4><p>{copy.body}</p></div><div className="relationship-map__legend"><span>⚔</span><span>🤝</span><span>📎</span><span>↻</span></div></div>
    {graph.edges.length ? <>
      <div className="relationship-stage">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <defs>{KINDS.map((kind) => <marker key={kind} id={`arrow-${kind}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L6,3 L0,6 z" className={`edge-arrow edge-${kind}`} /></marker>)}</defs>
          {graph.edges.slice(0,12).map((edge) => {
            const from = pointById.get(edge.fromActorId); const to = pointById.get(edge.toActorId);
            if (!from || !to) return null;
            return <path key={edge.id} d={curvedPath(from,to,edge)} className={`relationship-edge edge-${edge.kind}`} markerEnd={`url(#arrow-${edge.kind})`} style={{strokeWidth:Math.min(2.2,.85+edge.count*.22)}} />;
          })}
        </svg>
        {participants.map((participant,index) => {
          const point=points[index]!; const stats=graph.nodes.find((node)=>node.participantId===participant.id);
          return <div key={participant.id} className={`relationship-node ${lastActor===participant.id?"is-active":""}`} style={{left:`${point.x}%`,top:`${point.y}%`}}><b>{monogram(participant.name)}</b><strong>{participant.name}</strong><small>{nodeSignal(stats)}</small></div>;
        })}
      </div>
      <div className="relationship-ticker">{graph.edges.slice(0,3).map((edge)=><span key={edge.id} className={`ticker-${edge.kind}`}><b>{edgeIcon(edge.kind)}</b>{nameOf(participants,edge.fromActorId)} → {nameOf(participants,edge.toActorId)}<small>{edgeLabel(edge.kind,locale)}{edge.count>1?` ×${edge.count}`:""}</small></span>)}</div>
    </> : <div className="relationship-empty">{copy.empty}</div>}
  </div>;
}

const KINDS: RelationshipKind[]=["challenge","support","defense","question","concede","evidence","influence","evidence_influence"];
interface Point{x:number;y:number}
function layout(count:number):Point[]{if(count<=2)return[{x:23,y:50},{x:77,y:50}].slice(0,count);if(count===3)return[{x:50,y:16},{x:82,y:72},{x:18,y:72}];if(count===4)return[{x:50,y:13},{x:86,y:50},{x:50,y:87},{x:14,y:50}];return Array.from({length:count},(_,i)=>{const a=-Math.PI/2+Math.PI*2*i/count;return{x:50+Math.cos(a)*37,y:50+Math.sin(a)*37}})}
function curvedPath(from:Point,to:Point,edge:RelationshipEdge):string{const dx=to.x-from.x,dy=to.y-from.y,len=Math.max(1,Math.hypot(dx,dy)),ux=dx/len,uy=dy/len;const s={x:from.x+ux*10,y:from.y+uy*10},e={x:to.x-ux*11,y:to.y-uy*11};const bend=6*(edge.fromActorId.localeCompare(edge.toActorId)<0?1:-1);const m={x:(s.x+e.x)/2-uy*bend,y:(s.y+e.y)/2+ux*bend};return`M ${s.x} ${s.y} Q ${m.x} ${m.y} ${e.x} ${e.y}`}
function edgeIcon(kind:RelationshipKind){if(kind==="challenge")return"⚔";if(kind==="support")return"🤝";if(kind==="evidence"||kind==="evidence_influence")return"📎";if(kind==="influence")return"↻";if(kind==="question")return"?";if(kind==="concede")return"🏳";return"•"}
function edgeLabel(kind:RelationshipKind,locale:Locale){const zh=locale==="zh-CN";if(kind==="challenge")return zh?"质疑":"challenge";if(kind==="support")return zh?"支持":"support";if(kind==="evidence")return zh?"证据":"evidence";if(kind==="evidence_influence"||kind==="influence")return zh?"触发改口":"changed a view";if(kind==="question")return zh?"追问":"question";return zh?"互动":"interaction"}
function nameOf(ps:readonly{id:string;name:string}[],id:string){return ps.find((p)=>p.id===id)?.name??id}
function nodeSignal(stats:ReturnType<typeof deriveRelationshipGraph>["nodes"][number]|undefined){if(!stats)return"···";return[stats.revisionsMade?`↻${stats.revisionsMade}`:"",stats.evidenceSubmitted?`📎${stats.evidenceSubmitted}`:"",stats.challengesSent?`⚔${stats.challengesSent}`:""].filter(Boolean).join(" ")||"···"}
function monogram(name:string){if(/deepseek/i.test(name))return"D";if(/gemini/i.test(name))return"Gm";if(/claude/i.test(name))return"C";if(/qwen|通义/i.test(name))return"Q";if(/gpt/i.test(name))return"G";return name.slice(0,2).toUpperCase()}
