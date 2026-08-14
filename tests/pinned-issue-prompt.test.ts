import type { CouncilContext, CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import { buildProviderConsultationPrompt } from "../src/provider-sdk/consultation-agent.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

let tick = 0;

const participant: CouncilParticipant = { id: "claude", name: "Claude", provider: "test" };
const peer: CouncilParticipant = { id: "gpt", name: "ChatGPT", provider: "test" };

const oldQuestion = event({
  id: "old-q",
  round: 2,
  actorId: peer.id,
  kind: "question",
  targetActorId: participant.id,
  content: "This old direct question is still unanswered.",
});
const longEvents: CouncilEvent[] = [
  event({ id: "old-claim", round: 1, actorId: peer.id, kind: "argument", stance: "A", content: "Old claim.", confidence: .7 }),
  oldQuestion,
];
for (let index = 0; index < 16; index += 1) {
  longEvents.push(event({
    id: `filler-${index}`,
    round: 3 + Math.floor(index / 4),
    actorId: index % 2 ? participant.id : peer.id,
    kind: "argument",
    stance: `Recent ${index % 2}`,
    content: `Recent filler ${index}.`,
    confidence: .6,
  }));
}

const longContext: CouncilContext = {
  sessionId: "pinned-prompt-long",
  question: "Will old unresolved direct requests survive?",
  mode: "balanced",
  phase: "debate",
  round: 7,
  participant,
  publicEvents: longEvents,
  ownEvents: longEvents.filter((item) => item.actorId === participant.id),
};
const longPrompt = buildProviderConsultationPrompt(longContext);
assert(longPrompt.includes("CHATCHAT_PINNED_OPEN_ISSUES"), "Actual BrowserConsultationAgent prompt path must contain a pinned-old-issue block when conflict memory is used.");
const sourceIds = parseJsonLine(longPrompt, "PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON") as string[];
assert(sourceIds.includes("old-q"), "Pinned issue attention block must preserve the exact old question source event id.");
const visibleIds = parseJsonLine(longPrompt, "PUBLIC_SNAPSHOT_EVENT_IDS_JSON") as string[];
assert(visibleIds.includes("old-q"), "An id cannot be presented as a pinned response opportunity unless it is in the exact visible public snapshot.");
assert(longPrompt.includes("this block adds attention, not new evidence"), "Pinned issue attention must not masquerade as evidence.");
assert(longPrompt.includes("no event extra authority, truth status, vote weight, speaking priority"), "Pinned issue attention must preserve participant equality.");
assert(longPrompt.includes("address it when reasonably possible before adding unrelated new points"), "A restored old direct request should become a real response opportunity.");

const shortEvents: CouncilEvent[] = [oldQuestion, ...longEvents.slice(-6)];
const shortContext: CouncilContext = {
  ...longContext,
  sessionId: "pinned-prompt-short",
  round: 6,
  publicEvents: shortEvents,
  ownEvents: shortEvents.filter((item) => item.actorId === participant.id),
};
const shortPrompt = buildProviderConsultationPrompt(shortContext);
assert(!shortPrompt.includes("CHATCHAT_PINNED_OPEN_ISSUES"), "An open issue already inside the normal bounded snapshot should not receive a second artificial priority block.");
assert((parseJsonLine(shortPrompt, "PINNED_OPEN_ISSUE_EVENT_IDS_JSON") as unknown[]).length === 0, "Normal visible open issues must not be mislabeled as context pins.");

console.log("✓ ChatChat pinned old issue response-opportunity prompt tests passed");
console.log("✓ Conflict memory restores attention without turning every open issue into privileged content");

function event<T extends Omit<CouncilEvent, "sessionId" | "createdAt">>(value: T): CouncilEvent {
  return {
    ...value,
    sessionId: "pinned-issue-test",
    createdAt: `2026-08-15T01:00:${String(tick++).padStart(2, "0")}.000Z`,
  } as CouncilEvent;
}

function parseJsonLine(prompt: string, label: string): unknown {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const raw = prompt.match(new RegExp(`${escaped}:\\s*([^\\n]+)`))?.[1];
  if (!raw) throw new Error(`Missing ${label}`);
  return JSON.parse(raw);
}
