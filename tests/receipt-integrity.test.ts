import {
  consultationReceiptIntegrityMarkdown,
  consultationReceiptSvgWithIntegrity,
  legacyConsultationReceiptExecutionIntegrity,
  type ConsultationReceiptExecutionIntegrity,
} from "../src/consultation/receipt-integrity.js";
import type { MeetingExecutionIntegrity } from "../src/theater/meeting-integrity.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

const verified = summary("live-provider-tabs", integrity({
  state: "verified",
  totalTurns: 12,
  verifiedTurns: 12,
  totalSeats: 3,
  fullyVerifiedSeats: 3,
}));
const markdown = consultationReceiptIntegrityMarkdown(verified, "en");
assert(markdown.includes("## Meeting execution integrity"), "Markdown receipt must include the integrity section");
assert(markdown.includes("Verified turns: 12/12"), "Markdown receipt must preserve verified turn counts");
assert(markdown.includes("Live Provider tabs"), "Markdown receipt must preserve live execution mode");
assert(markdown.includes("not answer correctness"), "Markdown receipt must preserve the answer-correctness boundary");

const degradedZh = summary("live-provider-tabs", integrity({
  state: "degraded",
  totalTurns: 12,
  verifiedTurns: 10,
  fallbackTurns: 1,
  failedTurns: 1,
  totalSeats: 3,
  fullyVerifiedSeats: 2,
}));
const zhMarkdown = consultationReceiptIntegrityMarkdown(degradedZh, "zh-CN");
assert(zhMarkdown.includes("执行覆盖降级"), "Chinese receipt must expose degraded execution coverage");
assert(zhMarkdown.includes("不是所有 Provider 完整参与后的共识"), "Chinese receipt must warn that alignment is not full-Provider consensus");

const synthetic = summary("synthetic-showcase", integrity({
  state: "verified",
  totalTurns: 12,
  verifiedTurns: 12,
  totalSeats: 3,
  fullyVerifiedSeats: 3,
}));
const syntheticMarkdown = consultationReceiptIntegrityMarkdown(synthetic, "en");
assert(syntheticMarkdown.includes("DEMO · SYNTHETIC"), "Synthetic receipt must preserve execution mode");
assert(syntheticMarkdown.includes("not evidence that live third-party models attended"), "Synthetic receipt must not masquerade as live Provider attendance");
const syntheticZh = consultationReceiptIntegrityMarkdown(synthetic, "zh-CN");
assert(syntheticZh.includes("不是第三方 AI 真实出席的证据"), "Synthetic Chinese receipt must preserve the live-attendance boundary");

const legacy = legacyConsultationReceiptExecutionIntegrity();
const legacyMarkdown = consultationReceiptIntegrityMarkdown(legacy, "en");
assert(legacyMarkdown.includes("Legacy / no execution receipt"), "Old archives must explicitly disclose missing durable execution receipts");
assert(legacyMarkdown.includes("will not reconstruct Provider execution integrity after the fact"), "Legacy receipts must not invent post-hoc execution provenance");

// Match the real Consultation Receipt geometry: 1200×630. The integrity layer
// must derive its own placement from the actual SVG rather than a stale mock size.
const baseSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#fff"/></svg>';
const svg = consultationReceiptSvgWithIntegrity(baseSvg, synthetic, "en");
assert(svg.includes('height="776" viewBox="0 0 1200 776"'), "Integrity SVG must grow the real receipt canvas dynamically");
assert(svg.includes('height="776" fill="#fff"'), "Integrity SVG must extend the real receipt background");
assert(svg.includes('transform="translate(50 648)"'), "Integrity block must begin below the original 630px receipt canvas");
assert(svg.includes("MEETING EXECUTION INTEGRITY"), "Integrity SVG must include its heading");
assert(svg.includes("12/12 turns verified"), "Integrity SVG must include verified turn counts");
assert(svg.includes("DEMO · SYNTHETIC"), "Integrity SVG must preserve synthetic mode");

let rejectedUnsupportedGeometry = false;
try {
  consultationReceiptSvgWithIntegrity('<svg width="1200" height="630"></svg>', synthetic, "en");
} catch {
  rejectedUnsupportedGeometry = true;
}
assert(rejectedUnsupportedGeometry, "Integrity export must fail loudly rather than silently drawing outside an unknown SVG canvas");

console.log("✓ Integrity-aware Consultation Receipt share tests passed");

function summary(
  mode: ConsultationReceiptExecutionIntegrity["mode"],
  value: MeetingExecutionIntegrity,
): ConsultationReceiptExecutionIntegrity {
  return { mode, integrity: value };
}

function integrity(overrides: Partial<MeetingExecutionIntegrity> & Pick<MeetingExecutionIntegrity, "state">): MeetingExecutionIntegrity {
  return {
    state: overrides.state,
    totalTurns: overrides.totalTurns ?? 0,
    verifiedTurns: overrides.verifiedTurns ?? 0,
    repairedTurns: overrides.repairedTurns ?? 0,
    fallbackTurns: overrides.fallbackTurns ?? 0,
    failedTurns: overrides.failedTurns ?? 0,
    unresolvedTurns: overrides.unresolvedTurns ?? 0,
    totalSeats: overrides.totalSeats ?? 0,
    fullyVerifiedSeats: overrides.fullyVerifiedSeats ?? 0,
  };
}
