import fs from "node:fs";
import path from "node:path";

const roots = ["src", "app", "extension", "extension-public"];
const forbidden = [
  "BrowserCouncilHistoryStore",
  "createCouncilHistoryStore",
  "CouncilHistoryStore",
  "ArchivedCouncil",
  "chatchat.council-history.v1",
  "BrowserChronicle",
  "chatchat-browser-chronicle",
];
const forbiddenFiles = [
  "src/history/browser-store.ts",
  "src/history/types.ts",
  "src/extension/chronicle-store.ts",
  "tests/browser-chronicle.test.ts",
];
const requiredFiles = [
  "src/history/consultation-history.ts",
  "src/history/evidence-history.ts",
  "src/history/execution-audit-history.ts",
  "src/history/investigation-trail.ts",
  "src/history/index.ts",
  "src/extension/consultation-history-observer.ts",
  "src/extension/consultation-history-portal.tsx",
  "src/extension/history-request-bridge.ts",
  "src/extension/investigation-trail-store.ts",
];

for (const file of forbiddenFiles) {
  if (fs.existsSync(file)) throw new Error(`Legacy History file must stay deleted: ${file}`);
}
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error(`Current History stack is missing: ${file}`);
}

for (const file of roots.flatMap((root) => walk(root))) {
  const source = fs.readFileSync(file, "utf8");
  for (const token of forbidden) {
    if (source.includes(token)) {
      throw new Error(`Legacy History token ${token} remains in browser source: ${file}`);
    }
  }
}

const historyIndex = fs.readFileSync("src/history/index.ts", "utf8");
for (const currentModule of [
  "./consultation-history.js",
  "./evidence-history.js",
  "./execution-audit-history.js",
  "./investigation-trail.js",
]) {
  if (!historyIndex.includes(currentModule)) {
    throw new Error(`Current History barrel must export ${currentModule}.`);
  }
}

const currentHistory = fs.readFileSync("src/history/consultation-history.ts", "utf8");
const historyObserver = fs.readFileSync("src/extension/consultation-history-observer.ts", "utf8");
const packageJson = fs.readFileSync("package.json", "utf8");
const testRunner = fs.readFileSync("scripts/run-test-suite.mjs", "utf8");

for (const required of ["ConsultationHistoryStore", "chatchat-consultation-history-v1"]) {
  if (!currentHistory.includes(required)) throw new Error(`Current Consultation History contract is missing: ${required}`);
}
for (const required of [
  "new ConsultationHistoryStore()",
  "new EvidenceHistoryStore()",
  "new ExecutionAuditHistoryStore()",
  "announceConsultationHistoryUpdated(report.sessionId)",
]) {
  if (!historyObserver.includes(required)) throw new Error(`History durability observer is missing: ${required}`);
}
if (!packageJson.includes("check-history-single-stack.mjs")) {
  throw new Error("Single-stack History guard must remain wired into check:product.");
}
if (packageJson.includes("browser-chronicle.test") || testRunner.includes("browser-chronicle.test")) {
  throw new Error("Legacy Browser Chronicle test must stay out of the primary test suite.");
}

console.log("✓ ChatChat browser product has one Consultation History stack");
console.log("✓ Consultation, Evidence, Execution Audit and Investigation Trail durability remain wired");
console.log("✓ Legacy Council/Chronicle APIs, stores and database keys cannot silently re-enter browser source");

function walk(root) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...walk(target));
    else if (/\.(?:ts|tsx|js|mjs|html)$/.test(entry.name)) result.push(target);
  }
  return result;
}
