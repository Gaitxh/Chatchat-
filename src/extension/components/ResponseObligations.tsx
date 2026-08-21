import type { Locale } from "../../i18n/index.js";
import type {
  ResponseObligationItem,
  ResponseObligationSummary,
} from "../../consultation/response-obligation-summary.js";
import "./response-obligations.css";

export function ResponseObligations({
  summary,
  locale,
}: {
  summary: ResponseObligationSummary;
  locale: Locale;
}) {
  if (!summary.total) return null;
  const zh = locale === "zh-CN";
  return (
    <section
      className={`receipt-response-obligations ${summary.pending ? "has-pending" : "is-complete"}`}
      data-response-obligations="present"
      data-response-obligations-total={summary.total}
      data-response-obligations-answered={summary.answered}
      data-response-obligations-pending={summary.pending}
      data-response-obligations-report-match={summary.reportMatchesCanonical === null ? "legacy" : summary.reportMatchesCanonical ? "true" : "false"}
    >
      <header>
        <div>
          <span>{zh ? "答辩收据" : "RESPONSE OBLIGATIONS"}</span>
          <strong>{zh ? "点名质询，必须留下回应痕迹。" : "Named requests leave an answer receipt."}</strong>
        </div>
        <b>{summary.answered}/{summary.total}</b>
      </header>
      <div className="response-obligation-meter" aria-hidden="true">
        <i style={{ width: `${Math.round((summary.answered / summary.total) * 100)}%` }} />
      </div>
      <div className="response-obligation-list">
        {summary.items.map((item) => (
          <ResponseObligationRow key={item.requestEventId} item={item} locale={locale} />
        ))}
      </div>
      {summary.reportMatchesCanonical === false ? (
        <p className="response-obligation-integrity-warning">
          {zh
            ? "⚠ 最终报告的未答 ID 与 canonical 答辩账本不一致；请把本次结果视为需要审计。"
            : "⚠ Final-report unanswered IDs do not match the canonical response ledger; treat this result as requiring audit."}
        </p>
      ) : null}
      <footer>
        {zh
          ? "回应义务 ≠ 同意义务。有效答辩、修正、让步或反证都可以完成回应；多数立场不能替任何 AI 代答。"
          : "Response duty ≠ agreement duty. A valid defense, revision, concession, or counter-evidence can close the receipt; a majority cannot answer for another AI."}
      </footer>
    </section>
  );
}

function ResponseObligationRow({ item, locale }: { item: ResponseObligationItem; locale: Locale }) {
  const zh = locale === "zh-CN";
  const answered = item.status === "answered";
  return (
    <article
      className={`response-obligation-item is-${item.status}`}
      data-response-obligation-status={item.status}
      data-request-event-id={item.requestEventId}
      {...(item.responseEventId ? { "data-response-event-id": item.responseEventId } : {})}
    >
      <div className="response-obligation-route">
        <span className="response-obligation-state">{answered ? "✓" : "◌"}</span>
        <div>
          <strong>{item.fromActor} → {item.targetActor}</strong>
          <small>{requestLabel(item.requestKind, zh)} · R{item.requestRound}</small>
        </div>
        <b>{answered ? (zh ? "已回应" : "ANSWERED") : (zh ? "未回应" : "PENDING")}</b>
      </div>
      {item.requestPreview ? <p>{item.requestPreview}</p> : null}
      <div className="response-obligation-proof">
        <code>{item.requestEventId}</code>
        {answered ? (
          <span>
            → {responseLabel(item.responseKind, zh)} R{item.responseRound ?? "?"}
            {item.responseEventId ? <code>{item.responseEventId}</code> : null}
          </span>
        ) : (
          <span>{zh ? "会议结束时仍无结构化回应" : "No structured response before the meeting ended"}</span>
        )}
      </div>
    </article>
  );
}

function requestLabel(kind: ResponseObligationItem["requestKind"], zh: boolean): string {
  if (kind === "question") return zh ? "追问" : "Question";
  if (kind === "challenge") return zh ? "质询" : "Challenge";
  return zh ? "定向证据" : "Targeted evidence";
}

function responseLabel(kind: ResponseObligationItem["responseKind"], zh: boolean): string {
  if (!kind) return zh ? "回应" : "Response";
  const labels = zh
    ? {
        argument: "立场",
        challenge: "质询",
        evidence: "证据",
        support: "支持",
        defense: "答辩",
        revision: "修正",
        concede: "让步",
        question: "追问",
        uncertain: "不确定",
        final_position: "最终立场",
      }
    : {
        argument: "Argument",
        challenge: "Challenge",
        evidence: "Evidence",
        support: "Support",
        defense: "Defense",
        revision: "Revision",
        concede: "Concede",
        question: "Question",
        uncertain: "Uncertain",
        final_position: "Final position",
      };
  return labels[kind];
}
