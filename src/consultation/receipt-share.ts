import type { ConsultationReceipt } from "./receipt.js";
import { consultationReceiptMarkdown } from "./receipt.js";
import {
  consultationReceiptIntegrityMarkdown,
  type ConsultationReceiptExecutionIntegrity,
} from "./receipt-integrity.js";

export function safeConsultationReceiptMarkdown(
  receipt: ConsultationReceipt,
  locale: "en" | "zh-CN" = "en",
  executionIntegrity?: ConsultationReceiptExecutionIntegrity,
): string {
  const base = consultationReceiptMarkdown(receipt, locale);
  const withIntegrity = executionIntegrity
    ? `${base}${consultationReceiptIntegrityMarkdown(executionIntegrity, locale)}`
    : base;
  return escapeHtmlText(withIntegrity);
}

function escapeHtmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
