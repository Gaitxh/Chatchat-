import { readFile } from "node:fs/promises";

const [teamSettings, teamCss, panel, webCss, appHtml] = await Promise.all([
  readFile("src/extension/team-settings.ts", "utf8"),
  readFile("src/extension/team-settings.css", "utf8"),
  readFile("src/extension/consultation-panel.tsx", "utf8"),
  readFile("src/extension/web-app.css", "utf8"),
  readFile("app/app.html", "utf8"),
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

const inviteCopy = teamSettings.match(/inviteLabel:[\s\S]*?inviteTitle:[^\n]+/g)?.join("\n") ?? "";
for (const jargon of ["selector", "adapter", "recipe", "cookie", "token"]) {
  if (inviteCopy.toLocaleLowerCase().includes(jargon)) {
    fail(`Invite AI novice copy leaked implementation/security jargon: ${jargon}`);
  }
}

console.log("✓ ChatChat exposes URL onboarding as first-class Invite AI without exposing advanced repair plumbing");

function requireText(haystack, needle, label) {
  if (!haystack.includes(needle)) fail(`Missing ${label}: ${needle}`);
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}
