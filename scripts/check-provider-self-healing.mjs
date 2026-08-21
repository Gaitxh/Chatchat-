import { readFile } from "node:fs/promises";

const [
  recovery,
  coordinator,
  inspection,
  identity,
  concierge,
  tabBoundary,
  consultationPanel,
  worker,
  contentScript,
  app,
  sidePanel,
] = await Promise.all([
  readFile("src/extension/provider-recovery.ts", "utf8"),
  readFile("src/extension/provider-self-healing.ts", "utf8"),
  readFile("src/extension/provider-page-inspection.ts", "utf8"),
  readFile("src/extension/participant-row-identity.ts", "utf8"),
  readFile("src/extension/login-concierge.ts", "utf8"),
  readFile("src/extension/provider-tab-boundary.ts", "utf8"),
  readFile("src/extension/consultation-panel.tsx", "utf8"),
  readFile("extension-public/service-worker.js", "utf8"),
  readFile("extension-public/content-script.js", "utf8"),
  readFile("app/app.html", "utf8"),
  readFile("extension/sidepanel.html", "utf8"),
]);

const mappingFailures = [
  "ChatChat could not confidently identify the AI message box automatically.",
  "ChatChat found the message box but could not confidently identify the send button.",
  "The detected send button did not become clickable after ChatChat filled the message box.",
  "Automatic page setup did not produce a complete browser recipe.",
];
for (const failure of mappingFailures) {
  requireText(recovery, failure, "current recoverable mapping failure");
  if (failure !== "Automatic page setup did not produce a complete browser recipe.") {
    requireText(contentScript, failure, "matching live AUTO_SETUP failure");
  }
}

for (const forbidden of [
  "The AI page did not return the automatic ChatChat connection reply in time.",
  "CHATCHAT_READY",
  "Consultation protocol returned",
]) {
  if (recovery.includes(forbidden)) fail(`Recovery policy must not classify transport/protocol failure text: ${forbidden}`);
}

requireText(recovery, "createdByChatChat", "user-owned tab privacy gate");
requireText(recovery, "login_owned_by_concierge", "Login Concierge ownership");
requireText(recovery, "wrong_provider_origin", "Provider-origin fail-closed rule");
requireText(inspection, "classifyLoginState", "shared login classification");
requireText(inspection, "passwordInputs", "bounded Provider-page observation");
requireText(inspection, "composerCandidates", "bounded Provider-page observation");
requireText(identity, "participant-main > small", "stable hostname row join");
requireText(identity, "row.dataset.seatId", "stable seat DOM identity");
requireText(concierge, "participantRowMap", "Login Concierge stable seat identity");
requireText(concierge, "inspectProviderPage", "Login Concierge shared page observer");
if (concierge.includes("chrome.scripting.executeScript")) {
  fail("Login Concierge must not maintain a second Provider-page inspection implementation.");
}

requireText(tabBoundary, "participant.createdByChatChat === true", "fail-closed managed-tab ownership receipt");
requireText(tabBoundary, "mayAutomaticallyNavigateProviderTab", "single automatic-navigation policy");
requireText(tabBoundary, "mayAutomaticallyResumeProviderTab", "single background-resume policy");
requireText(
  consultationPanel,
  "if (!mayAutomaticallyResumeProviderTab(participant)) continue;",
  "hydration boundary that leaves user-owned tabs untouched",
);
requireText(
  consultationPanel,
  "if (mayAutomaticallyNavigateProviderTab(participant)) {",
  "consultation session navigation ownership gate",
);
requireText(
  consultationPanel,
  "await chrome.tabs.update(participant.tabId, { url: participant.startUrl });",
  "managed clean-session navigation primitive",
);
const automaticSessionNavigations = consultationPanel.match(
  /chrome\.tabs\.update\(participant\.tabId,\s*\{\s*url:\s*participant\.startUrl\s*\}\)/g,
) ?? [];
if (automaticSessionNavigations.length !== 1) {
  fail(`Expected exactly one Provider session navigation primitive behind the managed-tab gate; found ${automaticSessionNavigations.length}.`);
}

requireText(coordinator, "CLAIM_PROVIDER_SELF_HEALING", "single-winner recovery claim");
requireText(coordinator, "chrome.tabs.update", "one clean navigation primitive");
requireText(coordinator, "tabs.onUpdated auto-resume", "existing retry ownership boundary");
requireText(coordinator, "createdByChatChat", "coordinator privacy metadata");
requireText(coordinator, "RECONNECT_SETTLE_GRACE_MS", "bounded post-load reconnect settlement window");
requireText(coordinator, 'changeInfo?.status === "complete"', "clean Provider page completion signal");
requireText(coordinator, "pageLoadCompletedAt", "explicit recovery episode page-load receipt");
requireText(coordinator, "cleanPageRetrySettled", "terminal failure exit after the automatic retry opportunity");
requireText(worker, "SELF_HEALING_CLAIMS_KEY", "durable MV3 recovery claim ledger");
requireText(worker, "chrome.storage.session", "session-scoped recovery claim persistence");
requireText(worker, "await store.set", "claim persisted before navigation permission is returned");
requireText(worker, 'redirect: "manual"', "Evidence verifier redirect hardening must survive worker edits");
requireText(worker, 'credentials: "omit"', "Evidence verifier credential isolation must survive worker edits");
requireText(app, "provider-self-healing.ts", "Full Room self-healing mount");
requireText(sidePanel, "provider-self-healing.ts", "Side Panel self-healing mount");

for (const forbidden of [
  ".click()",
  "location.reload",
  "RECIPES_KEY",
  "AUTO_SETUP",
  "TEACH",
  "requestConnectionRetry",
]) {
  if (coordinator.includes(forbidden)) fail(`Self-healing coordinator must not own ${forbidden}.`);
}

console.log("✓ ChatChat zero-config Provider self-healing product boundary passed");
console.log("✓ User-owned Provider tabs cannot gain automatic navigation or background reconnect authority");

function requireText(haystack, needle, label) {
  if (!haystack.includes(needle)) fail(`Missing ${label}: ${needle}`);
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}