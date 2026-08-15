import { useMemo, useState } from "react";
import type { CouncilReport } from "../../core/types.js";
import type { Locale } from "../../i18n/index.js";
import {
  deriveFinalCoveragePlan,
  finalCoverageRecoveryBrief,
  type FinalCoverageGap,
} from "../../theater/final-coverage-gaps.js";
import type { FinalPositionFloorModel } from "../../theater/final-position-floor.js";
import { focusConsultationEvent } from "../provenance-wire.js";
import "./final-coverage-gaps.css";

interface FinalCoverageGapsProps {
  report: CouncilReport;
  floor: FinalPositionFloorModel;
  locale: Locale;
  archive?: boolean;
  synthetic?: boolean;
}

export function FinalCoverageGaps({
  report,
  floor,
  locale,
  archive = false,
  synthetic = false,
}: FinalCoverageGapsProps) {
  const zh = locale === "zh-CN";
  const plan = useMemo(() => deriveFinalCoveragePlan(report, floor), [report, floor]);
  const recoveryBrief = useMemo(() => finalCoverageRecoveryBrief(report, plan), [report, plan]);
  const [copied, setCopied] = useState(false);
  const execution = plan.gaps.filter((gap) => gap.class === "execution");
  const provenance = plan.gaps.filter((gap) => gap.class === "provenance");

  async function copyPlan() {
    const ok = await copyText(recoveryBrief);
    if (!ok) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section
      className={`final-coverage-gaps ${plan.complete ? "is-complete" : "has-gaps"} ${archive ? "is-archive" : ""}`}
      data-final-coverage-plan={plan.complete ? "complete" : "gaps"}
      data-final-coverage-session={plan.sessionId}
      data-final-coverage-gap-count={plan.gaps.length}
      data-final-coverage-execution-gap-count={plan.executionGapCount}
      data-final-coverage-provenance-gap-count={plan.provenanceGapCount}
      data-final-coverage-immutable="true"
    >
      <header className="final-coverage-gaps__header">
        <div>
          <span>{zh ? "最终席位覆盖" : "FINAL SEAT COVERAGE"}</span>
          <h3>{plan.complete
            ? (zh ? "所有 Final 席位都有完整来源" : "Every Final seat has complete provenance")
            : (zh ? "哪些 Final 还需要恢复或解释？" : "Which Finals still need recovery or clarification?")}</h3>
          <p>{zh
            ? "这张清单只读取 Final Position Floor 与 execution provenance。它不会修改已经完成的会议，也不会自动调用任何 Provider。执行缺口和“无 revision 的 verified Final 变化”会被分开处理。"
            : "This checklist reads only Final Position Floor + execution provenance. It never mutates the completed meeting and never calls a Provider automatically. Execution gaps stay separate from verified Final shifts that lack revision receipts."}</p>
        </div>
        <div className="final-coverage-gaps__counts">
          <b>{plan.executionGapCount}<small>{zh ? "执行缺口" : "execution"}</small></b>
          <b>{plan.provenanceGapCount}<small>{zh ? "解释缺口" : "provenance"}</small></b>
        </div>
      </header>

      {synthetic ? (
        <div className="final-coverage-gaps__synthetic" data-final-coverage-synthetic="true">
          <b>DEMO · SYNTHETIC</b>
          <span>{zh ? "这里证明恢复计划的 UI / 事件语义，不代表第三方 AI 真实失败或需要恢复。" : "This proves recovery-plan UI/event semantics, not that a live third-party model actually failed or needs recovery."}</span>
        </div>
      ) : null}

      {plan.complete ? (
        <div className="final-coverage-gaps__complete" data-final-coverage-complete="true">
          <b>✓</b>
          <span>{zh ? "没有 derived Final coverage debt。对齐度依然不是正确率。" : "No derived Final coverage debt remains. Alignment is still not an answer-correctness score."}</span>
        </div>
      ) : (
        <>
          {execution.length ? (
            <CoverageGroup
              title={zh ? "执行恢复候选" : "EXECUTION RECOVERY CANDIDATES"}
              body={zh
                ? "这些席位的 Final 没有完成可信 Provider 执行链。未来 targeted recovery 必须只重跑这些席位，并使用原会议冻结的 Final public snapshot。"
                : "These Final seats did not close a trustworthy Provider execution chain. A future targeted recovery must retry only these seats against the original frozen Final public snapshot."}
              gaps={execution}
              zh={zh}
            />
          ) : null}
          {provenance.length ? (
            <CoverageGroup
              title={zh ? "Final 变化解释缺口" : "FINAL-SHIFT PROVENANCE GAPS"}
              body={zh
                ? "这些 Provider Final 已经 verified / repaired，但 stance 与最后一次 pre-final 不同且没有 revision 票据。恢复动作只能追加解释，不能会后倒填 revision。"
                : "These Provider Finals are verified/repaired but differ from the latest pre-final stance without a revision receipt. Recovery may append clarification, never backfill a revision into the old meeting."}
              gaps={provenance}
              zh={zh}
            />
          ) : null}
        </>
      )}

      <div className="final-coverage-gaps__invariants" data-final-recovery-invariants="immutable">
        <span>🔒 {zh ? "原会议不可变" : "original meeting immutable"}</span>
        <span>≠ {zh ? "成功席位不获额外回合" : "successful seats get no bonus turn"}</span>
        <span>◫ {zh ? "恢复使用冻结 Final snapshot" : "retry uses frozen Final snapshot"}</span>
        <span>＋ {zh ? "只追加 recovery provenance" : "append recovery provenance only"}</span>
      </div>

      <div className="final-coverage-gaps__actions">
        <button type="button" onClick={() => void copyPlan()} disabled={plan.complete} data-final-recovery-action="copy-plan">
          {copied ? (zh ? "✓ 已复制恢复计划" : "✓ Recovery plan copied") : (zh ? "复制恢复计划" : "Copy recovery plan")}
        </button>
        <small>{archive
          ? (zh ? "历史视图：只读取冻结 report + execution receipt；0 次 Provider 调用。" : "Archive view: frozen report + execution receipt only; zero Provider calls.")
          : (zh ? "当前版本只准备计划，不自动发送、不追写原会议。" : "This version prepares the plan only; it does not auto-send or rewrite the original meeting.")}</small>
      </div>
    </section>
  );
}

function CoverageGroup({
  title,
  body,
  gaps,
  zh,
}: {
  title: string;
  body: string;
  gaps: readonly FinalCoverageGap[];
  zh: boolean;
}) {
  return (
    <section className="final-coverage-group">
      <div className="final-coverage-group__intro"><span>{title}</span><p>{body}</p></div>
      <div className="final-coverage-group__list">
        {gaps.map((gap) => <CoverageGapCard key={gap.id} gap={gap} zh={zh} />)}
      </div>
    </section>
  );
}

function CoverageGapCard({ gap, zh }: { gap: FinalCoverageGap; zh: boolean }) {
  const kind = gapLabel(gap, zh);
  const operation = operationLabel(gap, zh);
  return (
    <article
      className={`final-coverage-gap gap-${gap.kind}`}
      data-final-coverage-gap={gap.id}
      data-final-coverage-gap-kind={gap.kind}
      data-final-coverage-gap-class={gap.class}
      data-final-coverage-gap-priority={gap.priority}
      data-final-recovery-operation={gap.recommendedOperation}
      data-final-coverage-actor={gap.actorId}
    >
      <div className="final-coverage-gap__head">
        <div><strong>{gap.participantName}</strong><small>{gap.providerId}</small></div>
        <span>{kind}</span>
      </div>
      <p>{operation}</p>
      <div className="final-coverage-gap__meta">
        <i>{zh ? "Final" : "Final"}: {gap.finalStance}</i>
        <i>{Math.round(gap.finalConfidence * 100)}%</i>
        <i>{gap.executionState}</i>
        <i>{gap.recordSource}</i>
      </div>
      {gap.kind === "unexplained_final_shift" ? (
        <div className="final-coverage-gap__shift" data-final-coverage-shift="unexplained">
          {gap.latestPreFinalStance ?? "?"} → {gap.finalStance}
        </div>
      ) : null}
      <div className="final-coverage-gap__trace">
        {gap.latestPreFinalEventId ? <button type="button" onClick={() => focusConsultationEvent(gap.latestPreFinalEventId!)}>{zh ? "查看 pre-final" : "Trace pre-final"} ↗</button> : null}
        {gap.finalEventId ? <button type="button" onClick={() => focusConsultationEvent(gap.finalEventId!)}>{zh ? "查看 Final" : "Trace Final"} ↗</button> : null}
      </div>
    </article>
  );
}

function gapLabel(gap: FinalCoverageGap, zh: boolean): string {
  if (gap.kind === "fallback_final") return "FALLBACK";
  if (gap.kind === "failed_final") return zh ? "FINAL 失败" : "FINAL FAILED";
  if (gap.kind === "incomplete_final") return zh ? "FINAL 未闭环" : "FINAL INCOMPLETE";
  if (gap.kind === "unverified_final") return zh ? "FINAL 未验证" : "FINAL UNVERIFIED";
  return zh ? "无 revision 票据" : "NO REVISION RECEIPT";
}

function operationLabel(gap: FinalCoverageGap, zh: boolean): string {
  if (gap.recommendedOperation === "retry_final_against_frozen_snapshot") {
    return zh
      ? "未来恢复协议：只重跑这个席位的 Final，并使用原会议冻结的 Final public snapshot；成功席位不再发言。"
      : "Future recovery protocol: retry only this seat's Final against the original frozen Final public snapshot; successful seats do not speak again.";
  }
  if (gap.recommendedOperation === "verify_final_execution_provenance") {
    return zh ? "先恢复/验证 Final execution provenance，再决定这条记录能否称为 Provider Final。" : "Restore/verify Final execution provenance before calling this record a Provider Final.";
  }
  return zh
    ? "追加一个 provenance clarification，解释 Final 为什么改变；不能会后把解释伪装成原会议 revision。"
    : "Append a provenance clarification explaining the Final shift; never disguise the later explanation as a revision that happened in the original meeting.";
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
