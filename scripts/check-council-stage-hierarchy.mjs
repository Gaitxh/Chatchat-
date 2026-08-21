import { readFile } from "node:fs/promises";

const [
  app,
  stageCss,
  intelligenceCss,
  stageLayout,
  proofBootstrap,
  integrityPortal,
  finalFloorPortal,
  ownershipUi,
] = await Promise.all([
  readFile("app/app.html", "utf8"),
  readFile("src/extension/council-stage.css", "utf8"),
  readFile("src/extension/council-intelligence-zone.css", "utf8"),
  readFile("src/extension/council-stage-layout.ts", "utf8"),
  readFile("extension-public/council-stage-showcase.js", "utf8"),
  readFile("src/extension/meeting-integrity-portal.tsx", "utf8"),
  readFile("src/extension/final-position-floor-portal.tsx", "utf8"),
  readFile("src/extension/provider-tab-ownership-ui.ts", "utf8"),
]);

const extensionRoot = app.indexOf('id="extension-root"');
const auditDrawer = app.indexOf('id="council-audit-drawer"');
if (extensionRoot < 0 || auditDrawer < 0 || extensionRoot >= auditDrawer) {
  fail("The Council Stage extension root must precede the Audit Drawer in the Web Room DOM.");
}

const drawerStart = app.indexOf('<details id="council-audit-drawer" class="council-audit-drawer">');
const drawerEnd = app.indexOf("</details>", drawerStart);
if (drawerStart < 0 || drawerEnd < 0) fail("Audit Drawer must be a native details disclosure.");
const drawerMarkup = app.slice(drawerStart, drawerEnd);
if (/^<details[^>]*\sopen(?:\s|>|=)/.test(drawerMarkup)) {
  fail("Audit Drawer must be collapsed by default for real users.");
}
for (const rootId of ["execution-provenance-root", "provider-memory-root", "meeting-integrity-root"]) {
  requireText(drawerMarkup, `id="${rootId}"`, `audit-only root ${rootId}`);
}
if (drawerMarkup.includes('id="final-position-floor-root"')) {
  fail("Final Position Floor is a Council Stage result, not audit-only evidence.");
}
requireText(drawerMarkup, "Audit &amp; proof", "English Audit Drawer label");
requireText(drawerMarkup, "审计与证明", "Chinese Audit Drawer label");

const intelligenceStart = app.indexOf('<div id="council-intelligence-zone" class="council-intelligence-zone">');
if (intelligenceStart < 0 || intelligenceStart >= drawerStart) {
  fail("Council Intelligence Zone must exist outside and before the Audit Drawer.");
}
const intelligenceMarkup = app.slice(intelligenceStart, drawerStart);
for (const rootId of ["research-roster-root", "investigation-trail-root"]) {
  requireText(intelligenceMarkup, `id="${rootId}"`, `post-result intelligence root ${rootId}`);
  const occurrences = app.match(new RegExp(`id=\\"${rootId}\\"`, "g"))?.length ?? 0;
  if (occurrences !== 1) fail(`${rootId} must have one stable Web Room owner; found ${occurrences}.`);
}
for (const rootId of ["provider-memory-root", "meeting-integrity-root", "execution-provenance-root"]) {
  if (intelligenceMarkup.includes(`id="${rootId}"`)) {
    fail(`${rootId} is audit proof and must not leak into the Council Intelligence Zone.`);
  }
}
requireText(app, "/src/extension/council-intelligence-zone.css", "Council Intelligence styling mount");
requireText(app, "/src/extension/council-stage-layout.ts", "Council Stage layout controller mount");

for (const selector of [".consultation-progress", ".live-room-card", ".shared-board-card", ".outcome-card"]) {
  requireText(stageCss, selector, `full-stage selector ${selector}`);
}
requireText(stageCss, "grid-column: 1 / -1", "full-width Council Stage rail");
requireText(stageCss, ".council-audit-drawer", "Audit Drawer visual treatment");
requireText(stageCss, ".council-audit-drawer:not([open]) > .council-audit-content { display: none; }", "explicit closed Audit Drawer state");
requireText(stageCss, ".council-audit-drawer[open] > .council-audit-content { display: grid; }", "explicit open Audit Drawer state");
requireText(stageCss, "repeat(3, minmax(0, 1fr))", "spacious desktop Blackboard grid");

requireText(intelligenceCss, ".council-intelligence-zone", "post-result intelligence visual zone");
requireText(intelligenceCss, "grid-column: 1 / -1", "full-width post-result intelligence");
requireText(intelligenceCss, '[data-council-intelligence="empty"]', "empty intelligence collapse rule");
requireText(stageLayout, '"research-roster-root"', "Research Roster stable intelligence ownership");
requireText(stageLayout, '"investigation-trail-root"', "Investigation Trail stable intelligence ownership");
requireText(stageLayout, "if (root.parentElement !== zone) zone.append(root);", "portal re-parenting defense");
requireText(stageLayout, 'document.querySelector<HTMLElement>(".consultation-app .outcome-card")', "post-result outcome anchor");
requireText(stageLayout, 'document.getElementById("final-position-floor-root")', "Final Position-aware intelligence anchor");
requireText(stageLayout, 'anchor.insertAdjacentElement("afterend", zone)', "post-result intelligence placement");

requireText(proofBootstrap, 'params.get("showcase") === "consultation"', "production proof Audit Drawer opt-in");
requireText(proofBootstrap, "drawer.open = true", "proof-only Audit Drawer expansion");
requireText(proofBootstrap, '"collapsed"', "real-user collapsed Audit Drawer receipt");

requireText(integrityPortal, 'root.closest("#council-audit-drawer")', "Meeting Integrity drawer ownership");
requireText(finalFloorPortal, 'document.querySelector(".outcome-card")', "Final Position Floor outcome anchor");
requireText(finalFloorPortal, '!integrityRoot.closest("#council-audit-drawer")', "Final Position Floor drawer exclusion");
if (finalFloorPortal.indexOf('document.querySelector(".outcome-card")') > finalFloorPortal.indexOf('document.querySelector(".meeting-integrity-card")')) {
  fail("Live Final Position Floor must prefer the user-facing outcome before any integrity fallback anchor.");
}

requireText(ownershipUi, 'providerTabOwnership(participant)', "shared Provider tab ownership truth");
requireText(ownershipUi, '"Managed tab"', "managed-tab user-visible label");
requireText(ownershipUi, '"Your tab"', "user-owned user-visible label");
requireText(ownershipUi, '"托管标签页"', "Chinese managed-tab user-visible label");
requireText(ownershipUi, '"你的标签页"', "Chinese user-owned user-visible label");
requireText(ownershipUi, "will not automatically navigate or resume it in the background", "user-owned automation boundary explanation");

for (const forbidden of ["cookie", "token", "password", "localStorage"]) {
  if (ownershipUi.toLocaleLowerCase().includes(forbidden.toLocaleLowerCase())) {
    fail(`Provider ownership badge must not read or discuss credential material: ${forbidden}`);
  }
}

console.log("✓ Council Stage appears before low-frequency audit proof in the Web Room");
console.log("✓ Proposal → phase → live floor → Blackboard → outcome stays uninterrupted by post-result intelligence");
console.log("✓ Research Roster and Investigation Trail share one full-width post-result intelligence owner");
console.log("✓ Live deliberation and Final Position stay on the full-width stage; audit proof stays collapsible");
console.log("✓ Provider tab automation ownership is visible and derived from the same fail-closed boundary policy");

function requireText(haystack, needle, label) {
  if (!haystack.includes(needle)) fail(`Missing ${label}: ${needle}`);
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}