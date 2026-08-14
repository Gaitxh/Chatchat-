import fs from "node:fs";

const app = fs.readFileSync("app/app.html", "utf8");
const sidepanel = fs.readFileSync("extension/sidepanel.html", "utf8");
const guard = fs.readFileSync("extension-public/history-persistence-showcase-guard.js", "utf8");

assert(app.includes('data-surface="web-app"'), "Full Room must declare stable web-app surface identity before head scripts run.");
assert(app.includes('id="consultation-history-root"'), "Full Room must own the Consultation History UI root.");
assert(!sidepanel.includes('data-surface="web-app"'), "Side Panel must not masquerade as the Full Room history surface.");
assert(!sidepanel.includes('id="consultation-history-root"'), "Side Panel intentionally does not own Consultation History UI.");

for (const claim of [
  'document.documentElement.dataset.surface === "web-app"',
  'if (!OWNS_HISTORY_UI)',
  'chatchatExecutionHistoryReplayShowcase = "not-applicable"',
  'chatchatExecutionHistoryReplayShowcase = "complete"',
  'chatchatHistoryPersistenceShowcase = "complete"',
  'historyButton.click()',
]) {
  assert(guard.includes(claim), `History surface/replay guard is missing: ${claim}`);
}

console.log("✓ Full Room owns historical execution replay while Side Panel proves storage durability only");

function assert(condition, message) {
  if (!condition) throw new Error(`History surface contract check failed: ${message}`);
}
