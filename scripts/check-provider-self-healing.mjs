import { readFile } from "node:fs/promises";

const [policy, coordinator, inspection, worker, fullRoom] = await Promise.all([
  readFile("src/extension/provider-recovery.ts", "utf8"),
  readFile("src/extension/provider-self-healing.ts", "utf8"),
  readFile("src/extension/provider-page-inspection.ts", "utf8"),
  readFile("extension-public/service-worker.js", "utf8"),
  readFile("app/app.html", "utf8"),
]);

for (const message of [
  "Automatic page setup could not identify the message input.",
  "Automatic page setup could not identify the send control.",
  "Automatic page setup found a send control, but it did not become usable after filling the message.",
  "Automatic page setup did not produce a complete browser recipe.",
]) requireText(policy, message, "current AUTO_SETUP mapping failure");

for (const forbidden of [
  "CHATCHAT_READY",
  "Protocol Gate",
  "Timed out",
]) {
  if (policy.includes(forbidden)) fail(`Provider recovery policy must not broaden itself around ${forbidden}.`);
}

requireText(policy, "createdByChatChat", "user-owned tab privacy gate");
requireText(policy, "login_owned_by_concierge", "Login Concierge ownership");
requireText(policy, "wrong_provider_origin", "Provider-origin fail closed rule");
requireText(coordinator, "CLAIM_PROVIDER_SELF_HEALING", "single-winner recovery claim");
requireText(coordinator, "chrome.tabs.update", "one clean navigation primitive");
requireText(coordinator, "tabs.onUpdated auto-resume", "existing auto-resume ownership comment");
requireText(inspection, "INSPECT_PROVIDER_PAGE", "shared bounded inspection request");
requireText(worker, 'redirect: "manual"', "Evidence verifier redirect hardening must survive worker edits");
requireText(worker, 'credentials: "omit"', "Evidence verifier credential isolation must survive worker edits");
requireText(worker, "claimProviderRecovery", "worker-local atomic claim");
requireText(worker, "composerCandidates", "bounded Provider-page observation");
requireText(fullRoom, "provider-self-healing.ts", "Full Room self-healing mount");

for (const forbidden of [
  ".click()",
  "location.reload",
  "RECIPES_KEY",
  "AUTO_SETUP",
]) {
  if (coordinator.includes(forbidden)) fail(`Self-healing coordinator must not own ${forbidden}.`);
}

console.log("✓ ChatChat Provider self-healing product boundary passed");

function requireText(haystack, needle, label) {
  if (!haystack.includes(needle)) fail(`Missing ${label}: ${needle}`);
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}
