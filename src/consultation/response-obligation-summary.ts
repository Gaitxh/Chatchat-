import type { CouncilEvent, CouncilEventKind, CouncilReport } from "../core/types.js";
import { deriveDirectResponseReceipts } from "./direct-response-receipts.js";

const FIRST_PUBLIC_DEBATE_ROUND = 2;

export interface ResponseObligationItem {
  requestEventId: string;
  requestKind: "question" | "challenge" | "evidence";
  requestRound: number;
  fromActor: string;
  targetActor: string;
  requestPreview: string;
  status: "pending" | "answered";
  responseEventId?: string;
  responseKind?: CouncilEventKind;
  responseRound?: number;
}

export interface ResponseObligationSummary {
  total: number;
  answered: number;
  pending: number;
  items: ResponseObligationItem[];
  unansweredEventIds: string[];
  /** Null means canonical public pending debt exists but the report predates/omits final unanswered-id transparency. */
  reportMatchesCanonical: boolean | null;
}

/**
 * Final user-facing view of named peer response duties from the public debate.
 *
 * Closure is delegated completely to deriveDirectResponseReceipts(), which in
 * turn delegates to Open Issues' exact structural resolver. Like the Provider
 * inbox and final CouncilReport, sealed round-one material cannot create a later
 * public response debt. This layer only adds display names, response event kind,
 * and bounded request preview text. It never infers an answer from prose, stance
 * alignment, confidence, or majority support.
 */
export function deriveResponseObligationSummary(
  report: CouncilReport,
  events: readonly CouncilEvent[],
): ResponseObligationSummary {
  const nameById = new Map(report.positions.map((position) => [position.participant.id, position.participant.name] as const));
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const receipts = deriveDirectResponseReceipts(events)
    .filter((receipt) => receipt.requestRound >= FIRST_PUBLIC_DEBATE_ROUND);
  const items = receipts.map((receipt): ResponseObligationItem => {
    const request = eventById.get(receipt.requestEventId);
    const response = receipt.responseEventId ? eventById.get(receipt.responseEventId) : undefined;
    return {
      requestEventId: receipt.requestEventId,
      requestKind: receipt.requestKind,
      requestRound: receipt.requestRound,
      fromActor: nameById.get(receipt.fromActorId) ?? receipt.fromActorId,
      targetActor: nameById.get(receipt.targetActorId) ?? receipt.targetActorId,
      requestPreview: compact(request?.content ?? "", 150),
      status: receipt.status,
      ...(receipt.responseEventId ? { responseEventId: receipt.responseEventId } : {}),
      ...(response ? { responseKind: response.kind } : {}),
      ...(receipt.responseRound ? { responseRound: receipt.responseRound } : {}),
    };
  });
  const unansweredEventIds = items
    .filter((item) => item.status === "pending")
    .map((item) => item.requestEventId);
  const reportPending = report.unansweredDirectRequestEventIds;

  return {
    total: items.length,
    answered: items.filter((item) => item.status === "answered").length,
    pending: unansweredEventIds.length,
    items,
    unansweredEventIds,
    reportMatchesCanonical: reportPending
      ? sameIdSet(reportPending, unansweredEventIds)
      : unansweredEventIds.length
        ? null
        : true,
  };
}

export function safeResponseObligationsMarkdown(
  summary: ResponseObligationSummary,
  locale: "en" | "zh-CN" = "en",
): string {
  if (!summary.total) return "";
  const zh = locale === "zh-CN";
  const lines = [
    "",
    "",
    `## ${zh ? "答辩收据" : "Response obligations"}`,
    `${summary.answered}/${summary.total} ${zh ? "项已回应" : "answered"} · ${summary.pending} ${zh ? "项未回应" : "pending"}`,
    "",
  ];

  for (const item of summary.items) {
    const request = `${safeText(item.fromActor)} → ${safeText(item.targetActor)} · ${requestKindLabel(item.requestKind, zh)} R${item.requestRound}`;
    if (item.status === "answered") {
      lines.push(
        `- ✓ ${request} → ${responseKindLabel(item.responseKind, zh)} R${item.responseRound ?? "?"} · request \`${safeText(item.requestEventId)}\`${item.responseEventId ? ` · response \`${safeText(item.responseEventId)}\`` : ""}`,
      );
    } else {
      lines.push(
        `- ◌ ${request} → ${zh ? "会议结束时仍未回应" : "unanswered when the meeting ended"} · request \`${safeText(item.requestEventId)}\``,
      );
    }
  }

  lines.push(
    "",
    zh
      ? "_答辩收据证明点名请求得到了结构化注意，或明确记录它尚未得到回应；它不证明请求者正确，也不要求被点名者同意。_"
      : "_A response receipt proves structured attention, or records that it is still missing. It does not prove the requester was correct and never requires agreement._",
  );
  return lines.join("\n");
}

export function responseObligationsSvgBadge(
  baseSvg: string,
  summary: ResponseObligationSummary,
  locale: "en" | "zh-CN" = "en",
): string {
  if (!summary.total) return baseSvg;
  const zh = locale === "zh-CN";
  const label = zh
    ? `答辩 ${summary.answered}/${summary.total} 已回应 · ${summary.pending} 未回应`
    : `Responses ${summary.answered}/${summary.total} answered · ${summary.pending} pending`;
  const pending = summary.unansweredEventIds.length
    ? `${zh ? "未答" : "pending"}: ${summary.unansweredEventIds.slice(0, 2).join(", ")}${summary.unansweredEventIds.length > 2 ? "…" : ""}`
    : (zh ? "所有点名请求均有结构化回应" : "All named requests have a structured response");
  const badge = `<g data-response-obligations-svg="true">
<rect x="600" y="558" width="550" height="26" rx="10" fill="${summary.pending ? "#fff2e3" : "#eef5ec"}" stroke="${summary.pending ? "#ecd1ae" : "#d5e4d1"}"/>
<text x="616" y="574" fill="${summary.pending ? "#8b5b2e" : "#496648"}" font-size="10" font-weight="740">${escapeXml(label)}</text>
<text x="1134" y="574" fill="#8f887e" text-anchor="end" font-size="8">${escapeXml(pending)}</text>
</g>`;
  return baseSvg.replace("</g></svg>", `${badge}</g></svg>`);
}

function requestKindLabel(kind: ResponseObligationItem["requestKind"], zh: boolean): string {
  if (kind === "question") return zh ? "追问" : "question";
  if (kind === "challenge") return zh ? "质询" : "challenge";
  return zh ? "定向证据" : "targeted evidence";
}

function responseKindLabel(kind: CouncilEventKind | undefined, zh: boolean): string {
  if (!kind) return zh ? "结构化回应" : "response";
  const en: Record<CouncilEventKind, string> = {
    argument: "argument",
    challenge: "challenge",
    evidence: "evidence",
    support: "support",
    defense: "defense",
    revision: "revision",
    concede: "concede",
    question: "question",
    uncertain: "uncertain",
    final_position: "final position",
  };
  const zhCN: Record<CouncilEventKind, string> = {
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
  };
  return zh ? zhCN[kind] : en[kind];
}

function sameIdSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((id) => rightSet.has(id));
}

function compact(value: string, max: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
}

function safeText(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("`", "'");
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
