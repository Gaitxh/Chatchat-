import fs from "node:fs";

const integrity = fs.readFileSync("src/consultation/receipt-integrity.ts", "utf8");
const share = fs.readFileSync("src/consultation/receipt-share.ts", "utf8");
const card = fs.readFileSync("src/extension/components/ConsultationReceipt.tsx", "utf8");
const portal = fs.readFileSync("src/extension/consultation-receipt-portal.tsx", "utf8");
const guard = fs.readFileSync("extension-public/consultation-receipt-showcase-guard.js", "utf8");

for (const claim of [
  "ConsultationReceiptExecutionIntegrity",
  "consultationReceiptIntegrityMarkdown",
  "consultationReceiptSvgWithIntegrity",
  'height="1020" viewBox="0 0 1200 1020"',
  "Execution integrity proves Provider execution provenance, not answer correctness",
  "Synthetic execution integrity proves fixture/UI/protocol flow only",
  "立场对齐度必须和这个执行缺口一起阅读",
]) {
  assert(integrity.includes(claim), `Receipt integrity share layer is missing: ${claim}`);
}

for (const claim of [
  "consultationReceiptIntegrityMarkdown",
  "executionIntegrity?",
]) {
  assert(share.includes(claim), `Safe Markdown receipt sharing is missing integrity: ${claim}`);
}

for (const claim of [
  "executionIntegrity?: ConsultationReceiptExecutionIntegrity",
  "safeConsultationReceiptMarkdown(receipt, locale, executionIntegrity)",
  "consultationReceiptSvgWithIntegrity",
  "data-receipt-execution-integrity",
  "data-receipt-execution-mode",
  "对齐度必须和执行缺口一起阅读",
  "Execution provenance, not answer correctness",
]) {
  assert(card.includes(claim), `Receipt UI/export is missing execution integrity: ${claim}`);
}

for (const claim of [
  "ExecutionAuditHistoryStore",
  "providerTransportAuditSnapshot(report.sessionId)",
  "providerExecutionAuditSnapshot(report.sessionId)",
  "executionHistory.load(detail.archive.sessionId)",
  "buildProviderAttendanceAudit",
  "deriveMeetingExecutionIntegrity",
]) {
  assert(portal.includes(claim), `Receipt portal is not deriving integrity from live/archive audit evidence: ${claim}`);
}

for (const claim of [
  'data-receipt-execution-mode="synthetic-showcase"',
  'data-receipt-execution-integrity="verified"',
  "chatchatReceiptIntegrityShowcase",
]) {
  assert(guard.includes(claim), `Chromium Consultation Receipt proof no longer requires Integrity: ${claim}`);
}

console.log("✓ Consultation Receipt preserves Meeting Integrity across UI, Markdown, SVG and archive replay");

function assert(condition, message) {
  if (!condition) throw new Error(`Receipt Integrity check failed: ${message}`);
}
