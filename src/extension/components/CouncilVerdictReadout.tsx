import { useMemo } from "react";
import type { CouncilEvent, CouncilReport } from "../../core/types.js";
import type { Locale } from "../../i18n/index.js";
import { deriveCouncilVerdictReadout } from "../../consultation/council-verdict-readout.js";
import "./council-verdict-readout.css";

export function CouncilVerdictReadout({
  report,
  events,
  locale,
  archive = false,
}: {
  report: CouncilReport;
  events: readonly CouncilEvent[];
  locale: Locale;
  archive?: boolean;
}) {
  const readout = useMemo(() => deriveCouncilVerdictReadout(report, events), [report, events]);
  const zh = locale === "zh-CN";
  const alignment = Math.round(readout.alignmentRatio * 100);
  const pendingIds = readout.unansweredRequestEventIds.join(",");

  return (
    <section
      className={`council-verdict-readout attention-${readout.attentionState}`}
      data-council-verdict="ready"
      data-council-verdict-archive={String(archive)}
      data-council-verdict-attention={readout.attentionState}
      data-council-verdict-alignment={alignment}
      data-council-verdict-minority-count={readout.minorityCount}
      data-council-verdict-response-pending={readout.responsePending}
      data-council-verdict-response-total={readout.responseTotal}
      data-council-verdict-response-report-match={String(readout.responseReportMatchesCanonical)}
      data-council-verdict-unanswered-ids={pendingIds}
      {...(readout.lastRevision ? { "data-council-verdict-revision-id": readout.lastRevision.revisionEventId } : {})}
    >
      <header className="council-verdict-heading">
        <div>
          <span>{zh ? "协商结果" : "COUNCIL READOUT"}</span>
          <h2>{zh ? "先看这场会真正留下了什么。" : "Read the meeting before the metrics."}</h2>
          <p>{zh
            ? "领先立场只是描述，不是裁决；少数意见、未答质询和明确改口都不会被对齐度盖过去。"
            : "The leading stance is descriptive, not a ruling. Minority views, unanswered requests, and explicit revisions stay visible beside alignment."}</p>
        </div>
        <b className="council-verdict-state">{archive ? (zh ? "历史回放" : "ARCHIVE") : attentionLabel(readout.attentionState, readout.responsePending, zh)}</b>
      </header>

      <div className="council-verdict-hero">
        <span>{zh ? "当前领先立场" : "LEADING FINAL STANCE"}</span>
        <strong>{readout.leadingStance ?? (zh ? "没有单一领先立场" : "No single leading stance")}</strong>
        <small>{zh ? "多数不是权威；这里只复述结构化最终立场。" : "Majority is not authority; this only describes structured final positions."}</small>
      </div>

      <div className="council-verdict-facts">
        <Fact
          label={zh ? "立场对齐" : "ALIGNMENT"}
          value={`${alignment}%`}
          note={zh ? "不是正确率" : "not correctness"}
          kind="alignment"
        />
        <Fact
          label={zh ? "保留少数意见" : "MINORITY"}
          value={String(readout.minorityCount)}
          note={readout.minorityCount
            ? readout.minorityStances.join(" / ")
            : (zh ? "无明确少数最终立场" : "no explicit minority final stance")}
          kind={readout.minorityCount ? "minority" : "quiet"}
        />
        <Fact
          label={zh ? "点名答辩" : "RESPONSE DUTY"}
          value={readout.responseTotal ? `${readout.responseAnswered}/${readout.responseTotal}` : "—"}
          note={readout.responseTotal
            ? (zh ? `${readout.responsePending} 项仍未回应 · 回应 ≠ 同意` : `${readout.responsePending} still pending · response ≠ agreement`)
            : (zh ? "本场无 R2+ 点名答辩义务" : "no R2+ named response duties")}
          kind={readout.responsePending ? "pending" : "quiet"}
        />
        <Fact
          label={zh ? "最近一次明确改口" : "LATEST REVISION"}
          value={readout.lastRevision ? `${readout.lastRevision.actor} · R${readout.lastRevision.round}` : "—"}
          note={readout.lastRevision
            ? `${readout.lastRevision.previousStance} → ${readout.lastRevision.newStance}`
            : (zh ? "没有结构化 revision" : "no structured revision")}
          kind={readout.lastRevision ? "revision" : "quiet"}
        />
      </div>

      {readout.responsePending ? (
        <div className="council-verdict-alert" data-council-verdict-pending="true">
          <div>
            <b>{zh ? `${readout.responsePending} 项点名请求在会议结束时仍未回应` : `${readout.responsePending} named request${readout.responsePending === 1 ? "" : "s"} still unanswered at meeting close`}</b>
            <span>{zh
              ? "这不会让请求者自动获胜；它只意味着会议预算结束前，没有收到合格的结构化回应。"
              : "This does not make the requester correct. It only records that a qualifying structured response was still missing when the meeting ended."}</span>
          </div>
          <code>{readout.unansweredRequestEventIds.slice(0, 3).join(" · ")}{readout.unansweredRequestEventIds.length > 3 ? " · …" : ""}</code>
        </div>
      ) : null}

      {readout.responseReportMatchesCanonical === false ? (
        <div className="council-verdict-integrity-warning" data-council-verdict-ledger-mismatch="true">
          {zh
            ? "答辩账本与最终报告不一致：不要把这张摘要当作完整会议收据，请展开审计。"
            : "Response ledger and final report disagree. Treat this readout as incomplete and open the audit details."}
        </div>
      ) : readout.responseReportMatchesCanonical === null ? (
        <div className="council-verdict-integrity-warning is-legacy" data-council-verdict-ledger-legacy="true">
          {zh
            ? "旧记录缺少最终未答 ID；这里按保存的公开事件重建答辩状态。"
            : "This older record lacks final unanswered IDs; response status is reconstructed from its saved public events."}
        </div>
      ) : null}

      <footer>
        <span>{stopReasonLabel(readout.stopReason, zh)}</span>
        <span>{zh ? "没有议长 AI · 对齐度不是正确率 · 未答质询不是胜负判定" : "No chair AI · Alignment is not correctness · Unanswered is not a win condition"}</span>
      </footer>
    </section>
  );
}

function Fact({
  label,
  value,
  note,
  kind,
}: {
  label: string;
  value: string;
  note: string;
  kind: "alignment" | "minority" | "pending" | "revision" | "quiet";
}) {
  return (
    <article className={`council-verdict-fact is-${kind}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function attentionLabel(
  state: ReturnType<typeof deriveCouncilVerdictReadout>["attentionState"],
  pending: number,
  zh: boolean,
): string {
  if (state === "pending-response") return zh ? `${pending} 项未答质询` : `${pending} unanswered`;
  if (state === "minority-survives") return zh ? "少数意见保留" : "Minority survives";
  if (state === "no-leading-stance") return zh ? "无单一领先" : "No single leader";
  return zh ? "稳定对齐" : "Stable alignment";
}

function stopReasonLabel(reason: CouncilReport["stopReason"], zh: boolean): string {
  if (reason === "round_budget") return zh ? "收束：达到轮次预算" : "Stopped: round budget reached";
  if (reason === "stable_alignment_no_new_signal") return zh ? "收束：立场稳定且无新待回应信号" : "Stopped: stable alignment with no new response signal";
  return zh ? "收束原因：旧记录未提供" : "Stop reason unavailable in this older record";
}
