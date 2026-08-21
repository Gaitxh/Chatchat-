import { readFile } from "node:fs/promises";

const [teamSettings, teamCss, panel, webCss, appHtml, zeroConfigGuard, inviteGuard, inviteBootstrap, inviteWorkflow] = await Promise.all([
  readFile("src/extension/team-settings.ts", "utf8"),
  readFile("src/extension/team-settings.css", "utf8"),
  readFile("src/extension/consultation-panel.tsx", "utf8"),
  readFile("src/extension/web-app.css", "utf8"),
  readFile("app/app.html", "utf8"),
  readFile("extension-public/zero-config-showcase-guard.js", "utf8"),
  readFile("extension-public/invite-ai-showcase-guard.js", "utf8"),
  readFile("extension-public/invite-ai-showcase-bootstrap.js", "utf8"),
  readFile(".github/workflows/invite-ai-ui.yml", "utf8"),
]);

for (const copy of [
  "+ Invite AI",
  "＋ 邀请 AI",
  "Paste any AI website URL",
  "粘贴任意 AI 网站 URL",
  "Invite",
  "邀请入席",
]) {
  requireText(teamSettings, copy, "first-class Invite AI copy");
}

for (const contract of [
  'invite.dataset.chatchatInviteAi = INVITE_DATASET_VALUE',
  'invite.setAttribute("aria-label", copy.inviteTitle)',
  'input.placeholder = copy.invitePlaceholder',
  'setText(button, copy.inviteAction)',
]) {
  requireText(teamSettings, contract, "Invite AI DOM contract");
}

for (const contract of [
  '[data-chatchat-invite-ai="true"]',
  "display: block !important",
  ".participant-actions",
  ".discovered-section",
  ".quick-open",
]) {
  requireText(teamCss, contract, "Invite AI visibility / advanced-control boundary");
}

for (const step of [
  "async function openUrl()",
  "detectProviderUrl(draft)",
  "requestOriginPermissions([detection.origin], locale)",
  "chrome.tabs.create({ url: detection.normalizedUrl, active: true })",
  "waitForTabComplete(tab.id, 35_000)",
  "attachTab(tab, true)",
]) {
  requireText(panel, step, "existing automatic URL onboarding pipeline");
}

// The old defensive Web Room stylesheet can keep hiding generic URL controls;
// team-settings.css is intentionally loaded afterwards and only promotes the one
// entry that team-settings.ts marks as novice-safe Invite AI.
requireText(webCss, ".participants-card > .url-opener", "defensive generic URL-control hide");
const webCssIndex = appHtml.indexOf('/src/extension/web-app.css');
const teamCssIndex = appHtml.indexOf('/src/extension/team-settings.css');
if (webCssIndex < 0 || teamCssIndex < 0 || teamCssIndex <= webCssIndex) {
  fail("team-settings.css must load after web-app.css so only the marked Invite AI entry can override the generic hide.");
}

// Zero-config onboarding owns the room until the starter council is assembled.
// Afterwards Invite AI is normal product chrome, while repair/team-management
// actions remain hidden behind the explicit disclosure.
for (const contract of [
  'data-chatchat-invite-ai="true"',
  "inviteVisibleByDefault",
  "advancedHiddenByDefault",
  "chatchatInviteAiAfterAssembly",
  "advancedVisibleOnDemand",
  "inviteStillVisible",
  "advancedHiddenAgain",
  "inviteRestored",
]) {
  requireText(zeroConfigGuard, contract, "starter-room → Invite AI product transition");
}

// "Paste any AI website URL" is stronger than known-provider catalog support.
// Keep a synthetic production-browser proof for an unknown reserved domain so
// the novice promise must continue traversing custom detection → AUTO_SETUP →
// persisted local recipe → READY without exposing manual repair by default.
for (const contract of [
  'params.get("target") === "custom"',
  'https://council-lab.example/',
  'invited.providerId !== "custom"',
  'chatchatInviteAiAutoSetupCount',
  'chatchatInviteAiAutoSetupProfile',
  'chatchatInviteAiCustomRecipe = "complete"',
]) {
  requireText(inviteGuard, contract, "custom Invite AI proof guard");
}
for (const contract of [
  "autoSetupCount += 1",
  "chatchatInviteAiAutoSetupCount",
  "chatchatInviteAiAutoSetupProfile",
  'diagnostics: { mode: "invite-ai-automatic" }',
]) {
  requireText(inviteBootstrap, contract, "custom AUTO_SETUP fixture evidence");
}
for (const contract of [
  "for TARGET in known custom",
  "chatchat-invite-ai-custom-$LANG.html",
  'data-chatchat-invite-ai-provider-id="custom"',
  'data-chatchat-invite-ai-auto-setup-count="1"',
  'data-chatchat-invite-ai-custom-recipe="complete"',
]) {
  requireText(inviteWorkflow, contract, "known/custom Invite AI Chromium workflow");
}

const inviteCopy = teamSettings.match(/inviteLabel:[\s\S]*?inviteTitle:[^\n]+/g)?.join("\n") ?? "";
for (const jargon of ["selector", "adapter", "recipe", "cookie", "token"]) {
  if (inviteCopy.toLocaleLowerCase().includes(jargon)) {
    fail(`Invite AI novice copy leaked implementation/security jargon: ${jargon}`);
  }
}

console.log("✓ ChatChat exposes URL onboarding as first-class Invite AI without exposing advanced repair plumbing");
console.log("✓ Invite AI appears after starter-room assembly while advanced team controls stay disclosure-gated");
console.log("✓ Invite AI browser proof covers both a known Provider and an unknown custom URL through AUTO_SETUP → persisted recipe → READY");

function requireText(haystack, needle, label) {
  if (!haystack.includes(needle)) fail(`Missing ${label}: ${needle}`);
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}
