import type { CouncilEvent, CouncilParticipant, CouncilReport } from "../src/core/types.js";
import {
  deriveResponseObligationSummary,
  responseObligationsSvgBadge,
  safeResponseObligationsMarkdown,
} from "../src/consultation/response-obligation-summary.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "alice", name: "Alice <script>", provider: "a" },
  { id: "bob", name: "Bob", provider: "b" },
  { id: "carol", name: "Carol", provider: "c" },
];
const base = { sessionId: "response-obligation-summary", createdAt: "2026-08-21T00:00:00.000Z" };
const events: CouncilEvent[] = [
  { ...base, id: "alice-arg", round: 1, actorId: "alice", kind: "argument", stance: "A", content: "Keep the boundary explicit.", confidence: .8 },
  { ...base, id: "sealed-question", round: 1, actorId: "bob", kind: "question", targetActorId: "alice", content: "Synthetic sealed targeting must never punch through later." },
  { ...base, id: "bob-question", round: 2, actorId: "bob", kind: "question", targetActorId: "alice", content: "Will user-owned tabs stay untouched?" },
  { ...base, id: "bob-challenge", round: 2, actorId: "bob", kind: "challenge", targetEventId: "alice-arg", content: "The ownership gate needs a mechanical receipt." },
  { ...base, id: "carol-evidence", round: 2, actorId: "carol", kind: "evidence", targetEventId: "alice-arg", claim: "Existing conversations are user-owned work.", content: "This evidence still needs Alice's attention.", confidence: .9 },
  { ...base, id: "carol-third-party", round: 3, actorId: "carol", kind: "argument", stance: "A", content: "I answer for Alice.", confidence: .5, replyToEventId: "bob-question" },
  { ...base, id: "alice-answer", round: 3, actorId: "alice", kind: "argument", stance: "A", content: "Yes. Background automation is managed-tab only.", confidence: .9, replyToEventId: "bob-question" },
  { ...base, id: "alice-defense", round: 3, actorId: "alice", kind: "defense", targetEventId: "bob-challenge", content: "The ownership receipt gates automatic navigation." },
];

const report = createReport(["carol-evidence"]);
const summary = deriveResponseObligationSummary(report, events);
assert(summary.total === 3, "Only public R2+ direct question/challenge/targeted-evidence obligations should appear in the final response ledger.");
assert(!summary.items.some((item) => item.requestEventId === "sealed-question"), "A sealed round-one targeted request must never become a final public response debt.");
assert(summary.answered === 2 && summary.pending === 1, "The final receipt must distinguish answered from still-pending named requests.");
assert(summary.unansweredEventIds.join(",") === "carol-evidence", "Pending request IDs must preserve the exact canonical event id.");
assert(summary.reportMatchesCanonical === true, "New CouncilReport unanswered ids must match the canonical public receipt ledger.");

const question = summary.items.find((item) => item.requestEventId === "bob-question");
assert(question?.status === "answered", "Alice's exact replyTo edge should close Bob's question.");
assert(question?.responseEventId === "alice-answer" && question.responseKind === "argument" && question.responseRound === 3, "The share summary must retain the exact answering event, kind and round.");
assert(question?.targetActor === "Alice <script>", "The display layer should preserve the participant name before share escaping.");

const challenge = summary.items.find((item) => item.requestEventId === "bob-challenge");
assert(challenge?.status === "answered" && challenge.responseEventId === "alice-defense" && challenge.responseKind === "defense", "A canonical defense should produce an answered challenge receipt.");

const evidence = summary.items.find((item) => item.requestEventId === "carol-evidence");
assert(evidence?.status === "pending" && !evidence.responseEventId, "Unanswered targeted evidence must remain visibly pending at meeting close.");

const markdown = safeResponseObligationsMarkdown(summary, "en");
assert(markdown.includes("Response obligations") && markdown.includes("2/3 answered") && markdown.includes("1 pending"), "English share output should summarize answer coverage without inventing a score.");
assert(markdown.includes("bob-question") && markdown.includes("alice-answer") && markdown.includes("carol-evidence"), "Share output must retain exact request/response provenance IDs.");
assert(!markdown.includes("sealed-question"), "Share output must preserve round-one independence by excluding sealed targeting.");
assert(markdown.includes("unanswered when the meeting ended"), "Pending debt must be explicit in share output.");
assert(markdown.includes("does not prove the requester was correct") && markdown.includes("never requires agreement"), "Share output must preserve the response-duty-not-agreement-duty boundary.");
assert(!markdown.includes("<script>"), "Participant display names must not inject raw HTML into copied Markdown.");
assert(markdown.includes("Alice &lt;script&gt;"), "Participant names should remain visible through safe HTML escaping.");

const zhMarkdown = safeResponseObligationsMarkdown(summary, "zh-CN");
assert(zhMarkdown.includes("答辩收据") && zhMarkdown.includes("会议结束时仍未回应"), "Chinese response-obligation sharing must be first-class.");
assert(zhMarkdown.includes("不要求被点名者同意"), "Chinese copy must preserve the no-forced-agreement rule.");

const svg = responseObligationsSvgBadge("<svg><g></g></svg>", summary, "en");
assert(svg.includes('data-response-obligations-svg="true"'), "SVG export should receive a compact response-obligation badge.");
assert(svg.includes("Responses 2/3 answered") && svg.includes("1 pending") && svg.includes("carol-evidence"), "SVG badge should expose final response debt without semantic inference.");

const legacyReport = createReport(undefined);
assert(deriveResponseObligationSummary(legacyReport, events).reportMatchesCanonical === null, "Old reports with canonical pending debt but no unansweredDirectRequestEventIds must remain legacy/unknown instead of being post-hoc called consistent.");
const cleanEvents = events.filter((event) => event.id !== "carol-evidence");
const cleanReport = createReport(undefined);
assert(deriveResponseObligationSummary(cleanReport, cleanEvents).reportMatchesCanonical === true, "A current clean meeting may legitimately omit an empty unanswered-id field.");
const mismatchedReport = createReport(["bob-question"]);
assert(deriveResponseObligationSummary(mismatchedReport, events).reportMatchesCanonical === false, "A report/ledger mismatch must remain visible rather than silently normalized.");

console.log("✓ ChatChat final response-obligation summary/share tests passed");
console.log("✓ Named response receipts expose exact R2+ answer provenance and pending debt without requiring agreement");

function createReport(unanswered: string[] | undefined): CouncilReport {
  return {
    sessionId: base.sessionId,
    question: "How should ChatChat enforce Provider-tab automation boundaries?",
    mode: "balanced",
    stopReason: "round_budget",
    ...(unanswered ? { unansweredDirectRequestEventIds: unanswered } : {}),
    consensusStance: "A",
    consensusRatio: 1,
    confidence: .8,
    rounds: 3,
    positions: participants.map((participant) => ({ participant, stance: "A", content: "Final.", confidence: .8, caveats: [] })),
    disagreements: [],
    eventCount: events.length,
  };
}
