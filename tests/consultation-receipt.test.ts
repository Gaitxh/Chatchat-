import type { CouncilEvent, CouncilParticipant, CouncilReport } from "../src/core/types.js";
import type { EvidenceVerificationSnapshot } from "../src/evidence/evidence-ledger.js";
import {
  consultationReceiptMarkdown,
  consultationReceiptSvg,
  deriveConsultationReceipt,
} from "../src/consultation/receipt.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const participants: CouncilParticipant[] = [
  { id: "gpt", name: "ChatGPT", provider: "openai" },
  { id: "claude", name: "Claude", provider: "anthropic" },
  { id: "gemini", name: "Gemini", provider: "google" },
];
const base = { sessionId: "receipt-session-1234567890", createdAt: "2026-08-14T02:00:00.000Z" };
const events: CouncilEvent[] = [
  { ...base, id: "g1", round: 1, actorId: "gpt", kind: "argument", stance: "Extension", content: "Extension first.", confidence: .8 },
  { ...base, id: "c1", round: 1, actorId: "claude", kind: "argument", stance: "Web + Extension", content: "Two surfaces.", confidence: .7 },
  { ...base, id: "gm1", round: 1, actorId: "gemini", kind: "argument", stance: "Extension", content: "Extension first.", confidence: .8 },
  { ...base, id: "g2", round: 2, actorId: "gpt", kind: "challenge", targetEventId: "c1", content: "Show evidence." },
  { ...base, id: "ev1", round: 2, actorId: "gemini", kind: "evidence", targetEventId: "c1", claim: "Optional host permissions exist <script>alert(1)</script>", content: "Chrome docs.", source: "https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions/", sourceDate: "2026-07-14", confidence: .86 },
  { ...base, id: "g3", round: 3, actorId: "gpt", kind: "challenge", targetEventId: "ev1", content: "Permission support does not prove adoption." },
  { ...base, id: "c2", round: 3, actorId: "claude", kind: "revision", previousEventId: "c1", stance: "Extension", content: "I revise.", confidence: .84, causedBy: ["ev1"] },
  { ...base, id: "f1", round: 4, actorId: "gpt", kind: "final_position", stance: "Extension", content: "Final.", confidence: .88 },
  { ...base, id: "f2", round: 4, actorId: "claude", kind: "final_position", stance: "Extension", content: "Final.", confidence: .84 },
  { ...base, id: "f3", round: 4, actorId: "gemini", kind: "final_position", stance: "Web + Extension", content: "Minority remains.", confidence: .72 },
];

const report: CouncilReport = {
  sessionId: base.sessionId,
  question: "Should <script>alert('x')</script> ChatChat ship extension first?",
  mode: "stress_test",
  consensusStance: "Extension",
  consensusRatio: 2 / 3,
  confidence: .86,
  rounds: 4,
  positions: [
    { participant: participants[0]!, stance: "Extension", content: "Final.", confidence: .88, caveats: [] },
    { participant: participants[1]!, stance: "Extension", content: "Final.", confidence: .84, caveats: [] },
    { participant: participants[2]!, stance: "Web + Extension", content: "Minority remains.", confidence: .72, caveats: [] },
  ],
  disagreements: [
    { participant: participants[2]!, stance: "Web + Extension", content: "Minority remains.", confidence: .72, caveats: [] },
  ],
  eventCount: events.length,
};

const verifications: Record<string, EvidenceVerificationSnapshot> = {
  ev1: {
    state: "reachable",
    observedAt: "2026-08-14T02:05:00.000Z",
    finalUrl: "https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions/",
    statusCode: 200,
  },
};

const receipt = deriveConsultationReceipt(report, events, verifications);
assert(receipt.mode === "stress_test" && receipt.modeIcon === "🧨", "Receipt should preserve the meeting mode.");
assert(receipt.challengeCount === 2 && receipt.evidenceCount === 1 && receipt.revisionCount === 1, "Receipt stats must derive from explicit events.");
assert(receipt.minorityCount === 1 && receipt.minorityStances[0] === "Web + Extension", "Receipt should preserve surviving minority views.");
assert(receipt.keyTurn?.causeEventId === "ev1" && receipt.keyTurn.revisionEventId === "c2", "Key turn must come from revision.causedBy provenance.");
assert(receipt.keyTurn?.fromActor === "Gemini" && receipt.keyTurn.toActor === "Claude", "Key turn should preserve participant provenance.");
assert(receipt.evidence?.sourceHost === "developer.chrome.com", "Receipt should show a normalized safe evidence host.");
assert(receipt.evidence?.sourceState === "reachable", "Receipt may report bounded reachability.");
assert(receipt.evidence?.disputed && receipt.evidence?.changedMind, "Reachable evidence may simultaneously remain disputed and have caused a revision.");

const markdown = consultationReceiptMarkdown(receipt, "en");
assert(markdown.includes("STRESS TEST") || markdown.includes("Stress Test"), "Markdown receipt should identify the meeting mode.");
assert(markdown.includes("DISPUTED") && markdown.includes("CHANGED A VIEW"), "Markdown should preserve evidence nuance rather than flattening it to verified/unverified.");
assert(markdown.includes("No chair AI") && markdown.includes("Reachable is not proof"), "Share output must preserve epistemic boundaries.");

const zhMarkdown = consultationReceiptMarkdown(receipt, "zh-CN");
assert(zhMarkdown.includes("压力测试") && zhMarkdown.includes("少数意见保留"), "Chinese receipt should be a first-class share format.");

const svg = consultationReceiptSvg(receipt, "en");
assert(svg.startsWith("<svg") && svg.includes("CONSULTATION RECEIPT"), "Receipt should export as a standalone local SVG.");
assert(!svg.includes("<script>"), "User-controlled proposal/evidence text must never become executable SVG markup.");
assert(svg.includes("&lt;script&gt;"), "User-controlled angle brackets should be escaped in SVG output.");
assert(svg.includes("Reachable is not proof"), "SVG share card must keep the no-truth-verdict boundary visible.");

console.log("✓ ChatChat Consultation Receipt derivation/export tests passed");
