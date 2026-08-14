import type { ConsultationReceipt } from "./receipt.js";
import { consultationReceiptMarkdown } from "./receipt.js";

export function safeConsultationReceiptMarkdown(
  receipt: ConsultationReceipt,
  locale: "en" | "zh-CN" = "en",
): string {
  return escapeHtmlText(consultationReceiptMarkdown(receipt, locale));
}

function escapeHtmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
