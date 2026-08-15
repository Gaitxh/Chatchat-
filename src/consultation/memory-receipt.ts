import type { ProviderMemoryCoverageModel } from "../theater/provider-memory-coverage.js";
import type { ProviderMemoryGapModel } from "../theater/provider-memory-gaps.js";
import type { MeetingMemoryIntegrity } from "../theater/meeting-memory-integrity.js";

export interface ProviderMemoryReceiptRound {
  phase: string;
  round: number;
  availableEvents: number;
  selectedEvents: number;
  latestProtectedEvents: number;
  pinnedEvents: number;
  pinnedIssueSources: number;
  ordinaryRecentEvents: number;
  omittedEvents: number;
  actualPromptSeats: number;
  seatCount: number;
  selectorMismatchSeats: number;
  peersSharedSameDeck: boolean;
  knownGapSourceEventIds: string[];
}

export interface ProviderMemoryReceipt {
  sessionId: string | null;
  contextBudget: number;
  protocolState: MeetingMemoryIntegrity["protocolState"];
  evidenceStrength: MeetingMemoryIntegrity["evidenceStrength"];
  auditedTurns: number;
  actualPromptTurns: number;
  pinnedRounds: number;
  selectorMismatchTurns: number;
  peerMismatchRounds: number;
  gapTurns: number;
  uniqueGapSourceEventIds: string[];
  rounds: ProviderMemoryReceiptRound[];
}

export function deriveProviderMemoryReceipt(
  coverage: ProviderMemoryCoverageModel,
  gaps: ProviderMemoryGapModel,
  integrity: MeetingMemoryIntegrity,
): ProviderMemoryReceipt {
  return {
    sessionId: coverage.sessionId,
    contextBudget: coverage.contextBudget,
    protocolState: integrity.protocolState,
    evidenceStrength: integrity.evidenceStrength,
    auditedTurns: integrity.auditedTurns,
    actualPromptTurns: integrity.actualPromptTurns,
    pinnedRounds: integrity.pinnedRounds,
    selectorMismatchTurns: integrity.selectorMismatchTurns,
    peerMismatchRounds: integrity.peerMismatchRounds,
    gapTurns: integrity.gapTurns,
    uniqueGapSourceEventIds: [...integrity.uniqueGapSourceEventIds],
    rounds: coverage.rounds.map((round) => ({
      phase: round.phase,
      round: round.round,
      availableEvents: round.availableCount,
      selectedEvents: round.snapshotCount,
      latestProtectedEvents: round.latestRoundEventIds.length,
      pinnedEvents: round.pinnedEventIds.length,
      pinnedIssueSources: round.pinnedIssueSourceEventIds.length,
      ordinaryRecentEvents: round.ordinaryRecentEventIds.length,
      omittedEvents: round.omittedEventIds.length,
      actualPromptSeats: round.actualPromptSeatCount,
      seatCount: round.seatCount,
      selectorMismatchSeats: round.selectorMismatchSeatCount,
      peersSharedSameDeck: round.snapshotsConsistent,
      knownGapSourceEventIds: gaps.rounds.find((item) => item.phase === round.phase && item.round === round.round)?.uniqueGapSourceEventIds ?? [],
    })),
  };
}

export function providerMemoryReceiptMarkdown(
  receipt: ProviderMemoryReceipt,
  locale: "en" | "zh-CN" = "en",
): string {
  const zh = locale === "zh-CN";
  const lines = [
    `## ${zh ? "公共记忆协议" : "Public memory protocol"}`,
    `- ${zh ? "状态" : "State"}: ${protocolLabel(receipt.protocolState, zh)}`,
    `- ${zh ? "证据强度" : "Evidence strength"}: ${evidenceLabel(receipt.evidenceStrength, zh)}`,
    `- ${zh ? "公共事件 hard cap" : "Public event hard cap"}: ${receipt.contextBudget}`,
    `- ${zh ? "actual Prompt 轮次" : "Actual Prompt turns"}: ${receipt.actualPromptTurns}/${receipt.auditedTurns}`,
    `- ${zh ? "使用旧争议 pin 的轮" : "Rounds using old-conflict pins"}: ${receipt.pinnedRounds}`,
    `- ${zh ? "selector ↔ Prompt mismatch" : "Selector ↔ Prompt mismatches"}: ${receipt.selectorMismatchTurns}`,
    `- ${zh ? "Provider memory fairness mismatch 轮" : "Provider memory fairness mismatch rounds"}: ${receipt.peerMismatchRounds}`,
    `- ${zh ? "已知 coverage-gap source" : "Known coverage-gap sources"}: ${receipt.uniqueGapSourceEventIds.length}`,
  ];

  for (const round of receipt.rounds.slice(-5)) {
    lines.push(
      "",
      `**${round.phase.toUpperCase()} · R${round.round}** — ${round.selectedEvents}/${receipt.contextBudget} ${zh ? "已选" : "selected"} · ${round.availableEvents} ${zh ? "可用" : "available"} · 📌 ${round.pinnedEvents} · ⌁ ${round.omittedEvents} · ${round.actualPromptSeats}/${round.seatCount} ${zh ? "Prompt 票据" : "Prompt proof"}${round.knownGapSourceEventIds.length ? ` · ⚠ ${round.knownGapSourceEventIds.length} ${zh ? "未决 gap" : "unresolved gaps"}` : ""}`,
    );
  }

  if (receipt.uniqueGapSourceEventIds.length) {
    lines.push(
      "",
      `**${zh ? "Coverage gap source event IDs" : "Coverage-gap source event IDs"}:** ${receipt.uniqueGapSourceEventIds.join(", ")}`,
    );
  }

  lines.push(
    "",
    zh
      ? "_Memory pin 只是公共上下文覆盖优先级，不代表权威、真理或答案正确。actual Prompt proof 只证明 ChatChat 发出了哪些公共 event IDs，不证明模型内部怎样思考。_"
      : "_Memory pinning is public-context coverage priority only, not authority, truth or answer correctness. Actual Prompt proof establishes which public event IDs ChatChat sent, not how a model reasoned internally._",
  );
  return lines.join("\n");
}

function protocolLabel(state: MeetingMemoryIntegrity["protocolState"], zh: boolean): string {
  if (state === "verified") return zh ? "已验证" : "Verified";
  if (state === "bounded_coverage") return zh ? "有界覆盖限制" : "Bounded coverage";
  if (state === "selector_drift") return zh ? "selector 与实际 Prompt 漂移" : "Selector drift";
  return zh ? "同轮 Provider 公共记忆公平性违例" : "Peer memory fairness violation";
}

function evidenceLabel(strength: MeetingMemoryIntegrity["evidenceStrength"], zh: boolean): string {
  if (strength === "actual_prompt") return "actual_prompt";
  if (strength === "mixed") return "mixed";
  if (strength === "selector_audit") return zh ? "selector_audit（旧记录）" : "selector_audit (legacy)";
  return zh ? "无可审计轮次" : "none";
}
