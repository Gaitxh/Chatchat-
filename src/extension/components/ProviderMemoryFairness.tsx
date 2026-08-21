import type { Locale } from "../../i18n/index.js";
import type {
  ProviderMemoryFairnessModel,
  ProviderMemoryFairnessRound,
  ProviderMemoryFairnessState,
} from "../../theater/provider-memory-fairness.js";
import "./provider-memory-fairness.css";

interface ProviderMemoryFairnessProps {
  model: ProviderMemoryFairnessModel;
  locale: Locale;
  archive?: boolean;
}

export function ProviderMemoryFairness({ model, locale, archive = false }: ProviderMemoryFairnessProps) {
  const zh = locale === "zh-CN";
  if (!model.turns.length) return null;
  return (
    <section
      className={`provider-memory-fairness state-${model.state}`}
      data-provider-memory-fairness={model.state}
      data-provider-memory-fairness-session={model.sessionId ?? ""}
      data-provider-memory-fairness-view={archive ? "archive" : "live"}
      data-memory-fairness-actual-prompt-turns={model.actualPromptTurns}
      data-memory-fairness-total-turns={model.auditedTurns}
      data-memory-fairness-payload-mismatch-rounds={model.publicPayloadMismatchRounds}
      data-memory-fairness-repair-mismatch-turns={model.repairContextMismatchTurns}
      data-memory-fairness-selector-actor-mismatch-turns={model.selectorActorMismatchTurns}
      data-memory-fairness-representation-limited-rounds={model.representationLimitedRounds}
    >
      <header>
        <div>
          <span>{zh ? "公共记忆程序公平" : "PUBLIC MEMORY PROCEDURAL FAIRNESS"}</span>
          <strong>{title(model.state, zh)}</strong>
          <p>{body(model.state, zh)}</p>
        </div>
        <b className="provider-memory-fairness__state">{stateLabel(model.state)}</b>
      </header>

      <div className="provider-memory-fairness__metrics">
        <span><b>{model.actualPromptTurns}/{model.auditedTurns}</b><small>{zh ? "actual Prompt 轮次" : "actual Prompt turns"}</small></span>
        <span><b>{model.publicPayloadMismatchRounds}</b><small>{zh ? "payload 不一致轮" : "payload mismatch rounds"}</small></span>
        <span><b>{model.repairContextMismatchTurns}</b><small>{zh ? "repair 换牌轮次" : "repair context drifts"}</small></span>
        <span><b>{model.representationLimitedRounds}</b><small>{zh ? "席位代表受限轮" : "representation-limited rounds"}</small></span>
      </div>

      <div className="provider-memory-fairness__rounds">
        {model.rounds.slice(-5).reverse().map((round) => <FairnessRound key={round.key} round={round} zh={zh} />)}
      </div>

      <footer>{archive
        ? (zh ? "历史模式只重新读取冻结的 execution receipt；不会重新调用 Provider，也不会把今天的公平规则倒灌成当时发生过的 actual Prompt。" : "Archive mode reads frozen execution receipts only. It makes no Provider calls and never upgrades old evidence into an actual Prompt that did not exist then.")
        : (zh ? "这里审计的是程序：谁被公共上下文代表、平等席位是否拿到相同 payload、repair 是否保持同一副牌。它不判断任何 AI 的答案是否正确。" : "This audits procedure: actor representation, equal-seat public payload equality, and repair-deck parity. It does not judge whether any AI answer is correct.")}</footer>
    </section>
  );
}

function FairnessRound({ round, zh }: { round: ProviderMemoryFairnessRound; zh: boolean }) {
  const actorTotal = round.latestRoundActorIds.length;
  const actorRepresented = round.latestRoundRepresentedActorIds.length;
  return (
    <article
      className={round.latestRoundRepresentationComplete && round.publicPayloadConsistent && !round.selectorActorMismatchSeats && !round.repairContextMismatchSeats ? "is-ok" : "has-issue"}
      data-memory-fairness-round={round.round}
      data-memory-fairness-phase={round.phase}
      data-memory-fairness-actor-total={actorTotal}
      data-memory-fairness-actor-represented={actorRepresented}
      data-memory-fairness-actor-omitted={round.latestRoundOmittedActorIds.length}
      data-memory-fairness-payload-consistent={round.publicPayloadConsistent ? "true" : "false"}
      data-memory-fairness-actual-prompt-seats={round.actualPromptSeatCount}
      data-memory-fairness-seat-count={round.seatCount}
      data-memory-fairness-selector-actor-mismatch-seats={round.selectorActorMismatchSeats}
      data-memory-fairness-repair-mismatch-seats={round.repairContextMismatchSeats}
    >
      <div><strong>{round.phase.toUpperCase()} · R{round.round}</strong><span>{actorTotal ? `${actorRepresented}/${actorTotal} ${zh ? "上一轮 actor 被代表" : "previous-round actors represented"}` : (zh ? "无前序公共 actor" : "no prior public actors")}</span></div>
      <ul>
        <li className={round.latestRoundRepresentationComplete ? "ok" : "bad"}>{round.latestRoundRepresentationComplete ? "✓" : "!"} {zh ? "席位代表" : "actor representation"}</li>
        <li className={round.publicPayloadConsistent ? "ok" : "bad"}>{round.publicPayloadConsistent ? "✓" : "!"} {zh ? "actual payload 同一" : "same actual payload"}</li>
        <li className={round.selectorActorMismatchSeats ? "bad" : "ok"}>{round.selectorActorMismatchSeats ? "!" : "✓"} selector ↔ Prompt actors</li>
        <li className={round.repairContextMismatchSeats ? "bad" : "ok"}>{round.repairContextMismatchSeats ? "!" : "✓"} {zh ? "repair 不换牌" : "repair keeps deck"}</li>
      </ul>
      {round.latestRoundOmittedActorIds.length ? <code>{zh ? "未被代表" : "omitted"}: {round.latestRoundOmittedActorIds.join(", ")}</code> : null}
    </article>
  );
}

function stateLabel(state: ProviderMemoryFairnessState): string {
  if (state === "verified") return "VERIFIED";
  if (state === "representation_limited") return "REPRESENTATION LIMITED";
  if (state === "public_payload_mismatch") return "PAYLOAD MISMATCH";
  if (state === "repair_context_drift") return "REPAIR CONTEXT DRIFT";
  if (state === "selector_actor_drift") return "SELECTOR ACTOR DRIFT";
  if (state === "legacy_unverified") return "LEGACY · UNVERIFIED";
  return "PROMPT · UNVERIFIED";
}

function title(state: ProviderMemoryFairnessState, zh: boolean): string {
  if (state === "verified") return zh ? "平等席位获得了可验证的同一公共记忆程序" : "Equal seats received a verifiably consistent public-memory procedure";
  if (state === "representation_limited") return zh ? "硬上限无法代表上一轮的所有参与者" : "The hard cap could not represent every actor from the previous round";
  if (state === "public_payload_mismatch") return zh ? "同轮平等 Provider 实际收到的公共事件 payload 不同" : "Equal Providers received different actual public event payloads in the same round";
  if (state === "repair_context_drift") return zh ? "格式 repair 时公共会议上下文发生了变化" : "A format repair changed the public meeting context";
  if (state === "selector_actor_drift") return zh ? "Selector 声称的席位覆盖与实际 Prompt 不一致" : "Selector actor coverage disagreed with the actual Prompt";
  if (state === "legacy_unverified") return zh ? "旧会议缺少现代程序公平证明" : "This older meeting predates modern procedural-fairness proof";
  return zh ? "缺少足够的 actual Prompt 证明" : "Actual Prompt evidence is incomplete";
}

function body(state: ProviderMemoryFairnessState, zh: boolean): string {
  if (state === "verified") return zh ? "验证内容包括：最新轮席位代表、实际 CONSULTATION_EVENTS_JSON fingerprint、selector actor coverage，以及 repair 前后公共 deck 一致性。" : "Verified dimensions include latest-round actor representation, actual CONSULTATION_EVENTS_JSON fingerprints, selector actor coverage, and first/repair public-deck parity.";
  if (state === "representation_limited") return zh ? "这不是某个模型更重要，而是固定上下文槽位在本轮数学上不足。被省略 actor 会被明确列出，结果不能冒充完整代表。" : "No model is declared more important. The fixed context budget was mathematically too small for full representation, so omitted actors stay explicit.";
  if (state === "public_payload_mismatch") return zh ? "即使 event IDs 相同，只要 actual public JSON fingerprint 不同，也不能称为同一副公共牌。" : "Matching event ids are insufficient: different actual public JSON fingerprints mean the public deck was not identical.";
  if (state === "repair_context_drift") return zh ? "Repair 只应修输出格式。公共 snapshot、pin、actor coverage 或 payload fingerprint 变化都会被视为程序漂移。" : "Repair is format-only. Any change to snapshot, pins, actor coverage, or payload fingerprint is procedural drift.";
  if (state === "selector_actor_drift") return zh ? "实际 Prompt 中出现的 latest-round actors 与 selector audit 不一致；这属于审计/交付漂移，不是观点分歧。" : "Latest-round actors visible in the actual Prompt disagreed with selector audit. That is delivery/audit drift, not a substantive disagreement.";
  if (state === "legacy_unverified") return zh ? "旧 archive 只保留当时真实存在的证据，不会被今天的算法事后升级。" : "Legacy archives retain only evidence that actually existed at the time and are never upgraded post-hoc.";
  return zh ? "现代 selector 记录存在，但至少一个席位缺少 actual Prompt 票据，因此不能盖 VERIFIED。" : "Modern selector evidence exists, but at least one seat lacks actual Prompt proof, so VERIFIED would overclaim.";
}
