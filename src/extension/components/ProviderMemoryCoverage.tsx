import type { Locale } from "../../i18n/index.js";
import type {
  ProviderMemoryCoverageModel,
  ProviderMemoryRound,
  ProviderPinnedMemoryIssue,
} from "../../theater/provider-memory-coverage.js";
import type { MeetingMemoryIntegrity } from "../../theater/meeting-memory-integrity.js";
import "./provider-memory-coverage.css";

interface ProviderMemoryCoverageProps {
  model: ProviderMemoryCoverageModel;
  integrity: MeetingMemoryIntegrity;
  locale: Locale;
  archive?: boolean;
  onFocusEvent(eventId: string): void;
}

const ISSUE = {
  open_question: { en: "question", zh: "追问" },
  challenged_claim: { en: "challenge", zh: "质疑" },
  evidence_awaiting_response: { en: "evidence", zh: "证据回应" },
  explicit_uncertainty: { en: "uncertainty", zh: "明确不确定" },
} as const;

export function ProviderMemoryCoverage({ model, integrity, locale, archive = false, onFocusEvent }: ProviderMemoryCoverageProps) {
  const zh = locale === "zh-CN";
  if (!model.rounds.length) return null;
  const visible = model.rounds.slice(-5).reverse();
  return (
    <section
      className={`provider-memory-coverage ${archive ? "is-archive" : ""}`}
      data-provider-memory-coverage="audited"
      data-provider-memory-session={model.sessionId ?? ""}
      data-provider-memory-budget={model.contextBudget}
      data-provider-memory-pinned-rounds={model.roundsWithPinnedMemory}
      data-provider-memory-actual-prompt-turns={model.actualPromptTurnCount}
      data-provider-memory-total-turns={model.turns.length}
      data-provider-memory-selector-mismatches={model.selectorMismatchTurnCount}
      data-provider-memory-consistent={model.allSharedSnapshotsConsistent ? "true" : "false"}
      data-provider-memory-selector-consistent={model.allPromptSelectorConsistent ? "true" : "false"}
      data-provider-memory-integrity={integrity.protocolState}
      data-provider-memory-evidence={integrity.evidenceStrength}
    >
      <header>
        <div>
          <span>{zh ? "上下文记忆收据" : "PROVIDER MEMORY COVERAGE"}</span>
          <strong>{zh ? "这些 AI 这一轮到底看见了哪些公共会议记忆？" : "Which public meeting memory actually reached each Provider turn?"}</strong>
          <p>{zh
            ? "ChatChat 公开固定公共上下文预算的真实组成：最新轮先保护，旧但仍未解决的结构化 obligation 可以被带回来，其余普通历史按预算省略。Actual Prompt 证据来自真正进入 RUN_SPEECH 的字符串；selector audit 是独立对账来源。Pin 只代表覆盖优先级，不代表重要、正确、权威或票权。"
            : "ChatChat exposes the bounded public-context accounting: protect the newest round first, restore older structurally unresolved obligations when needed, and omit ordinary older history under budget. Actual Prompt evidence comes from the exact RUN_SPEECH string; selector audit remains an independent comparison source. A pin means coverage priority only — never importance, correctness, authority, or vote weight."}</p>
        </div>
        <div className="provider-memory-summary">
          <b>{model.contextBudget}<small>{zh ? "最大公共事件" : "max public events"}</small></b>
          <b>{model.actualPromptTurnCount}/{model.turns.length}<small>{zh ? "实际 Prompt 票据" : "actual prompt proof"}</small></b>
          <b>{model.roundsWithPinnedMemory}<small>{zh ? "轮使用旧争议 pin" : "rounds used pins"}</small></b>
          <b className={model.allSharedSnapshotsConsistent ? "is-ok" : "is-bad"}>{model.allSharedSnapshotsConsistent ? "✓" : "!"}<small>{zh ? "同轮公共记忆公平" : "peer memory fairness"}</small></b>
          <b className={model.allPromptSelectorConsistent ? "is-ok" : "is-bad"}>{model.allPromptSelectorConsistent ? "✓" : `!${model.selectorMismatchTurnCount}`}<small>selector ↔ Prompt</small></b>
        </div>
      </header>

      <div className={`provider-memory-integrity state-${integrity.protocolState}`} data-memory-integrity-state={integrity.protocolState}>
        <b>{integrityTitle(integrity, zh)}</b>
        <span>{integrityBody(integrity, zh)}</span>
      </div>

      {archive ? (
        <div className="provider-memory-archive">↺ {zh
          ? "历史回放：只读取冻结的 execution receipt 与 Blackboard，不重新调用 Provider。旧记录若早于 actual-Prompt metadata，会保留 legacy 标记，绝不事后升级证明强度。"
          : "Archive replay: reconstructed only from frozen execution receipts and Blackboard events; no Provider calls. Records that predate actual-Prompt metadata keep a legacy label and are never upgraded after the fact."}</div>
      ) : null}

      <div className="provider-memory-rounds">
        {visible.map((round) => <MemoryRoundCard key={round.key} round={round} zh={zh} onFocusEvent={onFocusEvent} />)}
      </div>
    </section>
  );
}

function MemoryRoundCard({ round, zh, onFocusEvent }: { round: ProviderMemoryRound; zh: boolean; onFocusEvent(eventId: string): void }) {
  const free = Math.max(0, round.contextBudget - round.snapshotCount);
  const allActual = round.actualPromptSeatCount === round.seatCount && round.seatCount > 0;
  const evidenceLabel = allActual
    ? "ACTUAL PROMPT"
    : round.legacySelectorSeatCount
      ? `${round.legacySelectorSeatCount} LEGACY`
      : `${round.actualPromptSeatCount}/${round.seatCount} ${zh ? "Prompt 票据" : "prompt proof"}`;
  return (
    <article
      className={`provider-memory-round ${round.pinnedEventIds.length ? "has-pins" : ""} ${round.snapshotsConsistent ? "is-consistent" : "is-mismatch"}`}
      data-provider-memory-round={round.round}
      data-provider-memory-phase={round.phase}
      data-provider-memory-snapshot-count={round.snapshotCount}
      data-provider-memory-available-count={round.availableCount}
      data-provider-memory-pinned-count={round.pinnedEventIds.length}
      data-provider-memory-pinned-source-count={round.pinnedIssueSourceEventIds.length}
      data-provider-memory-latest-count={round.latestRoundEventIds.length}
      data-provider-memory-ordinary-count={round.ordinaryRecentEventIds.length}
      data-provider-memory-omitted-count={round.omittedEventIds.length}
      data-provider-memory-actual-prompt-seats={round.actualPromptSeatCount}
      data-provider-memory-selector-mismatch-seats={round.selectorMismatchSeatCount}
      data-provider-memory-seat-count={round.seatCount}
      data-provider-memory-shared={round.snapshotsConsistent ? "true" : "false"}
    >
      <div className="provider-memory-round__top">
        <div><span>{round.phase.toUpperCase()} · R{round.round}</span><strong>{round.availableCount} → {round.snapshotCount}/{round.contextBudget} {zh ? "公共上下文槽" : "public context slots"}</strong></div>
        <div className="provider-memory-round__delivery">
          <b>{round.receivedSeatCount}/{round.seatCount}</b><small>{zh ? "席位页面返回" : "seat responses"}</small>
          <em>{round.snapshotsConsistent ? (zh ? "✓ 同一公共快照" : "✓ SAME PUBLIC SNAPSHOT") : (zh ? "! 同轮 Provider 快照不同" : "! PROVIDER SNAPSHOT MISMATCH")}</em>
          <em className={allActual ? "is-prompt" : "is-fallback"}>{evidenceLabel}</em>
          <em className={round.selectorMismatchSeatCount ? "is-fallback" : "is-prompt"}>{round.selectorMismatchSeatCount ? `! ${round.selectorMismatchSeatCount} ${zh ? "selector 漂移" : "selector drift"}` : (zh ? "✓ selector = Prompt" : "✓ SELECTOR = PROMPT")}</em>
        </div>
      </div>
      <div className="provider-memory-bar" aria-label={zh ? "上下文预算组成" : "Context budget composition"}>
        {round.latestRoundEventIds.length ? <i className="latest" style={{ flexGrow: round.latestRoundEventIds.length }} /> : null}
        {round.pinnedEventIds.length ? <i className="pinned" style={{ flexGrow: round.pinnedEventIds.length }} /> : null}
        {round.ordinaryRecentEventIds.length ? <i className="ordinary" style={{ flexGrow: round.ordinaryRecentEventIds.length }} /> : null}
        {free ? <i className="free" style={{ flexGrow: free }} /> : null}
      </div>
      <div className="provider-memory-legend">
        <span className="latest">● {round.latestRoundEventIds.length} {zh ? "最新轮保护" : "latest protected"}</span>
        <span className="pinned">● {round.pinnedEventIds.length} {zh ? "旧未决 pin" : "old unresolved pins"}</span>
        <span className="ordinary">● {round.ordinaryRecentEventIds.length} {zh ? "普通近期" : "ordinary recent"}</span>
        <span>⌁ {round.omittedEventIds.length} {zh ? "较旧普通事件省略" : "older ordinary omitted"}</span>
      </div>
      {round.pinnedIssues.length ? (
        <div className="provider-memory-pins"><span>{zh ? "为什么这些旧事件被带回来" : "WHY OLD EVENTS WERE BROUGHT BACK"}</span>{round.pinnedIssues.map((issue) => <PinnedIssue key={issue.sourceEventId} issue={issue} zh={zh} onFocusEvent={onFocusEvent} />)}</div>
      ) : (
        <div className="provider-memory-no-pin">{round.availableCount > round.contextBudget
          ? (zh ? "历史超过预算，但没有旧 canonical-open obligation 需要恢复；槽位由最新轮与普通近期事件占用。" : "History exceeded the budget, but no old canonical-open obligation needed restoration; slots went to newest-round and ordinary recent events.")
          : (zh ? "公共历史仍能放进预算，不需要恢复旧争议。" : "The public history still fits the budget; no old conflict restoration was needed.")}</div>
      )}
      <details><summary>{zh ? "查看精确 memory IDs" : "Exact memory IDs"}</summary>
        <MemoryIdGroup label={zh ? "最新轮保护" : "Latest protected"} ids={round.latestRoundEventIds} onFocusEvent={onFocusEvent} />
        <MemoryIdGroup label={zh ? "旧未决 pin" : "Pinned old unresolved"} ids={round.pinnedEventIds} onFocusEvent={onFocusEvent} />
        <MemoryIdGroup label={zh ? "普通近期" : "Ordinary recent"} ids={round.ordinaryRecentEventIds} onFocusEvent={onFocusEvent} />
        <MemoryIdGroup label={zh ? "硬预算省略" : "Omitted by hard budget"} ids={round.omittedEventIds} onFocusEvent={onFocusEvent} />
      </details>
    </article>
  );
}

function PinnedIssue({ issue, zh, onFocusEvent }: { issue: ProviderPinnedMemoryIssue; zh: boolean; onFocusEvent(eventId: string): void }) {
  const label = ISSUE[issue.kind][zh ? "zh" : "en"];
  return <div className={`provider-memory-pin ${issue.stillOpenAtMeetingEnd ? "is-open" : "is-later-resolved"}`} data-provider-memory-pinned-source={issue.sourceEventId} {...(issue.resolverEventId ? { "data-provider-memory-resolver-event": issue.resolverEventId } : {})}>
    <button type="button" onClick={() => onFocusEvent(issue.sourceEventId)}><span>📌 {label} · R{issue.openedRound}</span><strong>{issue.sourceActorName}{issue.targetActorName ? ` → ${issue.targetActorName}` : ""}</strong><p>{issue.sourceExcerpt}</p><i>↗</i></button>
    {issue.resolverEventId ? <button className="provider-memory-pin__resolver" type="button" onClick={() => onFocusEvent(issue.resolverEventId!)}><span>{zh ? "后来由精确事件关闭" : "LATER CLOSED BY EXACT EVENT"} · R{issue.resolvedRound}</span><strong>{issue.resolverActorName}</strong><code>{shortId(issue.resolverEventId)}</code><i>↗</i></button> : <div className="provider-memory-pin__open">{zh ? "闭会时仍未决；后续轮次仍可获得 pin 资格" : "Still unresolved at close; later turns may continue restoring it"}</div>}
  </div>;
}

function MemoryIdGroup({ label, ids, onFocusEvent }: { label: string; ids: readonly string[]; onFocusEvent(eventId: string): void }) {
  if (!ids.length) return null;
  return <p><b>{label}</b>{ids.map((id) => <button type="button" key={id} onClick={() => onFocusEvent(id)}><code>{id}</code></button>)}</p>;
}

function integrityTitle(integrity: MeetingMemoryIntegrity, zh: boolean): string {
  if (integrity.protocolState === "verified") return zh ? "公共记忆协议已验证" : "Public memory protocol verified";
  if (integrity.protocolState === "bounded_coverage") return zh ? "公共记忆受硬预算限制" : "Public memory has bounded coverage";
  if (integrity.protocolState === "selector_drift") return zh ? "Selector 与实际 Prompt 不一致" : "Selector drift from actual Prompt";
  if (integrity.protocolState === "peer_fairness_violation") return zh ? "同轮 Provider 公共记忆不一致" : "Same-round Provider memory fairness violation";
  return zh ? "旧记录：记忆证明强度不足" : "Legacy record: memory proof is not modern-verifiable";
}

function integrityBody(integrity: MeetingMemoryIntegrity, zh: boolean): string {
  const proof = `${integrity.actualPromptTurns}/${integrity.auditedTurns} ${zh ? "轮有 actual Prompt 票据" : "turns have actual Prompt proof"}`;
  if (integrity.protocolState === "bounded_coverage") return `${proof} · ${integrity.gapTurns} ${zh ? "轮存在 canonical-open coverage gap；这不是重要性或正确性判断。" : "turn(s) contain canonical-open coverage gaps; this is not importance or correctness."}`;
  if (integrity.protocolState === "selector_drift") return `${proof} · ${integrity.selectorMismatchTurns} ${zh ? "轮 selector 与 actual Prompt metadata 不一致。" : "turn(s) disagree between selector audit and actual Prompt metadata."}`;
  if (integrity.protocolState === "peer_fairness_violation") return `${proof} · ${integrity.peerMismatchRounds} ${zh ? "轮的平等参与者没有拿到同一公共 deck。" : "round(s) gave equal peers different public decks."}`;
  if (integrity.protocolState === "legacy_unverified") return zh ? "这场旧会议缺少现代 Prompt-memory provenance；保留 selector-only 历史，但不事后升级成 actual Prompt 证明。" : "This older meeting predates modern Prompt-memory provenance. Selector-only history is preserved without post-hoc upgrading.";
  return `${proof} · ${zh ? "同轮公共 deck 一致，selector 与实际 Prompt 未发现漂移。" : "same-round public decks match and no selector↔Prompt drift was observed."}`;
}

function shortId(value: string): string { return value.length <= 18 ? value : `${value.slice(0, 8)}…${value.slice(-6)}`; }
