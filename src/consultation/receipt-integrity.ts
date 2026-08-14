import type { ProviderExecutionMode } from "../provider-sdk/transport-audit.js";
import type { MeetingExecutionIntegrity } from "../theater/meeting-integrity.js";

export interface ConsultationReceiptExecutionIntegrity {
  mode: ProviderExecutionMode | "unknown";
  integrity: MeetingExecutionIntegrity;
}

export function consultationReceiptIntegrityMarkdown(
  summary: ConsultationReceiptExecutionIntegrity,
  locale: "en" | "zh-CN" = "en",
): string {
  const zh = locale === "zh-CN";
  const { integrity, mode } = summary;
  const modeLabel = mode === "live-provider-tabs"
    ? (zh ? "真实 Provider 标签页" : "Live Provider tabs")
    : mode === "synthetic-showcase"
      ? "DEMO · SYNTHETIC"
      : (zh ? "未知 / 旧记录" : "Unknown / legacy");
  return [
    "",
    `## ${zh ? "会议执行完整性" : "Meeting execution integrity"}`,
    `- ${zh ? "模式" : "Mode"}: ${modeLabel}`,
    `- ${zh ? "状态" : "State"}: ${integrityLabel(integrity.state, zh)}`,
    `- ${zh ? "已验证轮次" : "Verified turns"}: ${integrity.verifiedTurns}/${integrity.totalTurns}`,
    `- ${zh ? "完整席位" : "Fully complete seats"}: ${integrity.fullyVerifiedSeats}/${integrity.totalSeats}`,
    `- ${zh ? "修复后通过" : "Repaired"}: ${integrity.repairedTurns}`,
    `- Fallback: ${integrity.fallbackTurns}`,
    `- ${zh ? "失败" : "Failed"}: ${integrity.failedTurns}`,
    ...(integrity.unresolvedTurns ? [`- ${zh ? "未闭环" : "Unresolved"}: ${integrity.unresolvedTurns}`] : []),
    "",
    integrityBoundary(summary, zh),
  ].join("\n");
}

export function consultationReceiptSvgWithIntegrity(
  baseSvg: string,
  summary: ConsultationReceiptExecutionIntegrity,
  locale: "en" | "zh-CN" = "en",
): string {
  const zh = locale === "zh-CN";
  const { integrity, mode } = summary;
  const modeLabel = mode === "live-provider-tabs"
    ? "LIVE PROVIDER"
    : mode === "synthetic-showcase"
      ? "DEMO · SYNTHETIC"
      : "LEGACY / UNKNOWN";
  const title = zh ? "会议执行完整性" : "MEETING EXECUTION INTEGRITY";
  const state = integrityLabel(integrity.state, zh);
  const note = integrityBoundary(summary, zh);
  const block = [
    '<g transform="translate(56 858)">',
    '<rect width="1088" height="108" rx="20" fill="#eef6f3" stroke="#d6e5df"/>',
    `<text x="24" y="28" fill="#52746b" font-size="12" font-weight="800" letter-spacing="1.1">${escapeXml(title)}</text>`,
    `<text x="24" y="55" fill="#183c35" font-size="18" font-weight="760">${escapeXml(`${integrity.verifiedTurns}/${integrity.totalTurns} ${zh ? "轮已验证" : "turns verified"} · ${state}`)}</text>`,
    `<text x="24" y="78" fill="#6f817c" font-size="12">${escapeXml(`${modeLabel} · ${integrity.fullyVerifiedSeats}/${integrity.totalSeats} ${zh ? "席位完整" : "seats complete"} · ↺ ${integrity.repairedTurns} · fallback ${integrity.fallbackTurns} · failed ${integrity.failedTurns}`)}</text>`,
    `<text x="24" y="98" fill="#7c8985" font-size="10">${escapeXml(note)}</text>`,
    "</g>",
  ].join("");

  return baseSvg
    .replace('height="920" viewBox="0 0 1200 920"', 'height="1020" viewBox="0 0 1200 1020"')
    .replace('<rect width="1200" height="920"', '<rect width="1200" height="1020"')
    .replace("</svg>", `${block}</svg>`);
}

export function integrityLabel(state: MeetingExecutionIntegrity["state"], zh: boolean): string {
  if (state === "verified") return zh ? "已验证" : "Verified";
  if (state === "verified_after_repair") return zh ? "已验证 · 修复后" : "Verified after repair";
  if (state === "degraded") return zh ? "执行覆盖降级" : "Degraded execution coverage";
  if (state === "incomplete") return zh ? "执行链未完整闭环" : "Incomplete execution chain";
  return zh ? "等待执行审计" : "Waiting for execution audit";
}

function integrityBoundary(summary: ConsultationReceiptExecutionIntegrity, zh: boolean): string {
  const synthetic = summary.mode === "synthetic-showcase";
  if (synthetic) {
    return zh
      ? "Synthetic 执行完整性只证明 fixture / UI / 协议流程，不代表真实第三方模型出席。"
      : "Synthetic execution integrity proves fixture/UI/protocol flow only; it is not evidence that live third-party models attended.";
  }
  if (summary.integrity.state === "degraded" || summary.integrity.state === "incomplete") {
    return zh
      ? "立场对齐度必须和这个执行缺口一起阅读；它不是完整 Provider 参与以后形成的共识。"
      : "Stance alignment must be read together with this execution gap; it is not consensus after complete Provider participation.";
  }
  return zh
    ? "执行完整性证明 Provider 执行 provenance，不证明答案正确，也不读取隐藏思维链。"
    : "Execution integrity proves Provider execution provenance, not answer correctness or hidden chain-of-thought.";
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
