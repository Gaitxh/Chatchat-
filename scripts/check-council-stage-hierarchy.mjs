import { readFile } from "node:fs/promises";

const [app, hierarchy, css, boundary] = await Promise.all([
  readFile("app/app.html", "utf8"),
  readFile("src/extension/web-visual-hierarchy.ts", "utf8"),
  readFile("src/extension/council-stage.css", "utf8"),
  readFile("src/extension/provider-tab-boundary.ts", "utf8"),
]);

for (const text of [
  'id="chatchat-audit-vault"',
  'data-chatchat-audit-vault="closed"',
  '/src/extension/council-stage.css',
  '/src/extension/web-visual-hierarchy.ts',
  'data-audit-title',
  'data-audit-body',
]) requireText(app, text, "Web Room Council Stage shell");

const auditBlock = hierarchy.match(/const AUDIT_ROOT_IDS = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
const stageBlock = hierarchy.match(/const PUBLIC_STAGE_ROOT_IDS = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
if (!auditBlock || !stageBlock) fail("Council Stage root classification blocks are missing.");

for (const root of [
  "execution-provenance-root",
  "provider-memory-root",
  "meeting-integrity-root",
  "conflict-board-root",
  "evidence-root",
  "consultation-history-root",
]) requireText(auditBlock, `"${root}"`, "audit-layer root");

for (const stageRoot of [
  "extension-root",
  "consultation-theater-root",
  "final-position-floor-root",
  "consultation-receipt-root",
]) {
  requireText(stageBlock, `"${stageRoot}"`, "public Council Stage root");
  if (auditBlock.includes(`"${stageRoot}"`)) {
    fail(`Primary Council surface must not be demoted into the audit vault: ${stageRoot}`);
  }
}

for (const text of [
  'dataset.chatchatStageHierarchy = "council-first"',
  'params.has("memory-proof")',
  'params.has("payload-proof")',
  'vault.open = false',
  'participant.createdByChatChat === true',
  'row.dataset.tabOwnership = managed ? "managed" : "user-owned"',
  '"托管席位"',
  '"你的标签页"',
]) requireText(hierarchy + boundary, text, "Council hierarchy / ownership boundary contract");

for (const text of [
  "#chatchat-audit-vault",
  ".chatchat-audit-vault-body",
  ".automation-boundary-chip.is-managed",
  ".automation-boundary-chip.is-user-owned",
  ".shared-board-card .consultation-events",
  "max-height: 560px",
  ".consultation-hero h1",
]) requireText(css, text, "generous Council Stage styling");

for (const forbidden of ["cookie", "localStorage", "sessionStorage", "document.cookie"]) {
  if (hierarchy.toLowerCase().includes(forbidden.toLowerCase())) {
    fail(`Visual hierarchy must not inspect credential/session material: ${forbidden}`);
  }
}

console.log("✓ ChatChat Council Stage keeps primary deliberation visible and technical audit detail disclosure-gated");
console.log("✓ Provider tab ownership is visible without expanding automatic authority");

function requireText(haystack, needle, label) {
  if (!haystack.includes(needle)) fail(`Missing ${label}: ${needle}`);
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}
