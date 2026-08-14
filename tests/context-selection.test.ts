import type { CouncilContext, CouncilEvent, CouncilParticipant } from "../src/core/types.js";
import {
  DEFAULT_PROVIDER_CONTEXT_EVENTS,
  DEFAULT_PROVIDER_PINNED_ISSUE_EVENTS,
  selectProviderContextEvents,
} from "../src/provider-sdk/context-selection.js";
import { buildProviderConsultationPrompt } from "../src/provider-sdk/consultation-protocol.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "a", name: "ChatGPT", provider: "test" },
  { id: "b", name: "Claude", provider: "test" },
  { id: "c", name: "Gemini", provider: "test" },
];

const events = longMeeting();
assert(events.length > DEFAULT_PROVIDER_CONTEXT_EVENTS, "Fixture must exceed the normal Provider context window.");
const selection = selectProviderContextEvents(events);
const selectedIds = selection.events.map((event) => event.id);

assert(selection.events.length === DEFAULT_PROVIDER_CONTEXT_EVENTS, "Conflict-aware selection must keep the same bounded 12-event budget.");
assert(selection.pinnedEventIds.length <= DEFAULT_PROVIDER_PINNED_ISSUE_EVENTS, "Pinned open-issue events must stay inside the 6-event pin budget.");
assert(selectedIds.includes("q-old"), "An early targeted direct question must remain in Provider context while it is unresolved.");
assert(selectedIds.includes("challenge-old"), "An early unanswered challenge must remain in Provider context.");
assert(selectedIds.includes("arg-old"), "Pinned challenge must carry its exact challenged event so the reference remains intelligible and parser-valid.");
assert(selectedIds.includes("evidence-old"), "Old targeted evidence awaiting response must remain in Provider context.");
assert(selectedIds.includes("uncertain-old"), "Explicit unresolved uncertainty should remain eligible for bounded conflict memory.");
assert(selection.pinnedIssueSourceEventIds.includes("q-old"), "Selection audit must expose which open issue sources caused pinning.");
assert(selection.pinnedIssueSourceEventIds.includes("challenge-old"), "Pinned issue source audit must preserve challenge provenance.");
assert(isChronological(selection.events, events), "Pinned and recent events must be restored to original Blackboard chronology.");
assert(new Set(selectedIds).size === selectedIds.length, "Pinned/recent overlap must never duplicate an event in the Provider prompt.");

const baselineRecent = events.slice(-DEFAULT_PROVIDER_CONTEXT_EVENTS).map((event) => event.id);
assert(!baselineRecent.includes("q-old") && selectedIds.includes("q-old"), "The test must prove conflict pinning changes plain slice(-12) behavior.");
assert(selection.recentEventIds.every((id) => selectedIds.includes(id)), "Every reported recency event must actually be selected.");

const answeredEvents = events.concat([
  event({ id: "answer-q-old", round: 7, actorId: "b", kind: "argument", stance: "B2", content: "Explicitly answers the old direct question.", confidence: .82, replyToEventId: "q-old" }),
  event({ id: "answer-challenge-old", round: 7, actorId: "a", kind: "defense", targetEventId: "challenge-old", content: "Explicitly answers the old challenge." }),
  event({ id: "answer-evidence-old", round: 7, actorId: "a", kind: "argument", stance: "A2", content: "Addresses the targeted old evidence.", confidence: .84, replyToEventId: "evidence-old" }),
  event({ id: "final-c", round: 7, actorId: "c", kind: "final_position", stance: "C resolved", content: "My uncertainty is resolved.", confidence: .9, caveats: [] }),
]);
const answeredSelection = selectProviderContextEvents(answeredEvents);
assert(!answeredSelection.pinnedIssueSourceEventIds.includes("q-old"), "Answered old question must stop consuming pinned conflict memory.");
assert(!answeredSelection.pinnedIssueSourceEventIds.includes("challenge-old"), "Answered old challenge must stop consuming pinned conflict memory.");
assert(!answeredSelection.pinnedIssueSourceEventIds.includes("evidence-old"), "Answered old evidence must stop consuming pinned conflict memory.");
assert(!answeredSelection.pinnedIssueSourceEventIds.includes("uncertain-old"), "Resolved uncertainty must stop consuming pinned conflict memory.");

const tiny = selectProviderContextEvents(events, { maxEvents: 5, maxPinnedIssueEvents: 3 });
assert(tiny.events.length === 5, "Custom test budget must remain exact.");
assert(tiny.pinnedEventIds.length <= 3, "Custom pin budget must be enforced.");
assert(isChronological(tiny.events, events), "Custom bounded selection must preserve chronology.");

const debateContext: CouncilContext = {
  sessionId: "context-selection-session",
  question: "Keep old unresolved issues visible?",
  mode: "balanced",
  phase: "debate",
  round: 7,
  participant: participants[0]!,
  publicEvents: events,
  ownEvents: events.filter((item) => item.actorId === "a"),
};
const prompt = buildProviderConsultationPrompt(debateContext);
const promptSnapshotIds = parseJsonLine(prompt, "PUBLIC_SNAPSHOT_EVENT_IDS_JSON");
const promptPinnedIds = parseJsonLine(prompt, "PINNED_OPEN_ISSUE_EVENT_IDS_JSON");
const promptEvents = parseJsonLine(prompt, "CONSULTATION_EVENTS_JSON") as Array<{ id?: unknown }>;
const promptEventIds = promptEvents.map((item) => item.id).filter((id): id is string => typeof id === "string");
assert(JSON.stringify(promptSnapshotIds) === JSON.stringify(selection.events.map((item) => item.id)), "Prompt snapshot audit ids must exactly match conflict-aware selected events.");
assert(JSON.stringify(promptEventIds) === JSON.stringify(promptSnapshotIds), "CONSULTATION_EVENTS_JSON and PUBLIC_SNAPSHOT_EVENT_IDS_JSON must describe the same exact selected events.");
assert(JSON.stringify(promptPinnedIds) === JSON.stringify(selection.pinnedEventIds), "Prompt must explicitly audit which selected events were pinned for unresolved conflict memory.");
assert(prompt.includes("Pinned events have memory priority only; they do not gain authority"), "Prompt must tell Providers that conflict pinning changes memory, not authority.");

const sealedContext: CouncilContext = {
  ...debateContext,
  phase: "sealed",
  round: 1,
  publicEvents: [],
  ownEvents: [],
};
const sealedPrompt = buildProviderConsultationPrompt(sealedContext);
assert(parseJsonLine(sealedPrompt, "PUBLIC_SNAPSHOT_EVENT_IDS_JSON").length === 0, "Sealed round must remain independent with no public conflict context.");
assert(parseJsonLine(sealedPrompt, "PINNED_OPEN_ISSUE_EVENT_IDS_JSON").length === 0, "Sealed round must not invent pinned conflict events.");

let badBudgetRejected = false;
try {
  selectProviderContextEvents(events, { maxEvents: 0 });
} catch {
  badBudgetRejected = true;
}
assert(badBudgetRejected, "Context selector must reject invalid event budgets instead of silently becoming unbounded.");

console.log("✓ ChatChat conflict-aware Provider context selection tests passed");
console.log("✓ Old unresolved obligations survive a bounded context window without gaining authority");

function longMeeting(): CouncilEvent[] {
  const result: CouncilEvent[] = [
    event({ id: "arg-old", round: 1, actorId: "a", kind: "argument", stance: "A", content: "Old claim that remains challenged.", confidence: .7 }),
    event({ id: "q-old", round: 2, actorId: "a", kind: "question", targetActorId: "b", content: "Old direct question still owed by Claude." }),
    event({ id: "challenge-old", round: 2, actorId: "b", kind: "challenge", targetEventId: "arg-old", content: "Old challenge still owed by ChatGPT." }),
    event({ id: "evidence-old", round: 2, actorId: "c", kind: "evidence", targetEventId: "arg-old", claim: "Old evidence still awaiting ChatGPT response.", content: "Evidence detail.", confidence: .8 }),
    event({ id: "uncertain-old", round: 2, actorId: "c", kind: "uncertain", content: "Old explicit uncertainty.", confidence: .2 }),
  ];
  for (let index = 0; index < 18; index += 1) {
    result.push(event({
      id: `recent-${String(index).padStart(2, "0")}`,
      round: 3 + Math.floor(index / 4),
      actorId: index % 2 ? "a" : "b",
      kind: "argument",
      stance: index % 2 ? "Recent A" : "Recent B",
      content: `Recent unrelated event ${index}.`,
      confidence: .6,
    }));
  }
  return result;
}

let counter = 0;
function event<T extends Omit<CouncilEvent, "sessionId" | "createdAt">>(value: T): CouncilEvent {
  return {
    ...value,
    sessionId: "context-selection-test",
    createdAt: `2026-08-15T00:${String(Math.floor(counter / 60)).padStart(2, "0")}:${String(counter++ % 60).padStart(2, "0")}.000Z`,
  } as CouncilEvent;
}

function isChronological(selected: readonly CouncilEvent[], full: readonly CouncilEvent[]): boolean {
  const indexes = selected.map((event) => full.findIndex((candidate) => candidate.id === event.id));
  return indexes.every((value, index) => index === 0 || indexes[index - 1]! < value);
}

function parseJsonLine(prompt: string, label: string): any {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const raw = prompt.match(new RegExp(`${escaped}:\\s*([^\\n]+)`))?.[1];
  if (!raw) throw new Error(`Missing ${label}`);
  return JSON.parse(raw);
}
