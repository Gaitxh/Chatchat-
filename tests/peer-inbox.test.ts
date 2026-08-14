import { buildDirectPeerInbox } from "../src/consultation/peer-inbox.js";
import type { CouncilContext, CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import { buildProviderConsultationPrompt } from "../src/provider-sdk/consultation-agent.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const alice: CouncilParticipant = { id: "alice", name: "Alice AI", provider: "provider-a" };
const bob: CouncilParticipant = { id: "bob", name: "Bob AI", provider: "provider-b" };
const carol: CouncilParticipant = { id: "carol", name: "Carol AI", provider: "provider-c" };

const events: CouncilEvent[] = [
  {
    id: "alice-r1", sessionId: "peer-inbox", round: 1, actorId: "alice", kind: "argument",
    stance: "A", content: "Ship the web-first room.", confidence: .78, createdAt: "2026-08-14T00:00:01Z",
  },
  {
    id: "bob-r1", sessionId: "peer-inbox", round: 1, actorId: "bob", kind: "argument",
    stance: "B", content: "Keep more UI in the extension.", confidence: .63, createdAt: "2026-08-14T00:00:02Z",
  },
  {
    id: "stale-question", sessionId: "peer-inbox", round: 1, actorId: "carol", kind: "question",
    targetActorId: "alice", content: "This old question should not keep repeating forever.", createdAt: "2026-08-14T00:00:03Z",
  },
  {
    id: "challenge-alice", sessionId: "peer-inbox", round: 2, actorId: "bob", kind: "challenge",
    targetEventId: "alice-r1", content: "How does this work when the browser bridge is missing?", createdAt: "2026-08-14T00:00:04Z",
  },
  {
    id: "question-alice", sessionId: "peer-inbox", round: 2, actorId: "carol", kind: "question",
    targetActorId: "alice", content: "What recovery path do you propose?", createdAt: "2026-08-14T00:00:05Z",
  },
  {
    id: "evidence-alice", sessionId: "peer-inbox", round: 2, actorId: "carol", kind: "evidence",
    targetEventId: "alice-r1", claim: "A browser limitation affects the proposal.",
    content: "The public platform documentation describes the boundary.", source: "https://example.com/platform",
    confidence: .84, createdAt: "2026-08-14T00:00:06Z",
  },
  {
    id: "challenge-bob", sessionId: "peer-inbox", round: 2, actorId: "carol", kind: "challenge",
    targetEventId: "bob-r1", content: "This challenge belongs in Bob's inbox, not Alice's.", createdAt: "2026-08-14T00:00:07Z",
  },
  {
    id: "room-question", sessionId: "peer-inbox", round: 2, actorId: "bob", kind: "question",
    content: "A room-wide question has no direct target.", createdAt: "2026-08-14T00:00:08Z",
  },
];

const aliceContext = context(alice, events, 3);
const inbox = buildDirectPeerInbox(aliceContext);
assert(inbox.length === 3, "Alice should receive exactly the latest-round events explicitly directed at Alice or Alice's prior event.");
assert(inbox.map((item) => item.eventId).join(",") === "challenge-alice,question-alice,evidence-alice", "Peer inbox must preserve public event order.");
assert(inbox[0]?.targetEventId === "alice-r1", "A targeted challenge must keep the exact prior event id it challenged.");
assert(inbox[0]?.targetExcerpt === "Ship the web-first room.", "A targeted challenge should carry a bounded excerpt of the explicitly referenced event.");
assert(inbox[2]?.kind === "evidence", "Targeted evidence must become a response opportunity too.");
assert(!inbox.some((item) => item.eventId === "stale-question"), "Older-round direct questions must not repeat forever.");
assert(!inbox.some((item) => item.eventId === "challenge-bob"), "A challenge against another participant must never appear in Alice's inbox.");
assert(!inbox.some((item) => item.eventId === "room-question"), "A room-wide question without targetActorId must not fabricate a direct obligation.");

const alicePrompt = buildProviderConsultationPrompt(aliceContext);
assert(alicePrompt.includes("CHATCHAT_DIRECT_PEER_INBOX"), "Real provider prompt path must include the direct peer inbox when Alice is explicitly targeted.");
assert(alicePrompt.includes("challenge-alice") && alicePrompt.includes("question-alice") && alicePrompt.includes("evidence-alice"), "Provider prompt must expose each traceable inbox event id.");
assert(alicePrompt.includes("response opportunity, not authority"), "Direct attention must never create hierarchy or pressure to agree.");
assert(alicePrompt.includes("defend, concede, revise"), "Prompt must make explicit peer response actions available.");
assert(alicePrompt.includes("Never invent an event id"), "Peer reply provenance must remain strict.");

const bobInbox = buildDirectPeerInbox(context(bob, events, 3));
assert(bobInbox.length === 1 && bobInbox[0]?.eventId === "challenge-bob", "Each participant must receive only their own direct inbox from the same immutable snapshot.");

const noDebateInbox = buildDirectPeerInbox({ ...aliceContext, phase: "final" });
assert(noDebateInbox.length === 0, "Final phase must not invent a second debate obligation after public deliberation closes.");

const manyQuestions: CouncilEvent[] = [events[0]!, ...Array.from({ length: 6 }, (_, index): CouncilEvent => ({
  id: `q-${index + 1}`,
  sessionId: "peer-inbox-bounded",
  round: 2,
  actorId: index % 2 ? "bob" : "carol",
  kind: "question",
  targetActorId: "alice",
  content: `Direct question ${index + 1}`,
  createdAt: `2026-08-14T00:01:0${index}Z`,
}))];
const bounded = buildDirectPeerInbox(context(alice, manyQuestions, 3));
assert(bounded.length === 4, "Peer inbox must stay bounded so direct replies cannot crowd the proposal out of the prompt.");
assert(bounded[0]?.eventId === "q-3" && bounded[3]?.eventId === "q-6", "When over capacity, the bounded inbox should preserve the four most recent direct events in order.");

const quietContext = context(alice, [events[0]!, events[1]!], 2);
assert(!buildProviderConsultationPrompt(quietContext).includes("CHATCHAT_DIRECT_PEER_INBOX"), "A participant with no direct target must not receive a fabricated peer inbox block.");

console.log("✓ ChatChat direct peer inbox tests passed");
console.log("✓ Latest-round questions, challenges and targeted evidence get a bounded response opportunity without creating authority");

function context(
  participant: CouncilParticipant,
  publicEvents: readonly CouncilEvent[],
  round: number,
): CouncilContext {
  return {
    sessionId: "peer-inbox",
    question: "Should ChatChat be a web-first consultation room?",
    mode: "balanced",
    phase: "debate",
    round,
    participant,
    publicEvents,
    ownEvents: publicEvents.filter((event) => event.actorId === participant.id),
  };
}
