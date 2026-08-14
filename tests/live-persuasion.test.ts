import type { CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import { deriveLivePersuasionMoments } from "../src/theater/live-persuasion.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "a", name: "ChatGPT", provider: "test" },
  { id: "b", name: "Claude", provider: "test" },
  { id: "c", name: "Gemini", provider: "test" },
];

const events: CouncilEvent[] = [
  event({ id: "arg-a", round: 1, actorId: "a", kind: "argument", stance: "A", content: "Choose A.", confidence: 0.8 }),
  event({ id: "arg-b", round: 1, actorId: "b", kind: "argument", stance: "B", content: "Choose B.", confidence: 0.8 }),
  event({ id: "arg-c", round: 1, actorId: "c", kind: "argument", stance: "C", content: "Choose C.", confidence: 0.8 }),
  event({ id: "evidence-a", round: 2, actorId: "a", kind: "evidence", targetEventId: "arg-b", claim: "Primary evidence favors A", content: "A primary source contradicts B.", source: "https://example.com/source", confidence: 0.95 }),
  event({ id: "support-c", round: 2, actorId: "c", kind: "support", targetEventId: "arg-a", content: "I support A." }),
  event({ id: "revision-b", round: 3, actorId: "b", kind: "revision", previousEventId: "arg-b", stance: "A", content: "The evidence changes my position to A.", confidence: 0.9, causedBy: ["evidence-a"] }),
  event({ id: "self-revision-a", round: 3, actorId: "a", kind: "revision", previousEventId: "arg-a", stance: "A+", content: "I refine my own position.", confidence: 0.9, causedBy: ["arg-a"] }),
  event({ id: "concede-c", round: 3, actorId: "c", kind: "concede", targetEventId: "arg-a", content: "I concede this point to A." }),
];

const moments = deriveLivePersuasionMoments(participants, events);
assert(moments.length === 2, "Only canonical strong cross-peer revision/concede edges should become live persuasion moments.");

const revision = moments.find((moment) => moment.kind === "revision");
assert(revision, "Cross-peer caused revision must become a live persuasion moment.");
assert(revision.influencerActorId === "a" && revision.changingActorId === "b", "Evidence author must be shown as influencing the revising participant.");
assert(revision.causeEventId === "evidence-a" && revision.actionEventId === "revision-b", "Persuasion moment must retain exact cause and action provenance.");
assert(revision.causeKind === "evidence", "Persuasion moment must retain the causal event kind.");
assert(revision.fromStance === "B" && revision.toStance === "A", "Revision must expose the real B → A stance transition.");

const concession = moments.find((moment) => moment.kind === "concede");
assert(concession, "Explicit concession to a peer must become a strong live persuasion moment.");
assert(concession.influencerActorId === "a" && concession.changingActorId === "c", "Concession direction must run from the credited peer to the conceding participant.");
assert(concession.causeEventId === "arg-a" && concession.actionEventId === "concede-c", "Concession must retain target argument and concession event provenance.");
assert(concession.fromStance === null && concession.toStance === null, "Concession must not fabricate a stance transition the protocol did not declare.");

assert(!moments.some((moment) => moment.actionEventId === "self-revision-a"), "Self-caused revision must not masquerade as peer persuasion.");
assert(!moments.some((moment) => moment.actionEventId === "support-c"), "Ordinary support must remain an interaction, not be promoted to strong persuasion.");

console.log("✓ ChatChat live persuasion provenance tests passed");

let timestamp = 0;
function event<T extends Omit<CouncilEvent, "sessionId" | "createdAt">>(value: T): CouncilEvent {
  return {
    ...value,
    sessionId: "live-persuasion-test",
    createdAt: `2026-08-14T00:00:${String(timestamp++).padStart(2, "0")}.000Z`,
  } as CouncilEvent;
}
