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
const automaticTeam = fs.readFileSync("src/extension/automatic-team.ts", "utf8");
const webAppCss = fs.readFileSync("src/extension/web-app.css", "utf8");
const serviceWorker = fs.readFileSync("extension-public/service-worker.js", "utf8");
const sidePanelHtml = fs.readFileSync("extension/sidepanel.html", "utf8");
const appHtml = fs.readFileSync("app/app.html", "utf8");
const loginConcierge = fs.readFileSync("src/extension/login-concierge.ts", "utf8");
const loginState = fs.readFileSync("src/extension/login-state.ts", "utf8");
const providerPageInspection = fs.readFileSync("src/extension/provider-page-inspection.ts", "utf8");
const gateBProofUi = fs.readFileSync("src/extension/gate-b-proof-ui.ts", "utf8");
const gateBObserver = fs.readFileSync("src/extension/gate-b-observer.ts", "utf8");
const proofPack = fs.readFileSync("src/validation/proof-pack.ts", "utf8");
const onboardingCopy = extractVisibleCopy(webOnboarding);

for (const required of [
  "CHOOSE YOUR AI TEAM",
  "自选 AI 团队",
  "chrome.permissions.request",
  "Optional starter team:",
  "可选起步团队",
  "buildAutomaticTeamPlan",
  "planFreshSeat",
]) {
  if (!webOnboarding.includes(required)) {
    throw new Error(`Explicit-choice Web Room contract is missing: ${required}`);
  }
}

// Suggestions and existing permissions are not user consent. Background
// discovery may update the suggested roster, but must not start it or ask grants.
const refreshStart = webOnboarding.indexOf("async function refreshPlan()");
const refreshEnd = webOnboarding.indexOf("function completeAssembly()", refreshStart);
if (refreshStart < 0 || refreshEnd < 0) throw new Error("Onboarding discovery boundary is missing.");
const discoveryOnly = webOnboarding.slice(refreshStart, refreshEnd);
if (/\bassemble\s*\(|chrome\.permissions\.request|chrome\.tabs\.create/.test(discoveryOnly)) {
  throw new Error("Background discovery must not assemble a team, open provider tabs or request permissions.");
}
if (!webOnboarding.includes('button.addEventListener("click"') || !webOnboarding.includes("const selected = [...plan]")) {
  throw new Error("Suggested team assembly must be an explicit user action on a frozen selection.");
}
for (const rule of webAppCss.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
  if (rule[1].includes('[data-chatchat-onboarding="zero-config"] .participants-card')
    && /display\s*:\s*none/.test(rule[2])) {
    throw new Error("An empty room must keep its + Invite AI card visible.");
  }
}

for (const jargon of ["selector", "adapter", "recipe"]) {
  if (onboardingCopy.toLowerCase().includes(jargon)) {
    throw new Error(`Novice Web Room onboarding leaked internal setup jargon: ${jargon}`);
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
  if (!surface.includes("/src/extension/gate-b-proof-ui.ts")) {
    throw new Error("Every browser consultation surface must mount the Real Provider Proof observer/UI.");
  }
}

for (const required of [
  "inspectProviderPage",
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

for (const required of [
  "classifyLoginState",
  "chrome.scripting.executeScript",
  "passwordInputs",
  "loginControls",
  "composerCandidates",
]) {
  if (!providerPageInspection.includes(required)) {
    throw new Error(`Shared Provider-page inspection contract is missing: ${required}`);
  }
}

for (const required of [
  "REAL PROVIDER PROOF",
  "真实 PROVIDER 验收",
  "demo-only",
  "metadata-only",
  "COPY GITHUB MARKDOWN",
]) {
  if (!gateBProofUi.includes(required)) {
    throw new Error(`Real Provider Proof UI contract is missing: ${required}`);
  }
}

for (const forbidden of ["ROYAL PROOF", "御前验收", "King's", "Browser House", "HOUSE VERDICT"]) {
  if (gateBProofUi.includes(forbidden) || gateBObserver.includes(forbidden) || proofPack.includes(forbidden)) {
    throw new Error(`Active Real Provider Proof path reintroduced legacy product language: ${forbidden}`);
  }
}

for (const required of [
  "chatchat.consultation.participants.v1",
  "chatchat.consultation.connections.v1",
  "captureReadyBrowserConsultationProviderProof",
  'location.protocol === "chrome-extension:"',
  'document.documentElement.dataset.surface === "web-app"',
  '`Chromium ${surface} · ${coarsePlatformHint(navigator.userAgent)}`',
]) {
  if (!gateBObserver.includes(required)) {
    throw new Error(`Current Gate B observer contract is missing: ${required}`);
  }
}

for (const required of [
  "ChatChat Real Provider Proof",
  "distinctProviderHosts.size >= 2",
  "user proposal",
  "environment-specific evidence",
]) {
  if (!proofPack.includes(required)) {
    throw new Error(`Real Provider Proof export contract is missing: ${required}`);
  }
}

console.log("✓ ChatChat primary browser product language is equal-participant consultation");
console.log("✓ ChatChat Web Room starts with explicit seat choice and optional starter suggestions");
console.log("✓ ChatChat novice onboarding hides internal setup jargon");
console.log("✓ ChatChat toolbar opens the Full Room directly");
console.log("✓ ChatChat treats provider login as an automatic-resume state, not configuration failure");
console.log("✓ ChatChat Provider page-shape inspection is shared across automatic login/recovery UX");
console.log("✓ ChatChat Real Provider Proof observes the current Browser Consultation and rejects synthetic live evidence");

function extractVisibleCopy(sourceText) {
  const start = sourceText.indexOf("const COPY = {");
  const end = sourceText.indexOf("} as const;", start);
  if (start < 0 || end < 0) throw new Error("Could not isolate Web Room onboarding copy.");
  return sourceText.slice(start, end);
}
