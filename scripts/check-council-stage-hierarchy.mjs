import { readFile } from "node:fs/promises";

const [app, stageCss, proofBootstrap, integrityPortal, finalFloorPortal, ownershipUi] = await Promise.all([
  readFile("app/app.html", "utf8"),
  readFile("src/extension/council-stage.css", "utf8"),
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

for (const selector of [".consultation-progress", ".live-room-card", ".shared-board-card", ".outcome-card"]) {
  requireText(stageCss, selector, `full-stage selector ${selector}`);
}
requireText(stageCss, "grid-column: 1 / -1", "full-width Council Stage rail");
requireText(stageCss, ".council-audit-drawer", "Audit Drawer visual treatment");
requireText(stageCss, "repeat(3, minmax(0, 1fr))", "spacious desktop Blackboard grid");

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
console.log("✓ Live deliberation and Final Position stay on the full-width stage; audit proof stays collapsible");
console.log("✓ Provider tab automation ownership is visible and derived from the same fail-closed boundary policy");

function requireText(haystack, needle, label) {
  if (!haystack.includes(needle)) fail(`Missing ${label}: ${needle}`);
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}
