import fs from "node:fs";

const files = [
  "extension/sidepanel.html",
  "extension-public/manifest.json",
  "src/extension/consultation-panel.tsx",
  "src/extension/consultation-panel.css",
  "src/i18n/index.ts",
  "src/consultation/equality.ts",
  "docs/CONSULTATION_PROTOCOL.md",
  "docs/CONSULTATION_PROTOCOL.zh-CN.md",
];

const source = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");

for (const required of [
  "AI Consultation",
  "equal participant",
  "用户提案",
  "平等 AI 参与者",
  "Independent AI Participant",
]) {
  if (!source.includes(required)) {
    throw new Error(`Consultation product language is missing required concept: ${required}`);
  }
}

for (const forbidden of [
  "KING'S COMMAND",
  "AI HOUSE",
  "HOUSE VERDICT",
  "众议院",
  "代表团共识",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`Primary consultation product surface reintroduced legacy hierarchy wording: ${forbidden}`);
  }
}

const webOnboarding = fs.readFileSync("src/extension/web-room-onboarding.tsx", "utf8");
const webOnboardingCss = fs.readFileSync("src/extension/web-room-onboarding.css", "utf8");
const automaticTeam = fs.readFileSync("src/extension/automatic-team.ts", "utf8");
const webAppCss = fs.readFileSync("src/extension/web-app.css", "utf8");
const serviceWorker = fs.readFileSync("extension-public/service-worker.js", "utf8");
const sidePanelHtml = fs.readFileSync("extension/sidepanel.html", "utf8");
const appHtml = fs.readFileSync("app/app.html", "utf8");
const loginConcierge = fs.readFileSync("src/extension/login-concierge.ts", "utf8");
const loginState = fs.readFileSync("src/extension/login-state.ts", "utf8");
const onboardingCopy = extractVisibleCopy(webOnboarding);

for (const required of [
  "ZERO-CONFIG START",
  "零配置开始",
  "chrome.permissions.request",
  "permissionReady",
  "Automatic team:",
  "不用填配置表",
  "buildAutomaticTeamPlan",
]) {
  if (!webOnboarding.includes(required)) {
    throw new Error(`Zero-config Web Room contract is missing: ${required}`);
  }
}

for (const jargon of ["selector", "adapter", "recipe"]) {
  if (onboardingCopy.toLowerCase().includes(jargon)) {
    throw new Error(`Novice Web Room onboarding leaked internal setup jargon: ${jargon}`);
  }
}

for (const required of [
  "ROOM KEEPER",
  "会议室管家",
  "installRoomKeeper",
  "onRemoved",
  "readLiveRoomState",
  "mergeRetainedDetections",
  "room-recovery",
]) {
  if (!webOnboarding.includes(required)) {
    throw new Error(`Room Keeper contract is missing: ${required}`);
  }
}

for (const required of [
  "room-keeper-card",
  'data-chatchat-onboarding="room-recovery"',
]) {
  if (!webOnboardingCss.includes(required)) {
    throw new Error(`Room Keeper recovery surface is missing: ${required}`);
  }
}

for (const required of [
  "DEFAULT_AUTOMATIC_PROVIDER_IDS",
  "buildAutomaticTeamPlan",
  "automaticTeamPermissionDescriptor",
  "byOrigin.size >= 2",
]) {
  if (!automaticTeam.includes(required)) {
    throw new Error(`Automatic team planner contract is missing: ${required}`);
  }
}

for (const manualControl of [
  ".participants-card > .connect-all-button",
  ".participants-card > .participant-actions",
  ".participants-card > .url-opener",
  ".participants-card > .discovered-section",
  ".quick-open",
]) {
  if (!webAppCss.includes(manualControl)) {
    throw new Error(`Web Room must hide manual setup control by default: ${manualControl}`);
  }
}

if (!webAppCss.includes("display: none !important")) {
  throw new Error("Web Room manual setup controls are not explicitly hidden from the novice-first surface.");
}

for (const required of [
  "openPanelOnActionClick: false",
  "chrome.action.onClicked.addListener",
  "chrome.runtime.getURL(\"app/app.html\")",
  "chrome.tabs.create({ url: appUrl, active: true })",
]) {
  if (!serviceWorker.includes(required)) {
    throw new Error(`Toolbar-to-Full-Room contract is missing: ${required}`);
  }
}

if (sidePanelHtml.includes("open-web-room.js")) {
  throw new Error("Side Panel must not be a mandatory trampoline into the Full Room.");
}

for (const surface of [appHtml, sidePanelHtml]) {
  if (!surface.includes("/src/extension/login-concierge.ts")) {
    throw new Error("Every browser consultation surface must mount the Login Concierge.");
  }
}

for (const required of [
  "classifyLoginState",
  "connection-needs-login",
  "No retry needed",
  "不用回来点重试",
  "Sign in",
  "去登录",
]) {
  if (!loginConcierge.includes(required)) {
    throw new Error(`Login Concierge contract is missing: ${required}`);
  }
}

for (const required of [
  "needs_login",
  "passwordInputs",
  "loginControls",
  "composerCandidates",
]) {
  if (!loginState.includes(required)) {
    throw new Error(`Login-state classifier contract is missing: ${required}`);
  }
}

console.log("✓ ChatChat primary browser product language is equal-participant consultation");
console.log("✓ ChatChat Web Room defaults to zero-config automatic setup");
console.log("✓ ChatChat Room Keeper restores stale participant rooms without manual setup");
console.log("✓ ChatChat novice onboarding hides internal setup jargon");
console.log("✓ ChatChat toolbar opens the Full Room directly");
console.log("✓ ChatChat treats provider login as an automatic-resume state, not configuration failure");

function extractVisibleCopy(sourceText) {
  const start = sourceText.indexOf("const COPY = {");
  const end = sourceText.indexOf("} as const;", start);
  if (start < 0 || end < 0) throw new Error("Could not isolate Web Room onboarding copy.");
  return sourceText.slice(start, end);
}
