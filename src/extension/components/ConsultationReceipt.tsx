import { useMemo, useState } from "react";
import type { CouncilEvent, CouncilReport } from "../../core/types.js";
import type { EvidenceVerificationSnapshot } from "../../evidence/evidence-ledger.js";
import type { Locale } from "../../i18n/index.js";
import {
  consultationReceiptSvg,
  deriveConsultationReceipt,
} from "../../consultation/receipt.js";
import { safeConsultationReceiptMarkdown } from "../../consultation/receipt-share.js";
import "./consultation-receipt.css";

interface ConsultationReceiptProps {
  report: CouncilReport;
  events: readonly CouncilEvent[];
  verifications?: Readonly<Record<string, EvidenceVerificationSnapshot>>;
  locale: Locale;
  archive?: boolean;
}

export function ConsultationReceiptCard({
  report,
  events,
  verifications = {},
  locale,
  archive = false,
}: ConsultationReceiptProps) {
  const receipt = useMemo(
    () => deriveConsultationReceipt(report, events, verifications),
    [report, events, verifications],
  );
  const [copied, setCopied] = useState(false);
  const zh = locale === "zh-CN";
  const modeLabel = zh ? receipt.modeLabelZhCN : receipt.modeLabelEn;

  async function copyMarkdown() {
    const markdown = safeConsultationReceiptMarkdown(receipt, locale);
    const ok = await copyText(markdown);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function exportSvg() {
    const svg = consultationReceiptSvg(receipt, locale);
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
            ? "只使用本地结构化事件与证据快照生成。分享前请检查提案摘要；不会自动上传任何内容。"
            : "Generated only from local structured events and evidence snapshots. Review the proposal preview before sharing; nothing is uploaded automatically."}</p>
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
          ? "没有议长 AI · 多数不是权威 · 来源可达不等于主张为真 · 本地回放"
          : "No chair AI · Majority is not authority · Reachable is not proof · Local replay"}</footer>
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

function evidenceState(state: string, zh: boolean): string {
  if (state === "reachable") return zh ? "来源可达" : "REACHABLE";
  if (state === "unavailable") return zh ? "无法访问" : "UNAVAILABLE";
  if (state === "unsupported") return zh ? "无安全链接" : "NO SAFE URL";
  return zh ? "尚未检查" : "NOT CHECKED";
}

function safeFilePart(value: string): string {
  return value.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "consultation";
}
