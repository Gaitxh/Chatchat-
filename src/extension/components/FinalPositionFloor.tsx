import { useMemo } from "react";
import type { CouncilEvent, CouncilReport } from "../../core/types.js";
import type { Locale } from "../../i18n/index.js";
import type { ProviderExecutionMode } from "../../provider-sdk/transport-audit.js";
import {
  deriveFinalPositionFloor,
  type FinalPositionGroup,
  type FinalPositionSeat,
  type FinalSeatExecutionState,
} from "../../theater/final-position-floor.js";
import type { ProviderAttendanceAuditModel } from "../../theater/provider-attendance.js";
import { focusConsultationEvent } from "../provenance-wire.js";
import "./final-position-floor.css";

interface FinalPositionFloorProps {
  report: CouncilReport;
  events: readonly CouncilEvent[];
  attendance?: ProviderAttendanceAuditModel | null;
  executionMode?: ProviderExecutionMode | "unknown";
  locale: Locale;
  archive?: boolean;
}

export function FinalPositionFloor({
  report,
  events,
  attendance,
  executionMode = "unknown",
  locale,
  archive = false,
}: FinalPositionFloorProps) {
  const zh = locale === "zh-CN";
  const model = useMemo(
    () => deriveFinalPositionFloor(report, events, attendance),
    [report, events, attendance],
  );
  const synthetic = executionMode === "synthetic-showcase";

  return (
    <section
      className={`final-position-floor ${archive ? "is-archive" : ""} ${synthetic ? "is-synthetic" : ""}`}
      data-final-position-floor="explicit-final-submissions"
      data-final-position-session={model.sessionId}
      data-final-position-group-count={model.groups.length}
      data-final-position-participant-count={model.participantCount}
      data-final-position-leading-share={model.largestGroupShare.toFixed(4)}
      data-final-position-alignment-match={model.reportAlignmentMatchesGroups ? "true" : "false"}
      data-final-position-degraded-count={model.degradedActorIds.length}
      data-final-position-fallback-count={model.fallbackActorIds.length}
      data-final-position-unexplained-count={model.unexplainedFinalShiftActorIds.length}
      data-final-position-execution-mode={executionMode}
    >
      <header className="final-position-floor__header">
        <div>
          <span>{zh ? "会议最终席位图" : "FINAL POSITION FLOOR"}</span>
          <h3>{zh ? "每个最终席位实际记录了什么？" : "What was actually recorded for every final seat?"}</h3>
          <p>{zh
            ? "这里按 CouncilReport.positions 复现最终席位分组，并同时核对每个席位的 Final 执行票据。只有 verified / repaired 才能说对应 Provider 的 Final 真正完成了执行链；fallback 会明确标成 ChatChat 的失败占位，不冒充模型自己的最终判断。质疑、证据、支持和别人替它说的话都不能把一个席位塞进某个阵营。最大组只是描述性分布，不是权威。"
            : "This reproduces final seat accounting from CouncilReport.positions while checking each seat's Final execution receipt. Only verified/repaired means that Provider Final completed the execution chain; fallback is labeled as a ChatChat failure placeholder and never masquerades as the model's own final judgment. Challenges, evidence, support, or somebody else's prose cannot assign a final camp. The largest group is descriptive distribution, not authority."}</p>
        </div>
        <div className="final-position-floor__summary">
          <b>{model.participantCount}<small>{zh ? "席位" : "seats"}</small></b>
          <b>{model.groups.length}<small>{zh ? "最终组" : "groups"}</small></b>
          <b>{Math.round(model.largestGroupShare * 100)}%<small>{zh ? "最大组占比" : "largest share"}</small></b>
        </div>
      </header>

      {synthetic ? (
        <div className="final-position-floor__synthetic" data-final-position-synthetic="true">
          <b>DEMO · SYNTHETIC</b>
          <span>{zh ? "这些席位来自 deterministic fixture，用来证明 UI / 协议；不是第三方 AI 的真实最终立场。" : "These seats come from deterministic fixtures to prove the UI/protocol, not live third-party model final positions."}</span>
        </div>
      ) : null}

      {!model.reportAlignmentMatchesGroups ? (
        <div className="final-position-floor__warning" data-final-position-report-mismatch="true">
          <b>!</b><span>{zh
            ? "报告里的对齐度与当前 final position 分组不一致。这里不偷偷修正报告；请检查 archive / final event 完整性。"
            : "The report alignment does not match the current final-position grouping. ChatChat does not silently repair it; inspect archive/final-event integrity."}</span>
        </div>
      ) : null}

      <div className="final-position-groups">
        {model.groups.map((group) => (
          <FinalGroup
            key={group.id}
            group={group}
            seats={model.seats.filter((seat) => seat.stanceKey === group.stanceKey)}
            totalParticipants={model.participantCount}
            zh={zh}
          />
        ))}
      </div>

      {model.unexplainedFinalShiftActorIds.length ? (
        <div className="final-position-floor__unexplained" data-final-position-unexplained="true">
          <span>{zh ? "没有 revision 票据的 Provider Final 变更" : "PROVIDER FINAL SHIFTS WITHOUT REVISION RECEIPTS"}</span>
          <p>{zh
            ? "这些 verified / repaired Provider Final 与它们最后一次公开的 pre-final stance 不同，但事件流里没有匹配的 revision。最终提交仍被保留；ChatChat 不会替它编造改变原因。fallback 不会进入这里，因为它已经有明确的执行失败来源。"
            : "These verified/repaired Provider Finals differ from their latest public pre-final stance without a matching revision event. The final submission is preserved, but ChatChat does not invent why it changed. Fallback records never enter this warning because their execution-failure source is already known."}</p>
          <div>{model.seats.filter((seat) => seat.unexplainedFinalShift).map((seat) => <i key={seat.actorId}>{seat.participantName}</i>)}</div>
        </div>
      ) : null}

      <footer>{archive
        ? (zh ? "↺ 历史视图只读取冻结 report / Blackboard / execution receipt；不会重新调用 Provider。" : "↺ Archive view reads frozen report / Blackboard / execution receipt only; no Provider calls.")
        : (zh ? "最终席位图与线程内“明示立场战线”是两层不同视图：一个复现全场最终报告席位，一个看具体争议中的公开站位。" : "This meeting-wide final floor is separate from thread-local Explicit Stance Fronts: one reproduces final report seats, the other shows positions inside a specific dispute.")}</footer>
    </section>
  );
}

function FinalGroup({
  group,
  seats,
  totalParticipants,
  zh,
}: {
  group: FinalPositionGroup;
  seats: readonly FinalPositionSeat[];
  totalParticipants: number;
  zh: boolean;
}) {
  return (
    <article
      className={`final-position-group ${group.isReportLeadingGroup ? "is-report-leading" : ""}`}
      data-final-position-group={group.id}
      data-final-position-stance={group.stance}
      data-final-position-group-count={group.count}
      data-final-position-group-share={group.share.toFixed(4)}
      data-final-position-group-leading={group.isReportLeadingGroup ? "true" : "false"}
    >
      <div className="final-position-group__top">
        <div>
          <span>{group.isReportLeadingGroup ? (zh ? "报告中的领先组 · 描述性" : "REPORT LEADING GROUP · DESCRIPTIVE") : (zh ? "保留的其他最终立场" : "OTHER SURVIVING FINAL STANCE")}</span>
          <strong>{group.stance}</strong>
        </div>
        <b>{group.count}/{totalParticipants}<small>{Math.round(group.share * 100)}%</small></b>
      </div>
      <div className="final-position-group__meta">
        <span>{zh ? "平均置信度" : "avg confidence"} {Math.round(group.averageConfidence * 100)}%</span>
        {group.fallbackMemberCount ? <span className="is-warning">≈ {group.fallbackMemberCount} fallback</span> : null}
        {group.degradedMemberCount ? <span className="is-warning">! {group.degradedMemberCount} {zh ? "席位执行降级" : "degraded seat"}</span> : null}
        {group.isLargestGroup && !group.isReportLeadingGroup ? <span>{zh ? "并列最大组" : "tied largest group"}</span> : null}
      </div>
      <div className="final-position-seat-list">
        {seats.map((seat) => <FinalSeat key={seat.actorId} seat={seat} zh={zh} />)}
      </div>
    </article>
  );
}

function FinalSeat({ seat, zh }: { seat: FinalPositionSeat; zh: boolean }) {
  const execution = executionMeta(seat.executionState, zh);
  const finalEventId = seat.finalEventId;
  const firstRevision = seat.revisionSteps[0];
  const lastRevision = seat.revisionSteps.at(-1);
  const explicitRevisionStart = firstRevision?.fromStance ?? seat.firstExplicitStance ?? "?";
  const explicitRevisionEnd = lastRevision?.toStance ?? explicitRevisionStart;
  return (
    <section
      className={`final-position-seat execution-${seat.executionState}`}
      data-final-seat={seat.actorId}
      data-final-seat-stance={seat.stance}
      data-final-seat-execution={seat.executionState}
      data-final-seat-source={seat.recordSource}
      data-final-seat-changed={seat.changedExplicitStance ? "true" : "false"}
      data-final-seat-unexplained-shift={seat.unexplainedFinalShift ? "true" : "false"}
    >
      <div className="final-position-seat__head">
        <div><strong>{seat.participantName}</strong><small>{seat.providerId}</small></div>
        <span className={`execution-badge state-${seat.executionState}`}>{execution.icon} {execution.label}</span>
      </div>
      <p>{seat.content}</p>
      <div className="final-position-seat__stats">
        <span>{Math.round(seat.confidence * 100)}% {zh ? "置信度" : "confidence"}</span>
        {seat.totalTurns ? <span>{seat.verifiedTurns}/{seat.totalTurns} {zh ? "轮已验证" : "turns verified"}</span> : <span>{zh ? "无执行票据" : "no execution receipt"}</span>}
      </div>

      {seat.recordSource === "fallback_placeholder" ? (
        <div className="final-position-seat__source-note is-fallback" data-final-seat-source-note="fallback-placeholder">
          <b>≈</b><span>{zh ? "ChatChat fallback placeholder · 这是执行失败说明，不是该 Provider 自己完成的 Final。" : "ChatChat fallback placeholder · this records execution failure, not a Final successfully authored by the Provider."}</span>
        </div>
      ) : seat.recordSource === "unverified_record" ? (
        <div className="final-position-seat__source-note" data-final-seat-source-note="unverified-record">
          <b>?</b><span>{zh ? "缺少足够的 Final 执行票据，不能证明这条记录由 Provider 完成。" : "There is not enough Final execution provenance to claim this record completed at the Provider."}</span>
        </div>
      ) : null}

      {seat.changedExplicitStance ? (
        <div className="final-position-seat__lineage" data-final-seat-lineage="explicit-revision">
          <span>↻ {zh ? "明确 revision 票据" : "EXPLICIT REVISION RECEIPTS"}</span>
          <p>{explicitRevisionStart} <i>→</i> {explicitRevisionEnd}</p>
          <div>
            {seat.revisionSteps.map((step) => (
              <button key={step.eventId} type="button" data-final-seat-revision-event={step.eventId} onClick={() => focusConsultationEvent(step.eventId)}>
                R{step.round} · {step.fromStance ?? "?"} → {step.toStance} ↗
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {seat.unexplainedFinalShift ? (
        <div className="final-position-seat__unexplained" data-final-seat-shift-warning="unexplained">
          <b>!</b>
          <span>{zh
            ? `${seat.latestPreFinalStance ?? "?"} → ${seat.stance}：这是 verified / repaired Provider Final，但没有对应 revision 事件，因此不推断原因。`
            : `${seat.latestPreFinalStance ?? "?"} → ${seat.stance}: this is a verified/repaired Provider Final with no matching revision event, so no cause is inferred.`}</span>
          {finalEventId ? <button type="button" onClick={() => focusConsultationEvent(finalEventId)}>{zh ? "查看 Final 事件" : "Trace final event"} ↗</button> : null}
        </div>
      ) : finalEventId ? (
        <button className="final-position-seat__trace" type="button" data-final-seat-event={finalEventId} onClick={() => focusConsultationEvent(finalEventId)}>{zh ? "查看最终事件" : "Trace final event"} ↗</button>
      ) : null}

      {seat.caveats.length ? <div className="final-position-seat__caveats">{seat.caveats.map((item) => <i key={item}>{item}</i>)}</div> : null}
    </section>
  );
}

function executionMeta(state: FinalSeatExecutionState, zh: boolean): { icon: string; label: string } {
  if (state === "verified") return { icon: "✓", label: zh ? "Final 已验证" : "Final verified" };
  if (state === "repaired") return { icon: "↺", label: zh ? "Final 修复后验证" : "Final repaired" };
  if (state === "fallback") return { icon: "≈", label: "FALLBACK" };
  if (state === "failed") return { icon: "!", label: zh ? "Final 失败" : "Final failed" };
  if (state === "incomplete") return { icon: "…", label: zh ? "Final 未闭环" : "Final incomplete" };
  return { icon: "?", label: zh ? "执行未知" : "Execution unknown" };
}
