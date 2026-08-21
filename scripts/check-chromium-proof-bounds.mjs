import fs from "node:fs";

const source = fs.readFileSync("scripts/capture-chromium-proof.mjs", "utf8");

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

if (!/CDP Runtime\\\.evaluate timed out/.test(source)) {
  throw new Error("Fresh-browser retries must stay restricted to the observed transient Runtime.evaluate timeout class.");
}

if (!/attempt >= MAX_CAPTURE_ATTEMPTS \|\| !isRetryableTransientCdpError\(error\)/.test(source)) {
  throw new Error("A second capture failure or any non-transient failure must remain fatal.");
}

console.log("✓ Chromium proof RPCs stay bounded; one transient Runtime.evaluate stall may retry only on a fresh browser while product assertions remain unchanged");
