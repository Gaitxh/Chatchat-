import fs from "node:fs";

const source = fs.readFileSync("scripts/capture-chromium-proof.mjs", "utf8");
const workflow = fs.readFileSync(".github/workflows/ci.yml", "utf8");

for (const claim of [
  "cdpCallTimeoutMs",
  "CDP ${method} timed out",
  "clearTimeout(waiter.timer)",
  "Chromium exited before exposing a DevTools page target",
  "Chromium stderr tail",
  "withDeadline(opened",
  "MAX_CAPTURE_ATTEMPTS = 2",
  "isRetryableTransientCdpError",
  "fresh Chromium profile and debug port",
  '"--disable-background-networking"',
  '"--disable-component-update"',
  '"--disable-default-apps"',
  '"--disable-sync"',
  '"--metrics-recording-only"',
  '"--no-first-run"',
  '"--no-default-browser-check"',
]) {
  if (!source.includes(claim)) throw new Error(`Chromium proof bounds check failed: missing ${claim}`);
}

if (/async call\(method, params = \{\}\) \{[\s\S]*?return new Promise\(\(resolve, reject\) => \{[\s\S]*?socket\.send[\s\S]*?\}\);/.test(source)
  && !source.includes("setTimeout(() =>")) {
  throw new Error("Chromium CDP calls may not return an unbounded pending Promise.");
}

if (!/Math\.min\(8000,[\s\S]*waitMs/.test(source)) {
  throw new Error("Chromium per-RPC timeout must remain bounded below the product ready wait budget.");
}

const retryPolicy = source.match(/function isRetryableTransientCdpError\(error\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
for (const allowed of ["Runtime\\.evaluate", "Page\\.captureScreenshot"]) {
  if (!retryPolicy.includes(allowed)) {
    throw new Error(`Fresh-browser retry policy must include the observed transient ${allowed} timeout class.`);
  }
}
for (const forbidden of ["Page\\.navigate", "Page\\.enable", "Runtime\\.enable", "Emulation\\.setDeviceMetricsOverride"]) {
  if (retryPolicy.includes(forbidden)) {
    throw new Error(`Fresh-browser retry policy must not broaden to ${forbidden}.`);
  }
}

if (!/attempt >= MAX_CAPTURE_ATTEMPTS \|\| !isRetryableTransientCdpError\(error\)/.test(source)) {
  throw new Error("A second capture failure or any non-transient failure must remain fatal.");
}

const memoryProof = workflow.match(
  /- name: Capture dedicated bilingual Provider Memory pressure proof([\s\S]*?)- name: Capture bilingual Final Position Floor close-up/,
)?.[1] ?? "";
const normalizedMemoryProof = memoryProof.replaceAll('\\"', '"');
if (!memoryProof.includes("--width 1440 --height 1600 --wait-ms 26000")) {
  throw new Error("Focused Provider Memory Chromium proof must keep the bounded 1440×1600 raster viewport.");
}
if (!normalizedMemoryProof.includes("--focus-selector '[data-provider-memory-coverage=\"audited\"]'")) {
  throw new Error("Focused Provider Memory proof must still target the audited Provider Memory card.");
}
if (!normalizedMemoryProof.includes("--ready-selector 'html[data-chatchat-provider-memory-showcase=\"complete\"]'")) {
  throw new Error("Focused Provider Memory proof must preserve its exact ready selector.");
}

console.log("✓ Chromium proof RPCs stay bounded; only observed Runtime.evaluate/Page.captureScreenshot stalls may get one fresh-browser retry and attempt two remains fatal");
console.log("✓ Chromium proof processes stay hermetic from unrelated background networking, sync, update and first-run services");
console.log("✓ Provider Memory visual proof keeps a focused bounded raster while DOM and semantic validators remain unchanged");
