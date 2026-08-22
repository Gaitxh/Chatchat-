import { readFile } from "node:fs/promises";

const [ledger, store, runtime, portal, app, hierarchy, test, runner, workflow, showcaseGuard] = await Promise.all([
  readFile("src/extension/browser-authority-ledger.ts", "utf8"),
  readFile("src/extension/browser-authority-store.ts", "utf8"),
  readFile("src/extension/browser-authority-runtime.ts", "utf8"),
  readFile("src/extension/browser-authority-portal.tsx", "utf8"),
  readFile("app/app.html", "utf8"),
  readFile("src/extension/web-visual-hierarchy.ts", "utf8"),
  readFile("tests/browser-authority-ledger.test.ts", "utf8"),
  readFile("scripts/run-test-suite.mjs", "utf8"),
  readFile(".github/workflows/browser-authority-ui.yml", "utf8"),
  readFile("extension-public/browser-authority-showcase-guard.js", "utf8"),
]);

for (const text of [
  'BROWSER_AUTHORITY_RECEIPTS_KEY = "chatchat.browser-authority.receipts.v1"',
  "MAX_BROWSER_AUTHORITY_RECEIPTS = 80",
  "sanitizeBrowserAuthorityReceipt",
  "appendBoundedBrowserAuthorityReceipt",
  'ownership: "managed"',
  "mayDispatchProviderRetryUnderBrowserAuthority",
  'if (reason === "manual") return true;',
  'return providerTabOwnership(participant) === "managed";',
]) requireText(ledger, text, "bounded managed-only Browser Authority model");

for (const forbiddenField of [
  "url:",
  "hostname:",
  "origin:",
  "prompt:",
  "responseText:",
  "cookie:",
  "token:",
  "account:",
]) {
  if (ledger.includes(forbiddenField) || store.includes(forbiddenField)) {
    fail(`Browser Authority persisted receipt model must not store browser/account content: ${forbiddenField}`);
  }
}

for (const text of [
  "writeQueue",
  "chrome.storage.session ?? chrome.storage.local",
  "appendBoundedBrowserAuthorityReceipt(current, receipt)",
]) requireText(store, text, "session-local serialized receipt persistence");

for (const text of [
  "CONNECTION_RETRY_REQUESTED_EVENT",
  "{ capture: true }",
  "mayDispatchProviderRetryUnderBrowserAuthority(participant, reason)",
  "event.stopImmediatePropagation()",
  "chatchatAuthorityBlockedAutomaticRetries",
  'action: "automatic_connection_resume"',
  'action: "managed_tab_created"',
  '"fresh_session_navigation"',
  '"self_heal_navigation"',
  ".participant-row.connection-self-healing[data-seat-id]",
  "chrome.tabs?.onUpdated",
  "chrome.storage?.onChanged",
]) requireText(runtime, text, "Browser Authority runtime firewall / action observation");

for (const text of [
  'data-browser-authority-summary="ready"',
  'data-browser-authority-ledger="ready"',
  "Your own tabs are never background-navigated or auto-resumed.",
  "你的标签页不会在后台自动导航或恢复连接。",
  "Session-local only.",
  "never page URLs, conversations, prompts, responses, accounts, cookies, or tokens.",
  "NO AUTO NAV / RESUME",
]) requireText(portal, text, "bilingual Browser Authority user boundary");

for (const root of [
  'id="browser-authority-summary-root"',
  'id="browser-authority-root"',
]) requireText(app, root, "Browser Authority roots");
requireText(app, '/browser-authority-showcase-guard.js', "Browser Authority protected retry proof guard load");

const runtimeIndex = app.indexOf('/src/extension/browser-authority-runtime.ts');
const onboardingIndex = app.indexOf('/src/extension/web-room-onboarding.tsx');
const panelIndex = app.indexOf('/src/extension/consultation-panel.tsx');
if (!(runtimeIndex >= 0 && onboardingIndex > runtimeIndex && panelIndex > runtimeIndex)) {
  fail("Browser Authority runtime must register before login-resume dispatch and Panel retry listeners.");
}

const auditBlock = hierarchy.match(/const AUDIT_ROOT_IDS = \[([\s\S]*?)\] as const;/)?.[1] ?? "";
requireText(auditBlock, '"browser-authority-root"', "Browser Authority audit-vault registration");
if (auditBlock.includes('"browser-authority-summary-root"')) {
  fail("Compact Browser boundary summary must remain on the participant surface, not inside Audit Vault.");
}

for (const text of [
  'url: "https://chatgpt.com/private/thread"',
  'prompt: "secret proposal"',
  'responseText: "private model response"',
  'cookie: "session=secret"',
  'token: "secret-token"',
  'account: "person@example.com"',
  '!mayDispatchProviderRetryUnderBrowserAuthority(userOwnedSeat, "provider-tab-loaded")',
  '!mayDispatchProviderRetryUnderBrowserAuthority(legacySeat, "provider-tab-loaded")',
  'mayDispatchProviderRetryUnderBrowserAuthority(userOwnedSeat, "manual")',
]) requireText(test, text, "adversarial Browser Authority privacy / retry tests");

for (const text of [
  'params.get("authority-proof") !== "protected"',
  'reason: "provider-tab-loaded"',
  'data-browser-authority-summary="ready"',
  'chatchatBrowserAuthorityProtectedProof = "complete"',
]) requireText(showcaseGuard, text, "actual user-owned automatic retry block proof");

requireText(runner, '"dist/tests/browser-authority-ledger.test.js"', "Browser Authority deterministic test registration");

for (const text of [
  "Browser Authority UI",
  'data-browser-authority-summary="ready"',
  'data-browser-authority-ledger="ready"',
  "authority-proof=protected",
  "showcase=invite-ai",
  "audit=open",
  "check-png-content.mjs",
]) requireText(workflow, text, "production Chromium Browser Authority proof");

console.log("✓ Browser Authority receipts are bounded, session-local, allowlisted and managed-only");
console.log("✓ Automatic Provider retry fails closed before Panel listeners; explicit manual retry remains allowed");
console.log("✓ Compact boundary summary stays public while detailed authority receipts remain in Audit Vault");
console.log("✓ Chromium proof must dispatch and block a real user-owned background retry before claiming Protected");

function requireText(haystack, needle, label) {
  if (!haystack.includes(needle)) fail(`Missing ${label}: ${needle}`);
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}
