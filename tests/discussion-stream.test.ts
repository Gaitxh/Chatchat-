import type { CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import { buildDiscussionStream } from "../src/theater/discussion-stream.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "gpt", name: "ChatGPT", provider: "openai" },
  { id: "claude", name: "Claude", provider: "anthropic" },
  { id: "gemini", name: "Gemini", provider: "google" },
];

const events: CouncilEvent[] = [
  {
    id: "gpt-r1", sessionId: "session", round: 1, actorId: "gpt", kind: "argument",
    stance: "Ship web-first", content: "I prefer a web-first room.", confidence: .72, createdAt: "2026-08-14T00:00:01Z",
  },
  {
    id: "claude-r1", sessionId: "session", round: 1, actorId: "claude", kind: "argument",
    stance: "Extension-first", content: "Keep the extension visible.", confidence: .66, createdAt: "2026-08-14T00:00:02Z",
  },
  {
    id: "gemini-evidence", sessionId: "session", round: 2, actorId: "gemini", kind: "evidence",
    targetEventId: "claude-r1", claim: "Users abandon setup-heavy onboarding.",
    content: "A public study reports setup friction.", source: "https://example.com/research/setup",
    confidence: .84, createdAt: "2026-08-14T00:00:03Z",
  },
  {
    id: "gpt-challenge", sessionId: "session", round: 2, actorId: "gpt", kind: "challenge",
    targetEventId: "claude-r1", content: "What user benefit justifies exposing setup?", createdAt: "2026-08-14T00:00:04Z",
  },
  {
    id: "claude-revision", sessionId: "session", round: 3, actorId: "claude", kind: "revision",
    previousEventId: "claude-r1", stance: "Ship web-first",
    content: "The evidence changes my recommendation.", confidence: .82,
    causedBy: ["gemini-evidence", "gpt-challenge"], createdAt: "2026-08-14T00:00:05Z",
  },
  {
    id: "gemini-question", sessionId: "session", round: 3, actorId: "gemini", kind: "question",
    targetActorId: "gpt", content: "How should login recovery work?", createdAt: "2026-08-14T00:00:06Z",
  },
  {
    id: "gpt-answer", sessionId: "session", round: 4, actorId: "gpt", kind: "argument",
    stance: "Ship web-first", content: "Login recovery should resume automatically after the provider becomes ready.", confidence: .86,
    replyToEventId: "gemini-question", createdAt: "2026-08-14T00:00:07Z",
  },
  {
    id: "gpt-final", sessionId: "session", round: 5, actorId: "gpt", kind: "final_position",
    stance: "Ship web-first", content: "Final: web-first, invisible bridge.", confidence: .9,
    createdAt: "2026-08-14T00:00:08Z",
  },
];

const model = buildDiscussionStream(participants, events);
assert(model.eventCount === events.length, "Every public structured event should become one discussion entry.");
assert(model.rounds.length === 5, "The discussion should preserve all five public rounds.");
assert(model.rounds[0]?.phase === "sealed", "Round 1 must remain visibly identified as the sealed independent round.");
assert(model.rounds[4]?.phase === "final", "A final-position round must be labeled final.");

const challenge = model.rounds[1]?.entries.find((entry) => entry.id === "gpt-challenge");
assert(challenge?.targetActorName === "Claude", "Challenge target must come from targetEventId provenance.");
assert(challenge?.targetExcerpt === "Keep the extension visible.", "Target excerpt must come from the referenced event, not inferred prose.");

const evidence = model.rounds[1]?.entries.find((entry) => entry.id === "gemini-evidence");
assert(evidence?.sourceHost === "example.com", "Evidence should expose a safe parsed web host.");
assert(evidence?.targetActorName === "Claude", "Evidence target must resolve through its explicit target event.");

const revision = model.rounds[2]?.entries.find((entry) => entry.id === "claude-revision");
assert(revision?.previousStance === "Extension-first", "Revision should show the explicitly referenced previous stance.");
assert(revision?.causes.length === 2, "Revision should retain every resolvable causedBy event.");
assert(revision?.causes[0]?.actorName === "Gemini", "Revision causes should identify the event author.");
assert(revision?.causes[0]?.kind === "evidence", "Revision causes should preserve structured event kinds.");

const question = model.rounds[2]?.entries.find((entry) => entry.id === "gemini-question");
assert(question?.targetActorName === "ChatGPT", "Direct questions should use explicit targetActorId provenance.");

const answer = model.rounds[3]?.entries.find((entry) => entry.id === "gpt-answer");
assert(answer?.replyToEventId === "gemini-question", "Direct answer must keep the exact explicit reply event id.");
assert(answer?.replyToActorName === "Gemini", "Direct answer must resolve the peer identity from the referenced public event.");
assert(answer?.replyToExcerpt === "How should login recovery work?", "Direct answer must show a bounded excerpt from the exact question it answers.");

const proseOnly: CouncilEvent[] = [{
  id: "prose", sessionId: "session-2", round: 1, actorId: "gpt", kind: "argument",
  stance: "Maybe", content: "I am answering Claude: this is a reply to your point.", confidence: .5,
  createdAt: "2026-08-14T00:01:00Z",
}];
const proseModel = buildDiscussionStream(participants, proseOnly);
assert(!proseModel.rounds[0]?.entries[0]?.targetActorName, "Names mentioned in prose must never fabricate a relationship.");
assert(!proseModel.rounds[0]?.entries[0]?.replyToActorName, "Reply language in prose must never fabricate a direct reply edge.");
assert(proseModel.rounds[0]?.entries[0]?.causes.length === 0, "Prose alone must never fabricate persuasion causes.");

console.log("✓ ChatChat traceable live discussion stream tests passed");
console.log("✓ Explicit direct replies render as real peer threads while prose-only reply claims remain inert");
