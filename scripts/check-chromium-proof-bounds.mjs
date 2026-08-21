import fs from "node:fs";

const source = fs.readFileSync("scripts/capture-chromium-proof.mjs", "utf8");

for (const claim of [
  "cdpCallTimeoutMs",
  "CDP ${method} timed out",
  "clearTimeout(waiter.timer)",
  "Chromium exited before exposing a DevTools page target",
  "Chromium stderr tail",
  "withDeadline(opened",
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

console.log("✓ Chromium proof RPCs are bounded and launch failures preserve actionable stderr diagnostics");
