import type { ProviderExecutionMode } from "../provider-sdk/transport-audit.js";
import type { MeetingExecutionIntegrity } from "../theater/meeting-integrity.js";

export interface ConsultationReceiptExecutionIntegrity {
  mode: ProviderExecutionMode | "unknown";
  integrity: MeetingExecutionIntegrity;
}

export function legacyConsultationReceiptExecutionIntegrity(): ConsultationReceiptExecutionIntegrity {
  return {
    mode: "unknown",
    integrity: {
      state: "waiting",
      totalTurns: 0,
      verifiedTurns: 0,
      repairedTurns: 0,
      fallbackTurns: 0,
      failedTurns: 0,
      unresolvedTurns: 0,
      totalSeats: 0,
      fullyVerifiedSeats: 0,
    },
  };
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
      : (zh ? "旧记录 / 无执行票据" : "Legacy / no execution receipt");
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
  const geometry = svgGeometry(baseSvg);
  const zh = locale === "zh-CN";
  const { integrity, mode } = summary;
  const modeLabel = mode === "live-provider-tabs"
    ? "LIVE PROVIDER"
    : mode === "synthetic-showcase"
      ? "DEMO · SYNTHETIC"
      : "LEGACY / NO RECEIPT";
  const title = zh ? "会议执行完整性" : "MEETING EXECUTION INTEGRITY";
  const state = integrityLabel(integrity.state, zh);
  const note = integritySvgBoundary(summary, zh);
  const extraHeight = 146;
  const newHeight = geometry.height + extraHeight;
  const blockY = geometry.height + 18;
  const blockWidth = Math.max(0, geometry.width - 100);
  const block = [
    `<g transform="translate(50 ${blockY})" font-family="ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans CJK SC',sans-serif">`,
    `<rect width="${blockWidth}" height="108" rx="20" fill="#eef6f3" stroke="#d6e5df"/>`,
    `<text x="24" y="28" fill="#52746b" font-size="12" font-weight="800" letter-spacing="1.1">${escapeXml(title)}</text>`,
    `<text x="24" y="55" fill="#183c35" font-size="18" font-weight="760">${escapeXml(`${integrity.verifiedTurns}/${integrity.totalTurns} ${zh ? "轮已验证" : "turns verified"} · ${state}`)}</text>`,
    `<text x="24" y="78" fill="#6f817c" font-size="12">${escapeXml(`${modeLabel} · ${integrity.fullyVerifiedSeats}/${integrity.totalSeats} ${zh ? "席位完整" : "seats complete"} · ↺ ${integrity.repairedTurns} · fallback ${integrity.fallbackTurns} · failed ${integrity.failedTurns}`)}</text>`,
    `<text x="24" y="98" fill="#7c8985" font-size="10">${escapeXml(note)}</text>`,
    "</g>",
  ].join("");

  const expanded = baseSvg
    .replace(
      geometry.rootSizeFragment,
      `width="${geometry.width}" height="${newHeight}" viewBox="0 0 ${geometry.width} ${newHeight}"`,
    )
    .replace(
      geometry.backgroundFragment,
      `<rect width="${geometry.width}" height="${newHeight}"`,
    );
  return expanded.replace("</svg>", `${block}</svg>`);
}

export function integrityLabel(state: MeetingExecutionIntegrity["state"], zh: boolean): string {
  if (state === "verified") return zh ? "已验证" : "Verified";
  if (state === "verified_after_repair") return zh ? "已验证 · 修复后" : "Verified after repair";
  if (state === "degraded") return zh ? "执行覆盖降级" : "Degraded execution coverage";
  if (state === "incomplete") return zh ? "执行链未完整闭环" : "Incomplete execution chain";
  return zh ? "旧记录 / 无执行审计" : "Legacy / no execution audit";
}

function integrityBoundary(summary: ConsultationReceiptExecutionIntegrity, zh: boolean): string {
  if (summary.mode === "synthetic-showcase") {
    return zh
      ? "Synthetic 执行完整性只证明 fixture / UI / 协议流程；它不是第三方 AI 真实出席的证据。"
      : "Synthetic execution integrity proves fixture/UI/protocol flow only; it is not evidence that live third-party models attended.";
  }
  if (summary.mode === "unknown") {
    return zh
      ? "这条旧记录没有 durable execution receipt；ChatChat 不会事后猜测当时的 Provider 执行完整性。"
      : "This legacy archive has no durable execution receipt; ChatChat will not reconstruct Provider execution integrity after the fact.";
  }
  if (summary.integrity.state === "degraded" || summary.integrity.state === "incomplete") {
    return zh
      ? "立场对齐度必须和这个执行缺口一起阅读；它不是所有 Provider 完整参与后的共识。"
      : "Stance alignment must be read together with this execution gap; it is not consensus after complete Provider participation.";
  }
  return zh
    ? "执行完整性证明 Provider 执行 provenance，不证明答案正确，也不读取隐藏思维链。"
    : "Execution integrity proves Provider execution provenance, not answer correctness or hidden chain-of-thought.";
}

function integritySvgBoundary(summary: ConsultationReceiptExecutionIntegrity, zh: boolean): string {
  if (summary.mode === "synthetic-showcase") {
    return zh ? "Synthetic 只证明演示执行链，不代表真实第三方 AI 出席。" : "Synthetic proves demo execution only, not live third-party attendance.";
  }
  if (summary.mode === "unknown") {
    return zh ? "旧记录没有 durable execution receipt；不会事后补写执行完整性。" : "Legacy archive has no durable execution receipt; no post-hoc integrity claim.";
  }
  if (summary.integrity.state === "degraded" || summary.integrity.state === "incomplete") {
    return zh ? "对齐度必须和执行缺口一起阅读；不是完整 Provider 参与后的共识。" : "Read alignment with the execution gap; this is not full-Provider consensus.";
  }
  return zh ? "执行 provenance，不代表答案正确，也不读取隐藏思维。" : "Execution provenance, not answer correctness or hidden reasoning.";
}

function svgGeometry(svg: string): {
  width: number;
  height: number;
  rootSizeFragment: string;
  backgroundFragment: string;
} {
  const root = svg.match(/width="(\d+)" height="(\d+)" viewBox="0 0 (\d+) (\d+)"/);
  if (!root?.[1] || !root[2] || !root[3] || !root[4]) {
    throw new Error("Consultation Receipt SVG has an unsupported root geometry.");
  }
  const width = Number(root[1]);
  const height = Number(root[2]);
  const viewWidth = Number(root[3]);
  const viewHeight = Number(root[4]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width !== viewWidth || height !== viewHeight) {
    throw new Error("Consultation Receipt SVG width/height must match its viewBox before integrity can be appended.");
  }
  const backgroundFragment = `<rect width="${width}" height="${height}"`;
  if (!svg.includes(backgroundFragment)) {
    throw new Error("Consultation Receipt SVG background geometry could not be located.");
  }
  return {
    width,
    height,
    rootSizeFragment: root[0],
    backgroundFragment,
  };
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
