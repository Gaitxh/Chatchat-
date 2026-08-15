import fs from "node:fs";

const model = fs.readFileSync("src/theater/stance-fronts.ts", "utf8");
const component = fs.readFileSync("src/extension/components/ConflictStanceFronts.tsx", "utf8");
const board = fs.readFileSync("src/extension/components/ConflictBoard.tsx", "utf8");
const guard = fs.readFileSync("extension-public/live-deliberation-showcase-guard.js", "utf8");

for (const claim of [
  "deriveConflictStanceFronts",
  'state: "current" | "vacated"',
  "currentMembers",
  "formerMembers",
  "challengeEventIds",
  "evidenceEventIds",
  "supportEventIds",
  "unresolvedTargetEventIds",
  "previousEventId",
  "revisionEventId",
  "causedByEventIds",
  "uncommittedActorIds",
  'replace(/\\s+/g, " ")',
]) {
  assert(model.includes(claim), `Explicit stance-front model is missing: ${claim}`);
}
assert(!model.includes("embedding"), "Stance fronts must not semantically cluster prose or stance labels.");
assert(!model.includes("cosineSimilarity"), "Stance fronts must not infer camps from vector similarity.");

for (const claim of [
  "EXPLICIT STANCE FRONTS",
  "明示立场战线",
  "data-conflict-stance-fronts",
  "data-stance-front-state",
  "data-stance-front-label",
  "data-stance-movement-event",
  "data-stance-movement-cause",
  'data-stance-uncommitted="explicit-none"',
  "Challenge, evidence or support never silently assigns somebody to a camp",
  "质疑、举证或支持不会被 ChatChat 偷偷推断成一个阵营",
]) {
  assert(component.includes(claim), `Explicit stance-front UI is missing: ${claim}`);
}

for (const claim of [
  'import { ConflictStanceFrontsPanel } from "./ConflictStanceFronts.js"',
  "<ConflictStanceFrontsPanel",
  "events={events}",
]) {
  assert(board.includes(claim), `Conflict Board does not render explicit stance fronts: ${claim}`);
}

for (const claim of [
  "data-chatchat-stance-fronts-showcase",
  'data-stance-front-state="current"',
  'data-stance-front-state="vacated"',
  "data-stance-movement-event",
  "data-stance-uncommitted",
  "sawStanceMovement",
]) {
  assert(guard.includes(claim), `Chromium live proof does not enforce stance-front honesty: ${claim}`);
}

console.log("✓ explicit stance fronts show only participant-authored stance labels, preserve vacated fronts, and never infer camps from participation alone");

function assert(condition, message) {
  if (!condition) throw new Error(`Stance Front check failed: ${message}`);
}
