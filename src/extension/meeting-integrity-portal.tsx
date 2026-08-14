import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CouncilEvent, CouncilReport } from "../core/types.js";
import { providerExecutionAuditSnapshot } from "../provider-sdk/execution-audit.js";
import {
  providerTransportAuditSnapshot,
  type ProviderExecutionMode,
} from "../provider-sdk/transport-audit.js";
import { buildProviderAttendanceAudit } from "../theater/provider-attendance.js";
import {
  deriveMeetingExecutionIntegrity,
  type MeetingExecutionIntegrity,
} from "../theater/meeting-integrity.js";
import "./meeting-integrity-portal.css";

const COMPLETE_EVENT = "chatchat:consultation-complete";
const SYNTHETIC_SHOWCASE = new URLSearchParams(location.search).get("showcase") === "consultation";

type IntegrityMode = ProviderExecutionMode | "unknown";

interface CompletionDetail {
  report: CouncilReport;
  events: CouncilEvent[];
}

interface IntegrityView {
  sessionId: string;
  mode: IntegrityMode;
  integrity: MeetingExecutionIntegrity;
}

function MeetingIntegrityPortal() {
  const [view, setView] = useState<IntegrityView | null>(null);
  const zh = useMemo(
    () => document.documentElement.lang.toLowerCase().startsWith("zh") || new URLSearchParams(location.search).get("lang") !== "en",
    [],
  );

  useEffect(() => {
    const onComplete = (event: Event) => {
      const detail = (event as CustomEvent<CompletionDetail>).detail;
      if (!detail?.report || !Array.isArray(detail.events)) return;
      const sessionId = detail.report.sessionId;
      const transports = providerTransportAuditSnapshot(sessionId);
      const execution = providerExecutionAuditSnapshot(sessionId);
      const participants = detail.report.positions.map((position) => position.participant);
      const audit = buildProviderAttendanceAudit(participants, transports, execution, detail.events);
      setView({
        sessionId,
        mode: transports[0]?.mode ?? (SYNTHETIC_SHOWCASE ? "synthetic-showcase" : "unknown"),
        integrity: deriveMeetingExecutionIntegrity(audit),
      });
    };
    window.addEventListener(COMPLETE_EVENT, onComplete);
    return () => window.removeEventListener(COMPLETE_EVENT, onComplete);
  }, []);

  useEffect(() => {
    if (!view) return;
    const root = document.getElementById("meeting-integrity-root");
    const outcome = document.querySelector(".outcome-card");
    if (!root || !outcome?.parentElement) return;
    outcome.insertAdjacentElement("afterend", root);
  }, [view]);

  if (!view) return null;
  return <MeetingIntegrityCard view={view} zh={zh} />;
}

function MeetingIntegrityCard({ view, zh }: { view: IntegrityView; zh: boolean }) {
  const { integrity, mode } = view;
  const synthetic = mode === "synthetic-showcase";
  const tone = integrity.state === "verified"
    ? "verified"
    : integrity.state === "verified_after_repair"
      ? "repaired"
      : integrity.state === "degraded"
        ? "degraded"
        : "incomplete";
  const title = integrityTitle(integrity, synthetic, zh);
  const body = integrityBody(integrity, synthetic, zh);

  return (
    <section
      className={`meeting-integrity-card tone-${tone}`}
      data-meeting-integrity-state={integrity.state}
      data-meeting-integrity-mode={mode}
      data-meeting-integrity-verified-turns={integrity.verifiedTurns}
      data-meeting-integrity-total-turns={integrity.totalTurns}
      data-meeting-integrity-fallback-turns={integrity.fallbackTurns}
      data-meeting-integrity-failed-turns={integrity.failedTurns}
    >
      <header>
        <div>
          <span>{zh ? "会议执行完整性" : "MEETING EXECUTION INTEGRITY"}</span>
          <strong>{title}</strong>
          <p>{body}</p>
        </div>
        <div className="meeting-integrity-score">
          <b>{integrity.verifiedTurns}/{integrity.totalTurns}</b>
          <small>{zh ? "已验证轮次" : "verified turns"}</small>
        </div>
      </header>

      <div className="meeting-integrity-metrics">
        <span>✓ {integrity.fullyVerifiedSeats}/{integrity.totalSeats} {zh ? "席位完整" : "seats complete"}</span>
        <span>↺ {integrity.repairedTurns} {zh ? "修复后通过" : "repaired"}</span>
        <span>≈ {integrity.fallbackTurns} fallback</span>
        <span>! {integrity.failedTurns} {zh ? "失败" : "failed"}</span>
        {integrity.unresolvedTurns ? <span>… {integrity.unresolvedTurns} {zh ? "未闭环" : "unresolved"}</span> : null}
      </div>

      <div className="meeting-integrity-rule">
        {synthetic
          ? zh
            ? "这是合成 Demo 的执行链完整性，只证明 fixture / UI / 协议流程，不证明第三方 AI 真实出席。"
            : "This is synthetic-demo execution integrity. It proves fixture/UI/protocol flow, not live third-party model attendance."
          : zh
            ? "执行完整性不评价答案质量；它只证明这些 Provider 轮次是否真的走完 页面响应 → 结构化解析 → Blackboard 发布。"
            : "Execution integrity does not grade answer quality. It only proves whether Provider turns completed page response → structured parse → Blackboard publication."}
      </div>
    </section>
  );
}

function integrityTitle(integrity: MeetingExecutionIntegrity, synthetic: boolean, zh: boolean): string {
  if (synthetic) {
    return zh
      ? `合成演示链 ${integrity.verifiedTurns}/${integrity.totalTurns} 已验证`
      : `Synthetic demo chain ${integrity.verifiedTurns}/${integrity.totalTurns} verified`;
  }
  if (integrity.state === "verified") return zh ? "所有可审计 Provider 轮次都已闭环" : "Every auditable Provider turn completed";
  if (integrity.state === "verified_after_repair") return zh ? "所有轮次已闭环，但有回答经过格式修复" : "All turns completed, with structured repair";
  if (integrity.state === "degraded") return zh ? "执行覆盖不完整：结果必须带着缺口一起读" : "Execution coverage is degraded — read the result with the gap";
  return zh ? "执行审计尚未完整闭环" : "Execution audit is not fully closed";
}

function integrityBody(integrity: MeetingExecutionIntegrity, synthetic: boolean, zh: boolean): string {
  if (synthetic) {
    return zh
      ? "下面的对齐度和结果来自 deterministic showcase fixture。不要把它当成 ChatGPT / Claude / Gemini 等真实 Provider 对该提案的判断。"
      : "The alignment and outcome below come from deterministic showcase fixtures. Do not treat them as judgments made by live ChatGPT, Claude, Gemini, or other Providers.";
  }
  if (integrity.state === "verified") {
    return zh
      ? `${integrity.verifiedTurns} 个 Provider 轮次全部完成了可验证执行链；${integrity.fullyVerifiedSeats}/${integrity.totalSeats} 个席位每轮都完整。对齐度仍然只是观点分布，不是正确率。`
      : `${integrity.verifiedTurns} Provider turns completed the auditable execution chain; ${integrity.fullyVerifiedSeats}/${integrity.totalSeats} seats are complete across every turn. Alignment is still a stance distribution, not an accuracy score.`;
  }
  if (integrity.state === "verified_after_repair") {
    return zh
      ? `${integrity.verifiedTurns}/${integrity.totalTurns} 轮最终发布成功，其中 ${integrity.repairedTurns} 轮需要同一 Provider 的一次结构化 repair。修复过程已保留在审计票据里。`
      : `${integrity.verifiedTurns}/${integrity.totalTurns} turns ultimately published; ${integrity.repairedTurns} required one structured repair from the same Provider. The repair remains visible in the audit receipt.`;
  }
  if (integrity.state === "degraded") {
    return zh
      ? `${integrity.verifiedTurns}/${integrity.totalTurns} 轮完成真实 Provider 闭环；存在 ${integrity.fallbackTurns} 个 fallback、${integrity.failedTurns} 个失败。不要把最终对齐比例理解成“所有 AI 都充分参与后的共识”。`
      : `${integrity.verifiedTurns}/${integrity.totalTurns} turns completed the Provider chain; ${integrity.fallbackTurns} fallback and ${integrity.failedTurns} failed turn(s) remain. Do not read the alignment ratio as consensus after full Provider participation.`;
  }
  return zh
    ? `${integrity.verifiedTurns}/${integrity.totalTurns} 轮已验证，还有 ${integrity.unresolvedTurns} 轮没有完成执行闭环。结果应视为暂定，而不是完整覆盖所有 Provider 的终局。`
    : `${integrity.verifiedTurns}/${integrity.totalTurns} turns are verified and ${integrity.unresolvedTurns} remain outside the complete execution chain. Treat the result as provisional rather than full Provider coverage.`;
}

const root = document.getElementById("meeting-integrity-root");
if (!root) throw new Error("ChatChat Meeting Integrity root is missing.");
createRoot(root).render(<StrictMode><MeetingIntegrityPortal /></StrictMode>);
