import fs from "node:fs";

const execution = fs.readFileSync("src/extension/execution-provenance.tsx", "utf8");
const app = fs.readFileSync("app/app.html", "utf8");
const sidepanel = fs.readFileSync("extension/sidepanel.html", "utf8");
const panel = fs.readFileSync("src/extension/consultation-panel.tsx", "utf8");
const showcase = fs.readFileSync("extension-public/consultation-showcase-bootstrap.js", "utf8");
const liveGuard = fs.readFileSync("extension-public/live-deliberation-showcase-guard.js", "utf8");

for (const page of [["Full Room", app], ["Side Panel", sidepanel]]) {
  const [label, html] = page;
  assert(html.includes('id="execution-provenance-root"'), `${label} must mount execution provenance.`);
  assert(html.includes('/src/extension/execution-provenance.tsx'), `${label} must load execution provenance.`);
  assert(
    html.indexOf('/src/extension/execution-provenance.tsx') < html.indexOf('/src/extension/consultation-panel.tsx'),
    `${label} must install the transport observer before the consultation panel starts.`,
  );
}

for (const claim of [
  'SYNTHETIC_SHOWCASE',
  'synthetic-showcase',
  'live-provider-tabs',
  'LIVE PROVIDER RECEIPTS',
  '这不是一场真实 AI 协商',
  'Your custom proposal is not sent',
  'Synthetic showcase only supports its fixed demo proposal',
  'textarea.readOnly = true',
  'data-provider-receipt',
  'RUN_SPEECH',
]) {
  assert(execution.includes(claim), `Execution boundary is missing: ${claim}`);
}

assert(
  execution.includes('url.searchParams.delete("showcase")'),
  "Synthetic showcase must offer a real-mode exit that removes the showcase query parameter.",
);

// The real product path must still send the generated consultation prompt into
// the selected browser tab. This is intentionally checked separately from the
// synthetic showcase so a demo fixture cannot substitute for real page I/O.
for (const claim of [
  'new BrowserConsultationAgent(',
  'type: "RUN_SPEECH"',
  'prompt,',
  'timeoutMs: 120_000',
  'chrome.tabs.sendMessage(tabId, { __chatchat: true, ...payload })',
]) {
  assert(panel.includes(claim), `Live provider transport path disappeared: ${claim}`);
}

// The showcase is known to be synthetic and deterministic. Keeping these
// assertions makes that fact explicit instead of allowing CI fixture speech to
// silently masquerade as third-party model inference.
for (const claim of [
  'if (params.get("showcase") !== "consultation") return;',
  'Synthetic automatic connection passed.',
  'function speechFor(tabId, prompt)',
  'Should ChatChat make the Web Room the primary experience',
  'Web + Extension',
]) {
  assert(showcase.includes(claim), `Synthetic showcase contract changed unexpectedly: ${claim}`);
}

for (const claim of [
  'data-chatchat-execution-boundary-showcase',
  'data-execution-mode="synthetic-showcase"',
  'data-synthetic-showcase-warning="visible"',
  'data-synthetic-proposal-locked="true"',
  'data-provider-receipt="received"',
  'sawHonestSyntheticBoundary',
]) {
  assert(liveGuard.includes(claim), `Real Chromium showcase proof does not enforce the synthetic/live boundary: ${claim}`);
}

console.log("✓ synthetic showcase and live provider execution are visibly and mechanically separated");

function assert(condition, message) {
  if (!condition) throw new Error(`Execution boundary check failed: ${message}`);
}
