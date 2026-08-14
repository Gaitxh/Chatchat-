import type { CouncilConsultationMode, CouncilReport } from "../src/core/types.js";
import {
  MAX_INVESTIGATION_TRAIL_EDGES,
  createInvestigationTrailEdge,
  createPendingInvestigationFollowUp,
  deriveInvestigationTrailForest,
  pendingFollowUpIsFresh,
  removeInvestigationTrailSession,
  upsertInvestigationTrailEdge,
  type InvestigationTrailEdge,
} from "../src/history/investigation-trail.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const parent = report("session-a", "Should ChatChat ship Browser-first?", "Browser Extension", "verify");
const pending = createPendingInvestigationFollowUp({
  parentReport: parent,
  moveId: "next:scope:evidence-1",
  moveKind: "retest_revision",
  modeHint: "stress_test",
  labelEn: "Stress-test the evidence-driven revision",
  labelZhCN: "复核这次由证据触发的改口",
  stagedProposal: "Re-check whether the cited permission evidence really supports the product conclusion.",
  stagedAt: "2026-08-14T01:00:00.000Z",
});

assert(pendingFollowUpIsFresh(pending, Date.parse("2026-08-14T01:30:00.000Z")), "A visible follow-up should remain linkable inside the two-hour session window.");
assert(!pendingFollowUpIsFresh(pending, Date.parse("2026-08-14T03:01:00.000Z")), "A stale pending follow-up must never silently link an unrelated later meeting.");

const child = report("session-b", "Does the permission evidence support extension-first?", "Browser Extension", "stress_test");
const edge = createInvestigationTrailEdge(pending, child, "2026-08-14T01:35:00.000Z");
assert(edge, "A fresh explicit follow-up should create one parent→child edge after completion.");
assert(edge.parentSessionId === "session-a" && edge.childSessionId === "session-b", "Trail edge must preserve exact parent and child session ids.");
assert(edge.moveKind === "retest_revision" && edge.modeHint === "stress_test", "Trail edge must preserve why the user chose to continue.");
assert(edge.childMode === "stress_test", "Completed child meeting mode should be preserved.");
assert(!("events" in edge) && !("positions" in edge), "Trail metadata must not duplicate full event streams or final-position bodies.");

const expiredEdge = createInvestigationTrailEdge(
  pending,
  report("session-late", "Unrelated later meeting", "Other", "balanced"),
  "2026-08-14T03:30:00.000Z",
);
assert(expiredEdge === null, "Expired pending follow-up must not create a trail edge.");

const updated = upsertInvestigationTrailEdge([edge], {
  ...edge,
  linkedAt: "2026-08-14T01:36:00.000Z",
  childOutcome: "Narrowed Extension",
});
assert(updated.length === 1, "A child session can have only one active parent edge.");
assert(updated[0]?.childOutcome === "Narrowed Extension", "Upsert should replace stale edge metadata for the same child.");

const edgeBC = makeEdge("session-b", "session-c", "stress_test", "verify", "2026-08-14T01:50:00.000Z", "Check the source date");
const edgeAD = makeEdge("session-a", "session-d", "verify", "explore", "2026-08-14T01:45:00.000Z", "Hear the minority");
const forest = deriveInvestigationTrailForest([edge, edgeBC, edgeAD]);
assert(forest.length === 1 && forest[0]?.sessionId === "session-a", "Shared parent follow-ups should form one investigation root.");
assert(forest[0]?.children.length === 2, "A meeting may branch into multiple explicit follow-up paths.");
const bBranch = forest[0]?.children.find((branch) => branch.child.sessionId === "session-b");
assert(bBranch?.child.children[0]?.child.sessionId === "session-c", "Multi-generation follow-ups should remain nested and traceable.");

const cycle = makeEdge("session-c", "session-a", "verify", "balanced", "2026-08-14T02:00:00.000Z", "bad cycle");
const cycleSafe = deriveInvestigationTrailForest([edge, edgeBC, cycle]);
assert(cycleSafe.length >= 1, "Malformed cyclic metadata must not cause infinite recursion.");

const removedParent = removeInvestigationTrailSession([edge, edgeBC, edgeAD], "session-a");
assert(removedParent.length === 1 && removedParent[0]?.childSessionId === "session-c", "Deleting a session should remove edges where it is parent or child while preserving unrelated descendants.");

let many: InvestigationTrailEdge[] = [];
for (let index = 0; index < MAX_INVESTIGATION_TRAIL_EDGES + 8; index += 1) {
  many = upsertInvestigationTrailEdge(many, makeEdge(`p-${index}`, `c-${index}`, "balanced", "balanced", `2026-08-14T02:${String(index).padStart(2, "0")}:00.000Z`, `move-${index}`));
}
assert(many.length === MAX_INVESTIGATION_TRAIL_EDGES, "Local trail metadata should remain bounded.");

console.log("✓ ChatChat explicit Investigation Trail tests passed");

function report(
  sessionId: string,
  question: string,
  stance: string,
  mode: CouncilConsultationMode,
): CouncilReport {
  return {
    sessionId,
    question,
    mode,
    consensusStance: stance,
    consensusRatio: 1,
    confidence: .8,
    rounds: 3,
    positions: [],
    disagreements: [],
    eventCount: 0,
  };
}

function makeEdge(
  parentSessionId: string,
  childSessionId: string,
  parentMode: InvestigationTrailEdge["parentMode"],
  childMode: InvestigationTrailEdge["childMode"],
  linkedAt: string,
  label: string,
): InvestigationTrailEdge {
  return {
    parentSessionId,
    childSessionId,
    parentProposalPreview: `Parent ${parentSessionId}`,
    parentOutcome: "Parent outcome",
    parentMode,
    childProposalPreview: `Child ${childSessionId}`,
    childOutcome: "Child outcome",
    childMode,
    moveId: `move:${parentSessionId}:${childSessionId}`,
    moveKind: "inspect_source",
    modeHint: childMode === "stress_test" ? "stress_test" : childMode === "verify" ? "verify" : "explore",
    labelEn: label,
    labelZhCN: label,
    stagedAt: "2026-08-14T01:00:00.000Z",
    linkedAt,
  };
}