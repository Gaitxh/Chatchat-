import type { Locale } from "../../i18n/index.js";
import type {
  ProviderMemoryCoverageGap,
  ProviderMemoryGapModel,
  ProviderMemoryGapRound,
} from "../../theater/provider-memory-gaps.js";
import "./provider-memory-gaps.css";

interface ProviderMemoryGapsProps {
  model: ProviderMemoryGapModel;
  locale: Locale;
  onFocusEvent(eventId: string): void;
}

const KIND = {
  open_question: { en: "question", zh: "追问" },
  challenged_claim: { en: "challenge", zh: "质疑" },
  evidence_awaiting_response: { en: "evidence awaiting response", zh: "等待回应的证据" },
  explicit_uncertainty: { en: "explicit uncertainty", zh: "明确不确定" },
} as const;

export function ProviderMemoryGaps({ model, locale, onFocusEvent }: ProviderMemoryGapsProps) {
  const zh = locale === "zh-CN";
  if (!model.gaps.length) {
    return (
      <section className="provider-memory-gaps is-clear" data-provider-memory-gap-state="clear">
        <span>{zh ? "MEMORY COVERAGE GAPS" : "MEMORY COVERAGE GAPS"}</span>
        <strong>{zh ? "没有已知未决 source 被这一轮硬预算挤出" : "No known unresolved source was pushed out by the bounded memory deck"}</strong>
        <p>{zh
          ? "这不证明答案正确；它只表示在可审计的轮次里，canonical-open source events 没有因为 12-event 公共上下文上限而缺席。"
          : "This does not prove answer correctness. It only means canonical-open source events were not absent from the auditable bounded public memory turns."}</p>
      </section>
    );
  }

  const visibleRounds = model.rounds.filter((round) => round.gapCount > 0).slice(-4).reverse();
  return (
    <section
      className="provider-memory-gaps has-gaps"
      data-provider-memory-gap-state="limited"
      data-provider-memory-gap-turns={model.gapTurnCount}
      data-provider-memory-gap-sources={model.uniqueGapSourceEventIds.length}
      data-provider-memory-gap-actual-prompt-count={model.actualPromptGapCount}
      data-provider-memory-gap-fair={model.allGapSetsFairWithinRound ? "true" : "false"}
    >
      <header>
        <div>
          <span>MEMORY COVERAGE GAPS</span>
          <strong>{zh ? "硬上限下，这些仍未决 source 没有进入某些 Provider Prompt" : "These unresolved sources were absent from some bounded Provider Prompts"}</strong>
          <p>{zh
            ? "这是已知的公共记忆覆盖限制，不是重要性判断。12-event hard cap、最新轮保护和有限 pin 容量意味着：即使 obligation 仍未决，也可能没有足够槽位把它带进这一轮。"
            : "This is a known public-memory coverage limitation, not an importance judgment. The 12-event hard cap, newest-round protection and finite pin capacity mean an unresolved obligation may still lack a slot in a later turn."}</p>
        </div>
        <div className="provider-memory-gaps__stats">
          <b>{model.uniqueGapSourceEventIds.length}<small>{zh ? "唯一未决 source" : "unique sources"}</small></b>
          <b>{model.gapTurnCount}<small>{zh ? "受影响 Provider 轮次" : "affected turns"}</small></b>
          <b className={model.allGapSetsFairWithinRound ? "is-ok" : "is-bad"}>{model.allGapSetsFairWithinRound ? "✓" : "!"}<small>{zh ? "同轮 gap 公平" : "same-round gap fairness"}</small></b>
        </div>
      </header>

      <div className="provider-memory-gap-rounds">
        {visibleRounds.map((round) => (
          <GapRound key={round.key} round={round} model={model} zh={zh} onFocusEvent={onFocusEvent} />
        ))}
      </div>
      <footer>{zh
        ? "Coverage gap 不表示这个 issue 更重要，也不表示模型一定会因此改变答案；它只证明当时仍未决、但没有进入这轮公共 Prompt。"
        : "A coverage gap does not imply importance or that the model would have answered differently. It proves only that the source was still unresolved at turn start and absent from that public Prompt."}</footer>
    </section>
  );
}

function GapRound({
  round,
  model,
  zh,
  onFocusEvent,
}: {
  round: ProviderMemoryGapRound;
  model: ProviderMemoryGapModel;
  zh: boolean;
  onFocusEvent(eventId: string): void;
}) {
  const gaps = model.gaps.filter((gap) => gap.phase === round.phase && gap.round === round.round);
  const bySource = new Map<string, ProviderMemoryCoverageGap[]>();
  for (const gap of gaps) {
    const group = bySource.get(gap.sourceEventId) ?? [];
    group.push(gap);
    bySource.set(gap.sourceEventId, group);
  }
  return (
    <article
      className={`provider-memory-gap-round ${round.allSeatsSameGapSet ? "is-fair" : "is-unfair"}`}
      data-provider-memory-gap-round={round.round}
      data-provider-memory-gap-phase={round.phase}
      data-provider-memory-gap-round-sources={round.uniqueGapSourceEventIds.length}
      data-provider-memory-gap-round-turns={round.turnsWithGaps}
      data-provider-memory-gap-round-fair={round.allSeatsSameGapSet ? "true" : "false"}
    >
      <div className="provider-memory-gap-round__top">
        <strong>{round.phase.toUpperCase()} · R{round.round}</strong>
        <span>{round.turnsWithGaps}/{round.seatCount} {zh ? "席位存在 coverage gap" : "seats with coverage gaps"}</span>
        <em>{round.allSeatsSameGapSet ? (zh ? "✓ 同轮 gap 集合一致" : "✓ SAME GAP SET") : (zh ? "! 同轮 gap 集合不同" : "! DIFFERENT GAP SETS")}</em>
      </div>
      <div className="provider-memory-gap-list">
        {[...bySource.entries()].map(([sourceEventId, sourceGaps]) => {
          const first = sourceGaps[0]!;
          return (
            <button
              type="button"
              key={sourceEventId}
              className="provider-memory-gap"
              data-provider-memory-gap-source={sourceEventId}
              data-provider-memory-gap-kind={first.kind}
              data-provider-memory-gap-opened-round={first.openedRound}
              data-provider-memory-gap-affected-seats={sourceGaps.length}
              onClick={() => onFocusEvent(sourceEventId)}
            >
              <span>{KIND[first.kind][zh ? "zh" : "en"]} · R{first.openedRound}</span>
              <strong>{first.sourceActorName}{first.targetActorName ? ` → ${first.targetActorName}` : ""}</strong>
              <p>{first.sourceExcerpt}</p>
              <small>{sourceGaps.length}/{round.seatCount} {zh ? "席位未收到 ·" : "seats missed ·"} {sourceGaps.every((gap) => gap.selectionEvidence === "actual_prompt") ? "ACTUAL PROMPT" : "SELECTOR AUDIT"}</small>
              <i>↗</i>
            </button>
          );
        })}
      </div>
    </article>
  );
}
