import { parseProviderPromptMemorySelection } from "../src/provider-sdk/prompt-memory-audit.js";
import type { ProviderTransportAuditRecord } from "../src/provider-sdk/transport-audit.js";
import { deriveProviderPublicPayloadIntegrity } from "../src/theater/provider-memory-payload-integrity.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const basePayload = [
  { id: "e1", actorId: "a", round: 2, kind: "argument", stance: "A", confidence: 0.7, content: "Public claim." },
  { id: "e2", actorId: "b", round: 2, kind: "question", targetActorId: "a", content: "Public question?" },
];
const promptA = prompt("a", basePayload);
const promptB = prompt("b", basePayload);
const parsedA = parseProviderPromptMemorySelection(promptA)!;
const parsedB = parseProviderPromptMemorySelection(promptB)!;
assert(parsedA.publicPayloadFingerprint?.startsWith("eq64:"), "Modern actual Prompt must carry the current eq64 equality fingerprint for CONSULTATION_EVENTS_JSON.");
assert(parsedA.publicPayloadFingerprint === parsedB.publicPayloadFingerprint, "Equal peers with identical serialized public payloads must receive identical fingerprints.");
assert(parsedA.publicPayloadEventCount === 2, "Payload audit must preserve exact serialized public-event count.");

const sameIdsDifferentContent = basePayload.map((item, index) => index === 0 ? { ...item, content: "Mutated public claim." } : item);
const parsedDrift = parseProviderPromptMemorySelection(prompt("b", sameIdsDifferentContent))!;
assert(parsedDrift.snapshotEventIds.join(",") === parsedB.snapshotEventIds.join(","), "Drift fixture must keep the same public event ids.");
assert(parsedDrift.publicPayloadFingerprint !== parsedB.publicPayloadFingerprint, "Same IDs with different serialized public content must not look payload-equal.");

// Equality is about what was serialized into RUN_SPEECH, not only the parsed JS
// value. Whitespace-only reserialization is semantically equivalent JSON but it
// is still a different serialized payload and must produce a different receipt.
const compactRaw = JSON.stringify(basePayload);
const spacedRaw = JSON.stringify(basePayload, null, 0).replace(/\},\{/g, "}, {");
assert(JSON.stringify(JSON.parse(compactRaw)) === JSON.stringify(JSON.parse(spacedRaw)), "Serialization fixture must remain the same parsed JSON value.");
const parsedSpaced = parseProviderPromptMemorySelection(promptWithRawPayload("b", spacedRaw))!;
assert(parsedSpaced.snapshotEventIds.join(",") === parsedB.snapshotEventIds.join(","), "Serialization-only fixture must retain the same event ids.");
assert(parsedSpaced.publicPayloadFingerprint !== parsedB.publicPayloadFingerprint, "Semantically equal but differently serialized public JSON must remain distinguishable in the exact Prompt receipt.");

const repair = parseProviderPromptMemorySelection(`${promptA}\n\nREPAIR ATTEMPT:\nCorrect your JSON envelope only.`)!;
assert(repair.repairAttempt, "Repair Prompt must be audited as a repair attempt.");
assert(repair.publicPayloadFingerprint === parsedA.publicPayloadFingerprint, "A repair-only suffix must preserve the exact public payload fingerprint.");
assert(repair.snapshotEventIds.join(",") === parsedA.snapshotEventIds.join(","), "A format-only repair must preserve the exact public selection ids.");

const records = [
  record("a", parsedA.publicPayloadFingerprint!, false),
  record("b", parsedB.publicPayloadFingerprint!, false),
  record("c", parsedA.publicPayloadFingerprint!, false),
];
const verified = deriveProviderPublicPayloadIntegrity(records);
assert(verified.state === "verified", "Identical first-attempt public payloads with complete fingerprints must verify.");
assert(verified.auditedTurnCount === 3 && verified.fingerprintedTurnCount === 3 && verified.unverifiedTurnCount === 0, "Verified parity must keep all three transport-observed seats in the denominator.");
assert(verified.rounds[0]?.payloadsConsistent === true && verified.rounds[0]?.fingerprintedSeatCount === 3, "Round receipt must prove all three equal seats carried the same serialized public payload.");
assert(verified.repairUsedTurnCount === 0, "No repair must remain not_used rather than being called repair-verified.");

const peerDriftRecords = records.map((item) => ({ ...item }));
peerDriftRecords[1] = { ...peerDriftRecords[1]!, publicPayloadFingerprint: parsedDrift.publicPayloadFingerprint! };
const peerDrift = deriveProviderPublicPayloadIntegrity(peerDriftRecords);
assert(peerDrift.state === "peer_payload_drift", "Same-round serialized payload disagreement must surface peer_payload_drift.");
assert(peerDrift.peerPayloadDriftRoundCount === 1, "Payload drift must identify the affected round without changing selection-id semantics.");

const repairMatched = deriveProviderPublicPayloadIntegrity([
  ...records,
  record("a", parsedA.publicPayloadFingerprint!, true),
]);
assert(repairMatched.state === "verified", "A repair that keeps payload plus selection provenance must not degrade overall payload integrity.");
assert(repairMatched.repairUsedTurnCount === 1 && repairMatched.rounds[0]?.repairMatchedSeatCount === 1, "Repair receipt must explicitly distinguish matched repair deck from no repair.");
const matchedTurn = repairMatched.turns.find((turn) => turn.actorId === "a")!;
assert(matchedTurn.repairPayloadMatched === true && matchedTurn.repairSelectionMatched === true, "Matched repair must independently prove payload and selection parity.");

const repairPayloadDrift = deriveProviderPublicPayloadIntegrity([
  ...records,
  record("a", parsedDrift.publicPayloadFingerprint!, true),
]);
assert(repairPayloadDrift.state === "repair_deck_drift", "Repair attempt that changes serialized public memory must be a dedicated protocol failure.");
assert(repairPayloadDrift.repairDeckDriftTurnCount === 1 && repairPayloadDrift.repairPayloadDriftTurnCount === 1, "Repair payload drift must preserve exact affected-turn and cause counts.");
assert(repairPayloadDrift.repairSelectionDriftTurnCount === 0, "Payload-only repair drift must not falsely report selection provenance drift.");

const selectionDriftRepair = record("a", parsedA.publicPayloadFingerprint!, true);
selectionDriftRepair.latestRoundEventIds = ["e2"];
const repairSelectionDrift = deriveProviderPublicPayloadIntegrity([...records, selectionDriftRepair]);
assert(repairSelectionDrift.state === "repair_deck_drift", "Repair with identical payload but changed selection provenance must still be repair_deck_drift.");
const driftTurn = repairSelectionDrift.turns.find((turn) => turn.actorId === "a")!;
assert(driftTurn.repairPayloadMatched === true && driftTurn.repairSelectionMatched === false, "Repair drift must expose whether payload or selection provenance caused the failure.");
assert(repairSelectionDrift.repairPayloadDriftTurnCount === 0 && repairSelectionDrift.repairSelectionDriftTurnCount === 1, "Selection-only repair drift must remain separately attributable.");

const partialReceipt = records.map((item) => ({ ...item }));
delete partialReceipt[1]!.publicPayloadEventCount;
const partial = deriveProviderPublicPayloadIntegrity(partialReceipt);
assert(partial.state === "payload_unverified", "Fingerprint without exact payload event count must remain an incomplete receipt, not verified parity.");
assert(partial.auditedTurnCount === 3 && partial.fingerprintedTurnCount === 2 && partial.unverifiedTurnCount === 1, "Partial receipt must remain in the denominator rather than disappearing.");
assert(partial.rounds[0]?.payloadsConsistent === null && partial.rounds[0]?.unverifiedSeatCount === 1, "Partial same-round payload evidence must stay unknown rather than equal.");

const observerMissing = records.map((item) => ({ ...item }));
const missingSeat = observerMissing[2]!;
delete missingSeat.promptMemoryObserved;
delete missingSeat.publicPayloadFingerprint;
delete missingSeat.publicPayloadEventCount;
delete missingSeat.pinnedOpenIssueEventIds;
delete missingSeat.pinnedIssueSourceEventIds;
delete missingSeat.latestRoundEventIds;
const missingObserver = deriveProviderPublicPayloadIntegrity(observerMissing);
assert(missingObserver.state === "payload_unverified", "Missing Prompt observer evidence must degrade the round instead of deleting that Provider turn.");
assert(missingObserver.auditedTurnCount === 3 && missingObserver.fingerprintedTurnCount === 2 && missingObserver.unverifiedTurnCount === 1, "Transport-observed seat without Prompt receipt must remain in the payload denominator.");
assert(missingObserver.turns.some((turn) => turn.actorId === "c" && !turn.promptMemoryObserved), "Missing-observer seat must remain explicitly visible in the turn model.");
assert(missingObserver.rounds[0]?.seatCount === 3 && missingObserver.rounds[0]?.payloadsConsistent === null, "Two matching seats plus one missing receipt is unknown 2/3 evidence, never verified 2/2.");

const legacy: ProviderTransportAuditRecord[] = records.map((item) => {
  const copy = { ...item };
  delete copy.promptMemoryObserved;
  delete copy.publicPayloadFingerprint;
  delete copy.publicPayloadEventCount;
  delete copy.pinnedOpenIssueEventIds;
  delete copy.pinnedIssueSourceEventIds;
  delete copy.latestRoundEventIds;
  return copy;
});
const unverified = deriveProviderPublicPayloadIntegrity(legacy);
assert(unverified.state === "payload_unverified", "Pre-Prompt-memory transport receipts must stay visibly unverified instead of disappearing or being upgraded after the fact.");
assert(unverified.auditedTurnCount === 3 && unverified.unverifiedTurnCount === 3, "Older transport turns must remain in the denominator with exact affected-turn count.");
assert(unverified.rounds[0]?.payloadsConsistent === null, "Missing historical fingerprints must be unknown, never silently interpreted as equal.");

console.log("✓ exact eq64 serialized public payload equality is audited separately from event-id deck equality");
console.log("✓ missing Prompt receipts remain in the denominator; repair must preserve payload plus selection provenance");

function prompt(actorId: string, payload: unknown[]): string { return promptWithRawPayload(actorId, JSON.stringify(payload)); }
function promptWithRawPayload(actorId: string, rawPayload: string): string {
  const payload = JSON.parse(rawPayload) as Array<{ id: string }>;
  const ids = payload.map((item) => item.id);
  return [
    "SESSION_ID: payload-integrity-session",
    "PHASE: debate",
    "ROUND: 3",
    `YOUR_ACTOR_ID: ${actorId}`,
    `PUBLIC_SNAPSHOT_EVENT_IDS_JSON: ${JSON.stringify(ids)}`,
    "PINNED_OPEN_ISSUE_EVENT_IDS_JSON: []",
    "PINNED_OPEN_ISSUE_SOURCE_EVENT_IDS_JSON: []",
    "LATEST_ROUND_EVENT_IDS_JSON: [\"e1\",\"e2\"]",
    `CONSULTATION_EVENTS_JSON: ${rawPayload}`,
  ].join("\n");
}

function record(actorId: string, fingerprint: string, repairAttempt: boolean): ProviderTransportAuditRecord {
  const actorIndex = Math.max(0, actorId.charCodeAt(0) - "a".charCodeAt(0));
  const second = 10 + actorIndex + (repairAttempt ? 10 : 0);
  return {
    sessionId: "payload-integrity-session",
    actorId,
    phase: "debate",
    round: 3,
    state: "received",
    mode: "live-provider-tabs",
    observedAt: `2026-08-21T01:00:${String(second).padStart(2, "0")}.000Z`,
    snapshotEventIds: ["e1", "e2"],
    promptMemoryObserved: true,
    pinnedOpenIssueEventIds: [],
    pinnedIssueSourceEventIds: [],
    latestRoundEventIds: ["e1", "e2"],
    publicPayloadFingerprint: fingerprint,
    publicPayloadEventCount: 2,
    repairAttempt,
    tabId: 100 + actorIndex,
    promptChars: 1000,
    responseChars: 400,
    elapsedMs: 100,
  };
}
