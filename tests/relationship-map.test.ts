import type { CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import { deriveRelationshipGraph } from "../src/theater/relationship-map.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "gpt", name: "ChatGPT", provider: "openai" },
  { id: "claude", name: "Claude", provider: "anthropic" },
  { id: "gemini", name: "Gemini", provider: "google" },
];

const events: CouncilEvent[] = [
  { id:"g1",sessionId:"s",round:1,actorId:"gpt",kind:"argument",stance:"A",content:"A",confidence:.7,createdAt:"1" },
  { id:"c1",sessionId:"s",round:1,actorId:"claude",kind:"argument",stance:"B",content:"B",confidence:.7,createdAt:"2" },
  { id:"m1",sessionId:"s",round:1,actorId:"gemini",kind:"argument",stance:"A",content:"A",confidence:.8,createdAt:"3" },
  { id:"gc",sessionId:"s",round:2,actorId:"gpt",kind:"challenge",targetEventId:"c1",content:"Why?",createdAt:"4" },
  { id:"ms",sessionId:"s",round:2,actorId:"gemini",kind:"support",targetEventId:"g1",content:"Agree.",createdAt:"5" },
  { id:"me",sessionId:"s",round:2,actorId:"gemini",kind:"evidence",targetEventId:"c1",claim:"claim",content:"evidence",source:"https://example.com",confidence:.8,createdAt:"6" },
  { id:"cr",sessionId:"s",round:2,actorId:"claude",kind:"revision",previousEventId:"c1",stance:"A",content:"Changed.",confidence:.85,causedBy:["me"],createdAt:"7" },
  { id:"cq",sessionId:"s",round:2,actorId:"claude",kind:"question",targetActorId:"gpt",content:"Cost?",createdAt:"8" },
  { id:"ga",sessionId:"s",round:3,actorId:"gpt",kind:"argument",stance:"A",content:"The recovery path has no extra user setup cost.",confidence:.82,replyToEventId:"cq",createdAt:"9" },
];

const graph = deriveRelationshipGraph(participants, events);
const has = (kind: string, from: string, to: string) => graph.edges.some((edge) => edge.kind === kind && edge.fromActorId === from && edge.toActorId === to);
assert(has("challenge","gpt","claude"), "Challenge edge must follow targetEventId provenance.");
assert(has("support","gemini","gpt"), "Support edge must follow targetEventId provenance.");
assert(has("evidence","gemini","claude"), "Evidence edge must use an explicit target event.");
assert(has("evidence_influence","gemini","claude"), "Evidence-caused revision must create an influence edge.");
assert(has("question","claude","gpt"), "Question edge must require targetActorId.");
assert(has("reply","gpt","claude"), "Direct answer must create a distinct reply edge back to the author of the exact referenced question.");
const reply = graph.edges.find((edge) => edge.kind === "reply" && edge.fromActorId === "gpt" && edge.toActorId === "claude");
assert(reply?.eventIds.includes("cq") && reply.eventIds.includes("ga"), "Reply relationship must retain both the question and answer event ids for provenance.");
const claude = graph.nodes.find((node) => node.participantId === "claude");
assert(claude?.revisionsMade === 1 && claude.influenceReceived === 1, "Revision influence must come from causedBy.");

const proseOnly: CouncilEvent[] = [
  { id:"a",sessionId:"s",round:1,actorId:"gpt",kind:"argument",stance:"A",content:"Claude is wrong and I am replying to Claude.",confidence:.7,createdAt:"1" },
  { id:"b",sessionId:"s",round:1,actorId:"claude",kind:"argument",stance:"B",content:"Gemini agrees with me.",confidence:.7,createdAt:"2" },
];
assert(deriveRelationshipGraph(participants, proseOnly).edges.length === 0, "Prose alone must never invent graph edges, including fake reply claims.");
console.log("✓ ChatChat explicit relationship graph tests passed");
console.log("✓ Direct reply arrows require explicit replyToEventId provenance");
