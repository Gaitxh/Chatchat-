import fs from "node:fs";

const model = fs.readFileSync("src/theater/meeting-integrity.ts", "utf8");
const portal = fs.readFileSync("src/extension/meeting-integrity-portal.tsx", "utf8");
const app = fs.readFileSync("app/app.html", "utf8");
const sidepanel = fs.readFileSync("extension/sidepanel.html", "utf8");
const roomGuard = fs.readFileSync("extension-public/full-room-showcase-watch.js", "utf8");

for (const claim of [
  '"verified"',
  '"verified_after_repair"',
  '"degraded"',
  '"incomplete"',
  'fallbackTurns || audit.failedTurns',
  'unresolvedTurns',
  'fullyVerifiedSeats',
]) {
  assert(model.includes(claim), `Meeting integrity model is missing: ${claim}`);
}

for (const claim of [
  'MEETING EXECUTION INTEGRITY',
  '会议执行完整性',
  'data-meeting-integrity-state',
  'data-meeting-integrity-mode',
  'providerTransportAuditSnapshot',
  'providerExecutionAuditSnapshot',
  'buildProviderAttendanceAudit',
  'deriveMeetingExecutionIntegrity',
  'Do not read the alignment ratio as consensus after full Provider participation',
  '不要把最终对齐比例理解成“所有 AI 都充分参与后的共识”',
  'This is synthetic-demo execution integrity',
]) {
  assert(portal.includes(claim), `Meeting Integrity UI is missing: ${claim}`);
}

for (const [label, html] of [["Full Room", app], ["Side Panel", sidepanel]]) {
  assert(html.includes('id="meeting-integrity-root"'), `${label} must mount the Meeting Integrity result surface.`);
  assert(html.includes('/src/extension/meeting-integrity-portal.tsx'), `${label} must load the Meeting Integrity portal before the consultation begins.`);
  assert(
    html.indexOf('/src/extension/meeting-integrity-portal.tsx') < html.indexOf('/src/extension/consultation-panel.tsx'),
    `${label} must subscribe to completion before the consultation panel can emit it.`,
  );
}

for (const claim of [
  'data-meeting-integrity-mode="synthetic-showcase"',
  'data-meeting-integrity-state="verified"',
  'chatchatMeetingIntegrityShowcase',
  'integrity && theater',
]) {
  assert(roomGuard.includes(claim), `Full Room Chromium proof no longer requires Meeting Integrity: ${claim}`);
}

console.log("✓ Meeting Integrity keeps alignment separate from Provider execution coverage");

function assert(condition, message) {
  if (!condition) throw new Error(`Meeting Integrity check failed: ${message}`);
}
