import fs from "node:fs";

const execution = fs.readFileSync("src/extension/execution-provenance.tsx", "utf8");
const attendance = fs.readFileSync("src/theater/provider-attendance.ts", "utf8");
const agent = fs.readFileSync("src/provider-sdk/consultation-agent.ts", "utf8");
const prompt = fs.readFileSync("src/provider-sdk/consultation-protocol.ts", "utf8");
const executionLedger = fs.readFileSync("src/provider-sdk/execution-audit.ts", "utf8");
const transportLedger = fs.readFileSync("src/provider-sdk/transport-audit.ts", "utf8");
const executionHistory = fs.readFileSync("src/history/execution-audit-history.ts", "utf8");
const historyObserver = fs.readFileSync("src/extension/consultation-history-observer.ts", "utf8");
const historyPortal = fs.readFileSync("src/extension/consultation-history-portal.tsx", "utf8");
const historyGuard = fs.readFileSync("extension-public/history-persistence-showcase-guard.js", "utf8");
const auditDocEn = fs.readFileSync("docs/PROVIDER_ATTENDANCE_AUDIT.md", "utf8");
const auditDocZh = fs.readFileSync("docs/PROVIDER_ATTENDANCE_AUDIT.zh-CN.md", "utf8");
const app = fs.readFileSync("app/app.html", "utf8");
const sidepanel = fs.readFileSync("extension/sidepanel.html", "utf8");
const panel = fs.readFileSync("src/extension/consultation-panel.tsx", "utf8");
const showcase = fs.readFileSync("extension-public/consultation-showcase-bootstrap.js", "utf8");
const liveGuard = fs.readFileSync("extension-public/live-deliberation-showcase-guard.js", "utf8");

for (const page of [["Full Room", app], ["Side Panel", sidepanel]]) {
  const [label, html] = page;
  assert(html.includes('id="execution-provenance-root"'), `${label} must mount execution provenance.`);
  assert(html.includes('/src/extension/execution-provenance.tsx'), `${label} must load execution provenance.`);
  assert(
    html.indexOf('/src/extension/execution-provenance.tsx') < html.indexOf('/src/extension/consultation-panel.tsx'),
    `${label} must install the transport observer before the consultation panel starts.`,
  );
}

for (const claim of [
  'SYNTHETIC_SHOWCASE',
  'synthetic-showcase',
  'live-provider-tabs',
  'LIVE PROVIDER RECEIPTS',
  '这不是一场真实 AI 协商',
  'Your custom proposal is not sent',
  'Synthetic showcase only supports its fixed demo proposal',
  'textarea.readOnly = true',
  'data-provider-receipt',
  'data-provider-attendance-audit',
  'data-attendance-snapshot-count',
  'data-attendance-published-count',
  'recordProviderTransportAudit',
  'RUN_SPEECH',
]) {
  assert(execution.includes(claim), `Execution boundary is missing: ${claim}`);
}

assert(
  execution.includes('url.searchParams.delete("showcase")'),
  "Synthetic showcase must offer a real-mode exit that removes the showcase query parameter.",
);

for (const claim of [
  'new BrowserConsultationAgent(',
  'type: "RUN_SPEECH"',
  'prompt,',
  'timeoutMs: 120_000',
  'chrome.tabs.sendMessage(tabId, { __chatchat: true, ...payload })',
]) {
  assert(panel.includes(claim), `Live provider transport path disappeared: ${claim}`);
}

for (const claim of [
  'SESSION_ID:',
  'PUBLIC_SNAPSHOT_EVENT_IDS_JSON:',
  'CONSULTATION_EVENTS_JSON:',
]) {
  assert(prompt.includes(claim), `Provider prompt audit identity disappeared: ${claim}`);
}
for (const claim of [
  'turn_started',
  'structured_parsed',
  'repair_requested',
  'structured_failed',
  'fallback_emitted',
  'BROWSER_PROVIDER_EXECUTION_AUDIT',
]) {
  assert(agent.includes(claim), `BrowserConsultationAgent audit stage disappeared: ${claim}`);
}
for (const claim of [
  'response_captured',
  'structured_parsed',
  'published',
  'repaired',
  'fallback',
  'publishedEventIds',
  'snapshotEventIds',
]) {
  assert(attendance.includes(claim), `Attendance audit model is missing: ${claim}`);
}

for (const [label, source, claims] of [
  ["execution ledger", executionLedger, ['MAX_BUFFERED_EVENTS', 'providerExecutionAuditSnapshot', 'buffer.push(copy)']],
  ["transport ledger", transportLedger, ['MAX_BUFFERED_RECORDS', 'providerTransportAuditSnapshot', 'recordProviderTransportAudit', 'buffer.push(copy)']],
]) {
  for (const claim of claims) assert(source.includes(claim), `${label} is missing durable-freeze prerequisite: ${claim}`);
}

for (const claim of [
  'chatchat-provider-execution-history-v1',
  'ExecutionAuditHistoryArchive',
  'createExecutionAuditHistoryArchive',
  'transports',
  'execution',
  'MAX_ARCHIVES = 24',
]) {
  assert(executionHistory.includes(claim), `Execution history store is missing: ${claim}`);
}
for (const claim of [
  'ExecutionAuditHistoryStore',
  'providerTransportAuditSnapshot(report.sessionId)',
  'providerExecutionAuditSnapshot(report.sessionId)',
  'createExecutionAuditHistoryArchive',
  'Promise.all([archiveSave, evidenceSave, executionSave])',
]) {
  assert(historyObserver.includes(claim), `Consultation completion does not durably freeze execution audit: ${claim}`);
}
for (const claim of [
  'ExecutionAuditHistoryStore',
  'buildProviderAttendanceAudit',
  'LOCAL · EXECUTION RECEIPT',
  'data-history-execution-audit="loaded"',
  'data-history-execution-snapshot-count',
  'data-history-execution-published-count',
  'executionHistory.delete(sessionId)',
  'executionHistory.clear()',
]) {
  assert(historyPortal.includes(claim), `History UI does not replay/delete execution receipts correctly: ${claim}`);
}
for (const claim of [
  'chatchat-provider-execution-history-v1',
  'chatchatExecutionHistoryPersistenceShowcase',
  'chatchatExecutionHistoryReplayShowcase',
  'execution.transports',
  'execution.execution',
  'record.stage === "structured_parsed"',
  'record.snapshotEventIds.length > 0',
  'historyButton.click()',
  'data-history-execution-audit="loaded"',
  'data-history-execution-snapshot-count',
  'data-history-execution-published-count',
]) {
  assert(historyGuard.includes(claim), `Chromium history proof does not enforce durable execution receipt replay: ${claim}`);
}

for (const [label, doc] of [["English", auditDocEn], ["Chinese", auditDocZh]]) {
  for (const claim of [
    'PUBLIC_SNAPSHOT_EVENT_IDS_JSON',
    'Blackboard',
    'FALLBACK',
    'DEMO · SYNTHETIC',
    'chatchat-provider-execution-history-v1',
  ]) {
    assert(doc.includes(claim), `${label} attendance audit documentation is missing: ${claim}`);
  }
}
assert(auditDocEn.includes('does **not** expose or infer hidden model chain-of-thought'), "English audit docs must preserve the hidden-reasoning boundary.");
assert(auditDocZh.includes('不展示、也不推断模型隐藏的思维链'), "Chinese audit docs must preserve the hidden-reasoning boundary.");
assert(auditDocEn.includes('Durable execution receipt'), "English docs must describe durable execution receipt history.");
assert(auditDocZh.includes('Durable execution receipt'), "Chinese docs must describe durable execution receipt history.");
assert(auditDocEn.includes('zero Provider calls'), "English docs must preserve archive replay no-call semantics.");
assert(auditDocZh.includes('0 次 Provider 调用'), "Chinese docs must preserve archive replay no-call semantics.");

for (const claim of [
  'if (params.get("showcase") !== "consultation") return;',
  'Synthetic automatic connection passed.',
  'function speechFor(tabId, prompt)',
  'Should ChatChat make the Web Room the primary experience',
  'Web + Extension',
]) {
  assert(showcase.includes(claim), `Synthetic showcase contract changed unexpectedly: ${claim}`);
}

for (const claim of [
  'data-chatchat-execution-boundary-showcase',
  'data-chatchat-provider-attendance-showcase',
  'data-execution-mode="synthetic-showcase"',
  'data-synthetic-showcase-warning="visible"',
  'data-synthetic-proposal-locked="true"',
  'data-provider-receipt="received"',
  'data-provider-attendance-audit="active"',
  'data-attendance-turn-state="published"',
  'data-attendance-snapshot-count',
  'sawHonestSyntheticBoundary',
  'sawVerifiedAttendance',
]) {
  assert(liveGuard.includes(claim), `Real Chromium showcase proof does not enforce execution attendance: ${claim}`);
}

console.log("✓ live/synthetic execution, per-seat attendance, durable receipts, history replay and Chromium proof are mechanically enforced");

function assert(condition, message) {
  if (!condition) throw new Error(`Execution boundary check failed: ${message}`);
}
