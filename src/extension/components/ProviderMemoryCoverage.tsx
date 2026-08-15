import type { Locale } from "../../i18n/index.js";
import type {
  ProviderMemoryCoverageModel,
  ProviderMemoryRound,
  ProviderPinnedMemoryIssue,
} from "../../theater/provider-memory-coverage.js";
import "./provider-memory-coverage.css";

interface ProviderMemoryCoverageProps {
  model: ProviderMemoryCoverageModel;
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

export function ProviderMemoryCoverage({
  model,
  locale,
  archive = false,
  onFocusEvent,
}: ProviderMemoryCoverageProps) {
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
      data-provider-memory-consistent={model.allSharedSnapshotsConsistent ? "true" : "false"}
    >
      <header>
        <div>
          <span>{zh ? "上下文记忆收据" : "PROVIDER MEMORY COVERAGE"}</span>
          <strong>{zh ? "这些 AI 这一轮到底看见了哪些公共会议记忆？" : "Which public meeting memory actually reached each Provider turn?"}</strong>
          <p>{zh
            ? "ChatChat 公开 12-event 上下文预算的真实组成：最新轮次先保护，旧但仍未解决的结构化争议可以被 pin 回来，其余普通历史按预算省略。pin 只代表记忆优先级，不代表权威或真理。"
            : "ChatChat exposes the real 12-event public-context accounting: protect the newest round first, pin older structurally unresolved conflicts when needed, and omit ordinary older history under budget. Pinning is memory priority, never authority or truth."}</p>
        </div>
        <div className="provider-memory-summary">
          <b>{model.contextBudget}<small>{zh ? "最大公共事件" : "max public events"}</small></b>
          <b>{model.roundsWithPinnedMemory}<small>{zh ? "轮使用旧争议 pin" : "rounds used pins"}</small></b>
          <b className={model.allSharedSnapshotsConsistent ? "is-ok" : "is-bad"}>{model.allSharedSnapshotsConsistent ? "✓" : "!"}<small>{zh ? "同轮共享快照" : "shared snapshot"}</small></b>
        </div>
      </header>

      {archive ? (
        <div className="provider-memory-archive">↺ {zh ? "历史回放：从冻结 execution receipt 重建，不会重新调用 Provider。" : "Archive replay: reconstructed from the frozen execution receipt; no Provider calls."}</div>
      ) : null}

      <div className="provider-memory-rounds">
        {visible.map((round) => (
          <MemoryRoundCard
            key={round.key}
            round={round}
            zh={zh}
            onFocusEvent={onFocusEvent}
          />
        ))}
      </div>
    </section>
  );
}

function MemoryRoundCard({
  round,
  zh,
  onFocusEvent,
}: {
  round: ProviderMemoryRound;
  zh: boolean;
  onFocusEvent(eventId: string): void;
}) {
  const free = Math.max(0, round.contextBudget - round.snapshotCount);
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
      data-provider-memory-shared={round.snapshotsConsistent ? "true" : "false"}
    >
      <div className="provider-memory-round__top">
        <div>
          <span>{round.phase.toUpperCase()} · R{round.round}</span>
          <strong>{round.snapshotCount}/{round.contextBudget} {zh ? "公共上下文槽" : "public context slots"}</strong>
        </div>
        <div className="provider-memory-round__delivery">
          <b>{round.receivedSeatCount}/{round.seatCount}</b>
          <small>{zh ? "席位页面返回" : "seat responses"}</small>
          <em>{round.snapshotsConsistent ? (zh ? "✓ 同一快照" : "✓ SAME SNAPSHOT") : (zh ? "! 快照不一致" : "! SNAPSHOT MISMATCH")}</em>
        </div>
      </div>

      <div className="provider-memory-bar" aria-label={zh ? "上下文预算组成" : "Context budget composition"}>
        {round.latestRoundEventIds.length ? <i className="latest" style={{ flexGrow: round.latestRoundEventIds.length }} title={zh ? "最新轮次保护" : "Latest round protected"} /> : null}
        {round.pinnedEventIds.length ? <i className="pinned" style={{ flexGrow: round.pinnedEventIds.length }} title={zh ? "旧未决争议 pin" : "Old unresolved conflict pins"} /> : null}
        {round.ordinaryRecentEventIds.length ? <i className="ordinary" style={{ flexGrow: round.ordinaryRecentEventIds.length }} title={zh ? "普通近期历史" : "Ordinary recent history"} /> : null}
        {free ? <i className="free" style={{ flexGrow: free }} title={zh ? "未使用槽位" : "Unused slots"} /> : null}
      </div>

      <div className="provider-memory-legend">
        <span className="latest">● {round.latestRoundEventIds.length} {zh ? "最新轮保护" : "latest protected"}</span>
        <span className="pinned">● {round.pinnedEventIds.length} {zh ? "旧争议 pin" : "old conflict pins"}</span>
        <span className="ordinary">● {round.ordinaryRecentEventIds.length} {zh ? "普通近期" : "ordinary recent"}</span>
        <span>⌁ {round.omittedEventIds.length} {zh ? "更旧普通事件被省略" : "older ordinary omitted"}</span>
      </div>

      {round.pinnedIssues.length ? (
        <div className="provider-memory-pins">
          <span>{zh ? "为什么这些旧事件被带回来" : "WHY OLD EVENTS WERE BROUGHT BACK"}</span>
          {round.pinnedIssues.map((issue) => (
            <PinnedIssue key={issue.sourceEventId} issue={issue} zh={zh} onFocusEvent={onFocusEvent} />
          ))}
        </div>
      ) : round.availableCount > round.contextBudget ? (
        <div className="provider-memory-no-pin">{zh
          ? "本轮历史已超过预算，但没有旧未决 obligation 需要 pin；槽位用于最新轮次与普通近期事件。"
          : "History exceeded the budget, but no old unresolved obligation needed pinning; slots went to the latest round and ordinary recent events."}</div>
      ) : (
        <div className="provider-memory-no-pin">{zh
          ? "当前公共历史还没有挤满 12-event 预算，不需要恢复旧争议。"
          : "The public history still fits inside the 12-event budget; no old conflict restoration was needed."}</div>
      )}

      <details>
        <summary>{zh ? "查看这轮精确 memory IDs" : "Exact memory IDs"}</summary>
        <MemoryIdGroup label={zh ? "最新轮保护" : "Latest round protected"} ids={round.latestRoundEventIds} onFocusEvent={onFocusEvent} />
        <MemoryIdGroup label={zh ? "旧争议 pin 事件" : "Pinned old conflict events"} ids={round.pinnedEventIds} onFocusEvent={onFocusEvent} />
        <MemoryIdGroup label={zh ? "普通近期事件" : "Ordinary recent events"} ids={round.ordinaryRecentEventIds} onFocusEvent={onFocusEvent} />
        <MemoryIdGroup label={zh ? "被预算省略" : "Omitted by budget"} ids={round.omittedEventIds} onFocusEvent={onFocusEvent} />
      </details>
    </article>
  );
}

function PinnedIssue({
  issue,
  zh,
  onFocusEvent,
}: {
  issue: ProviderPinnedMemoryIssue;
  zh: boolean;
  onFocusEvent(eventId: string): void;
}) {
  const label = ISSUE[issue.kind][zh ? "zh" : "en"];
  return (
    <div
      className={`provider-memory-pin ${issue.stillOpenAtMeetingEnd ? "is-open" : "is-later-resolved"}`}
      data-provider-memory-pinned-source={issue.sourceEventId}
      data-provider-memory-pinned-kind={issue.kind}
      data-provider-memory-pinned-opened-round={issue.openedRound}
      {...(issue.resolverEventId ? { "data-provider-memory-resolver-event": issue.resolverEventId } : {})}
      {...(issue.resolvedRound != null ? { "data-provider-memory-resolved-round": issue.resolvedRound } : {})}
    >
      <button type="button" onClick={() => onFocusEvent(issue.sourceEventId)}>
        <span>📌 {label} · R{issue.openedRound}</span>
        <strong>{issue.sourceActorName}{issue.targetActorName ? ` → ${issue.targetActorName}` : ""}</strong>
        <p>{issue.sourceExcerpt}</p>
        <i>↗</i>
      </button>
      {issue.resolverEventId ? (
        <button className="provider-memory-pin__resolver" type="button" onClick={() => onFocusEvent(issue.resolverEventId!)}>
          <span>{zh ? "后来由精确事件关闭" : "LATER CLOSED BY EXACT EVENT"} · R{issue.resolvedRound}</span>
          <strong>{issue.resolverActorName}</strong>
          <code>{shortId(issue.resolverEventId)}</code>
          <i>↗</i>
        </button>
      ) : (
        <div className="provider-memory-pin__open">{zh ? "闭会时仍未决，所以后续轮次仍有资格被 pin" : "Still unresolved at close, so later turns may continue pinning it"}</div>
      )}
    </div>
  );
}

function MemoryIdGroup({
  label,
  ids,
  onFocusEvent,
}: {
  label: string;
  ids: readonly string[];
  onFocusEvent(eventId: string): void;
}) {
  if (!ids.length) return null;
  return (
    <p><b>{label}</b>{ids.map((id) => <button type="button" key={id} onClick={() => onFocusEvent(id)}><code>{id}</code></button>)}</p>
  );
}

function shortId(value: string): string {
  return value.length <= 18 ? value : `${value.slice(0, 8)}…${value.slice(-6)}`;
}
