import fs from "node:fs";
import path from "node:path";

const roots = ["src", "app", "extension", "extension-public"];
const forbidden = [
  "BrowserCouncilHistoryStore",
  "BrowserChronicle",
  "chatchat.council-history.v1",
  "chatchat-browser-chronicle",
];
const requiredFiles = [
  "src/history/consultation-history.ts",
  "src/extension/consultation-history-observer.ts",
  "src/extension/consultation-history-portal.tsx",
  "src/extension/investigation-trail-store.ts",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) throw new Error(`Current History stack is missing: ${file}`);
}

const sourceFiles = roots.flatMap((root) => walk(root));
for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  for (const token of forbidden) {
    if (source.includes(token)) {
      throw new Error(`Legacy History stack token ${token} remains in browser source: ${file}`);
    }
  }
}

const currentHistory = fs.readFileSync("src/history/consultation-history.ts", "utf8");
const historyObserver = fs.readFileSync("src/extension/consultation-history-observer.ts", "utf8");
const trailStore = fs.readFileSync("src/extension/investigation-trail-store.ts", "utf8");
const packageJson = fs.readFileSync("package.json", "utf8");

for (const required of ["ConsultationHistoryStore", "chatchat-consultation-history-v1"]) {
  if (!currentHistory.includes(required)) {
    throw new Error(`Current Consultation History contract is missing: ${required}`);
  }
}
if (!historyObserver.includes("announceConsultationHistoryUpdated(report.sessionId)")) {
  throw new Error("History durability observer must publish the persisted consultation session id.");
}
if (!trailStore.includes("BrowserInvestigationTrailStore")) {
  throw new Error("Investigation Trail must remain attached to the current local History stack.");
}
if (packageJson.includes("browser-chronicle.test")) {
  throw new Error("Legacy Browser Chronicle test is still wired into the primary test suite.");
}

console.log("✓ ChatChat browser product has one Consultation History stack");
console.log("✓ Legacy Council/Chronicle stores cannot silently re-enter production source");

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
