import { useMemo, useState } from "react";
import type { CouncilEvent, CouncilReport } from "../../core/types.js";
import type { EvidenceVerificationSnapshot } from "../../evidence/evidence-ledger.js";
import type { Locale } from "../../i18n/index.js";
import {
  consultationReceiptSvgWithIntegrity,
  integrityLabel,
  type ConsultationReceiptExecutionIntegrity,
} from "../../consultation/receipt-integrity.js";
import {
  consultationReceiptSvg,
  deriveConsultationReceipt,
} from "../../consultation/receipt.js";
import { safeConsultationReceiptMarkdown } from "../../consultation/receipt-share.js";
import {
  deriveResponseObligationSummary,
  responseObligationsSvgBadge,
  safeResponseObligationsMarkdown,
} from "../../consultation/response-obligation-summary.js";
import { ResponseObligations } from "./ResponseObligations.js";
import "./consultation-receipt.css";

interface ConsultationReceiptProps {
  report: CouncilReport;
  events: readonly CouncilEvent[];
  verifications?: Readonly<Record<string, EvidenceVerificationSnapshot>>;
  executionIntegrity?: ConsultationReceiptExecutionIntegrity;
  locale: Locale;
  archive?: boolean;
}

export function ConsultationReceiptCard({
  report,
  events,
  verifications = {},
  executionIntegrity,
  locale,
  archive = false,
}: ConsultationReceiptProps) {
  const receipt = useMemo(
    () => deriveConsultationReceipt(report, events, verifications),
    [report, events, verifications],
  );
  const responseObligations = useMemo(
    () => deriveResponseObligationSummary(report, events),
    [report, events],
  );
  const [copied, setCopied] = useState(false);
  const zh = locale === "zh-CN";
  const modeLabel = zh ? receipt.modeLabelZhCN : receipt.modeLabelEn;

  async function copyMarkdown() {
    const markdown = `${safeConsultationReceiptMarkdown(receipt, locale, executionIntegrity)}${safeResponseObligationsMarkdown(responseObligations, locale)}`;
    const ok = await copyText(markdown);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function exportSvg() {
    const baseSvg = consultationReceiptSvg(receipt, locale);
    const withResponses = responseObligationsSvgBadge(baseSvg, responseObligations, locale);
    const svg = executionIntegrity
      ? consultationReceiptSvgWithIntegrity(withResponses, executionIntegrity, locale)
      : withResponses;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `chatchat-receipt-${safeFilePart(receipt.sessionId)}.svg`;
    anchor.style.display = "none";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  return (
    <section className="consultation-receipt">
      <header className="receipt-heading">
        <div>
          <span>{zh ? "协商收据" : "CONSULTATION RECEIPT"}</span>
          <h3>{zh ? "把这场会，压成一张能分享的卡。" : "Turn the meeting into one shareable receipt."}</h3>
          <p>{zh
            ? "只使用本地结构化事件、证据快照和可用的执行审计生成。分享前请检查提案摘要；不会自动上传任何内容。"
            : "Generated only from local structured events, evidence snapshots, and available execution audit data. Review the proposal preview before sharing; nothing is uploaded automatically."}</p>
        </div>
        <b>{archive ? (zh ? "历史快照" : "ARCHIVE") : `${receipt.modeIcon} ${modeLabel}`}</b>
      </header>

      <article className="receipt-card-preview">
        <div className="receipt-brand"><strong>ChatChat</strong><span>{receipt.modeIcon} {modeLabel}</span></div>
        <blockquote>{receipt.proposalPreview}</blockquote>
        <div className="receipt-outcome">
          <span>{zh ? "协商结果" : "OUTCOME"}</span>
          <strong>{receipt.outcome}</strong>
          <em>{Math.round(receipt.consensusRatio * 100)}%</em>
        </div>
        <div className="receipt-stats">
          <span><b>{receipt.participantNames.length}</b>{zh ? "位 AI" : "AIs"}</span>
          <span><b>{receipt.rounds}</b>{zh ? "轮" : "rounds"}</span>
          <span><b>⚔ {receipt.challengeCount}</b>{zh ? "质疑" : "challenges"}</span>
          <span><b>📎 {receipt.evidenceCount}</b>{zh ? "证据" : "evidence"}</span>
          <span><b>↻ {receipt.revisionCount}</b>{zh ? "改口" : "revisions"}</span>
        </div>

        {executionIntegrity ? (
          <div
            className={`receipt-integrity state-${executionIntegrity.integrity.state}`}
            data-receipt-execution-integrity={executionIntegrity.integrity.state}
            data-receipt-execution-mode={executionIntegrity.mode}
          >
            <span>{zh ? "会议执行完整性" : "MEETING EXECUTION INTEGRITY"}</span>
            <strong>
              <b>{executionIntegrity.integrity.verifiedTurns}/{executionIntegrity.integrity.totalTurns}</b>
              <span>{zh ? "轮已验证" : "turns verified"} · {integrityLabel(executionIntegrity.integrity.state, zh)}</span>
            </strong>
            <small>
              {executionIntegrity.integrity.fullyVerifiedSeats}/{executionIntegrity.integrity.totalSeats} {zh ? "席位完整" : "seats complete"}
              {` · ↺ ${executionIntegrity.integrity.repairedTurns}`}
              {` · fallback ${executionIntegrity.integrity.fallbackTurns}`}
              {` · failed ${executionIntegrity.integrity.failedTurns}`}
            </small>
            <em>{receiptIntegrityNote(executionIntegrity, zh)}</em>
          </div>
        ) : null}

        {receipt.stopReason ? (
          <div className="receipt-turn receipt-stop-reason">
            <span>{zh ? "为什么停止" : "WHY IT STOPPED"}</span>
            <strong>{stopReasonLabel(receipt.stopReason, zh)}</strong>
          </div>
        ) : null}

        <ResponseObligations summary={responseObligations} locale={locale} />

        {receipt.keyTurn ? (
          <div className="receipt-turn">
            <span>{zh ? "关键转折" : "KEY TURN"}</span>
            <strong>{receipt.keyTurn.fromActor} → {receipt.keyTurn.toActor}</strong>
            <small>{receipt.keyTurn.previousStance} → {receipt.keyTurn.newStance} · {receipt.keyTurn.causeKind}</small>
          </div>
        ) : null}

        {receipt.evidence ? (
          <div className="receipt-evidence">
            <span>{zh ? "证据" : "EVIDENCE"}</span>
            <strong>{receipt.evidence.sourceHost ?? receipt.evidence.actor}</strong>
            <small>
              {evidenceState(receipt.evidence.sourceState, zh)}
              {receipt.evidence.disputed ? ` · ${zh ? "存在质疑" : "DISPUTED"}` : ""}
              {receipt.evidence.changedMind ? ` · ${zh ? "触发改口" : "CHANGED A VIEW"}` : ""}
            </small>
          </div>
        ) : null}

        {receipt.minorityCount ? (
          <div className="receipt-minority">🧍 {zh ? "少数意见保留" : "Minority survives"}: {receipt.minorityStances.join(" / ")}</div>
        ) : null}

        <footer>{zh
          ? "没有议长 AI · 多数不是权威 · 对齐度不是正确率 · 本地回放"
          : "No chair AI · Majority is not authority · Alignment is not correctness · Local replay"}</footer>
      </article>

      <div className="receipt-actions">
        <button type="button" className="receipt-primary" onClick={() => void copyMarkdown()}>
          {copied ? (zh ? "✓ 已复制 Markdown" : "✓ Markdown copied") : (zh ? "复制 Markdown" : "Copy Markdown")}
        </button>
        <button type="button" onClick={exportSvg}>{zh ? "导出 SVG" : "Export SVG"}</button>
      </div>
    </section>
  );
}

function receiptIntegrityNote(summary: ConsultationReceiptExecutionIntegrity, zh: boolean): string {
  if (summary.mode === "synthetic-showcase") {
    return zh ? "DEMO · SYNTHETIC；不是第三方 AI 真实出席证明。" : "DEMO · SYNTHETIC; not proof of live third-party attendance.";
  }
  if (summary.mode === "unknown") {
    return zh ? "旧记录没有 durable execution receipt；不会事后补写执行完整性。" : "Legacy archive has no durable execution receipt; no post-hoc integrity claim.";
  }
  if (summary.integrity.state === "degraded" || summary.integrity.state === "incomplete") {
    return zh ? "对齐度必须和执行缺口一起阅读。" : "Read alignment together with the execution gap.";
  }
  return zh ? "执行 provenance，不是答案正确率。" : "Execution provenance, not answer correctness.";
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    textarea.remove();
    return ok;
  }
}

function stopReasonLabel(reason: NonNullable<CouncilReport["stopReason"]>, zh: boolean): string {
  if (reason === "round_budget") {
    return zh
      ? "达到本模式轮次预算；仍可能保留未决分歧。"
      : "Round budget reached; unresolved disagreement may remain.";
  }
  return zh
    ? "立场已稳定，上一批没有新的待回应信号。"
    : "Alignment stabilized with no new signal requiring peer follow-up.";
}

function evidenceState(state: string, zh: boolean): string {
  if (state === "reachable") return zh ? "来源可达" : "REACHABLE";
  if (state === "unavailable") return zh ? "无法访问" : "UNAVAILABLE";
  if (state === "unsupported") return zh ? "无安全链接" : "NO SAFE URL";
  return zh ? "尚未检查" : "NOT CHECKED";
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "consultation";
}
