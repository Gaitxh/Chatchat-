import { useMemo, useState } from "react";
import type { CouncilEvent, CouncilParticipant, CouncilReport } from "../../core/types.js";
import type { EvidenceVerificationSnapshot } from "../../evidence/evidence-ledger.js";
import type { Locale } from "../../i18n/index.js";
import {
  deriveConsultationNextMoves,
  type ConsultationNextMove,
} from "../../consultation/next-moves.js";
import { focusConsultationEvent } from "../provenance-wire.js";
import { stageProposalInExistingComposer } from "../proposal-seed.js";
import "./next-move-board.css";

interface NextMoveBoardProps {
  report: CouncilReport;
  participants: readonly CouncilParticipant[];
  events: readonly CouncilEvent[];
  verifications?: Readonly<Record<string, EvidenceVerificationSnapshot>>;
  locale: Locale;
  archive?: boolean;
}

export function NextMoveBoard({
  report,
  participants,
  events,
  verifications = {},
  locale,
  archive = false,
}: NextMoveBoardProps) {
  const moves = useMemo(
    () => deriveConsultationNextMoves(report, participants, events, verifications, 4),
    [report, participants, events, verifications],
  );
  const [stagedId, setStagedId] = useState<string | null>(null);
  const zh = locale === "zh-CN";

  if (!moves.length) return null;

  return (
    <section className="next-move-board">
      <header>
        <div>
          <span>{zh ? "下一步协商" : "NEXT MOVE"}</span>
          <h3>{zh ? "有结果，不代表没问题了。" : "An outcome is not the end of inquiry."}</h3>
          <p>{zh
            ? "这些下一步只来自可追溯的证据缺口、争议和少数意见。没有主持人 AI，也不会自动开始下一场会议。"
            : "These follow-ups come only from traceable evidence gaps, disputes and surviving minority views. No chair AI chooses for you, and nothing auto-sends."}</p>
        </div>
        <b>{archive ? (zh ? "来自历史快照" : "FROM ARCHIVE") : (zh ? "由事件推导" : "EVENT-DERIVED")}</b>
      </header>

      <div className="next-move-list">
        {moves.map((move, index) => (
          <NextMoveCard
            key={move.id}
            move={move}
            index={index}
            zh={zh}
            staged={stagedId === move.id}
            onStage={() => {
              const copy = zh ? move.zhCN : move.en;
              if (stageProposalInExistingComposer(copy.proposal)) setStagedId(move.id);
            }}
          />
        ))}
      </div>

      <small className="next-move-boundary">{zh
        ? "ChatChat 只把“接下来值得查什么”摆出来；是否继续、怎么提问，仍然由你决定。"
        : "ChatChat surfaces what may be worth checking next. You still decide whether to continue and how to ask."}</small>
    </section>
  );
}

function NextMoveCard({
  move,
  index,
  zh,
  staged,
  onStage,
}: {
  move: ConsultationNextMove;
  index: number;
  zh: boolean;
  staged: boolean;
  onStage(): void;
}) {
  const copy = zh ? move.zhCN : move.en;
  const traceId = move.relatedEventIds[0];
  return (
    <article className={`next-move-card move-${move.kind}`}>
      <div className="next-move-number">{String(index + 1).padStart(2, "0")}</div>
      <div className="next-move-content">
        <div className="next-move-title-row">
          <span className="next-move-icon">{move.icon}</span>
          <div><strong>{copy.label}</strong><small>{modeLabel(move.modeHint, zh)}</small></div>
        </div>
        <p>{copy.reason}</p>
        <div className="next-move-actions">
          <button type="button" className="next-move-primary" onClick={onStage}>
            {staged
              ? (zh ? "✓ 已放入提案框，请先审阅" : "✓ Staged — review before sending")
              : (zh ? "作为下一轮提案" : "Use as next proposal")}
          </button>
          {traceId ? (
            <button type="button" onClick={() => focusConsultationEvent(traceId)}>
              {zh ? "查看依据" : "Trace why"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function modeLabel(mode: ConsultationNextMove["modeHint"], zh: boolean): string {
  if (mode === "verify") return zh ? "建议视角 · 核验" : "SUGGESTED LENS · VERIFY";
  if (mode === "stress_test") return zh ? "建议视角 · 压力测试" : "SUGGESTED LENS · STRESS TEST";
  return zh ? "建议视角 · 探索" : "SUGGESTED LENS · EXPLORE";
}
