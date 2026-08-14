import {
  consultationReceiptIntegrityMarkdown,
  consultationReceiptSvgWithIntegrity,
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
assert(zhMarkdown.includes("不是完整 Provider 参与以后形成的共识"), "Chinese receipt must warn that alignment is not full-Provider consensus");

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

const baseSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="920" viewBox="0 0 1200 920"><rect width="1200" height="920" fill="#fff"/></svg>';
const svg = consultationReceiptSvgWithIntegrity(baseSvg, synthetic, "en");
assert(svg.includes('height="1020" viewBox="0 0 1200 1020"'), "Integrity SVG must grow the receipt canvas");
assert(svg.includes('height="1020" fill="#fff"'), "Integrity SVG must extend the receipt background");
assert(svg.includes("MEETING EXECUTION INTEGRITY"), "Integrity SVG must include its heading");
assert(svg.includes("12/12 turns verified"), "Integrity SVG must include verified turn counts");
assert(svg.includes("DEMO · SYNTHETIC"), "Integrity SVG must preserve synthetic mode");

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
