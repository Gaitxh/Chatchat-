import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CouncilReport } from "../core/types.js";
import type { ConsultationArchive } from "../history/consultation-history.js";
import { ExecutionAuditHistoryStore } from "../history/execution-audit-history.js";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import {
  PROVIDER_EXECUTION_AUDIT_EVENT,
  cloneProviderExecutionAudit,
  type ProviderExecutionAuditEvent,
} from "../provider-sdk/execution-audit.js";
import {
  deriveProviderContextMemory,
  type ProviderContextMemoryTurn,
} from "../theater/context-memory.js";
import "./context-memory-portal.css";

const LIVE_EVENT = "chatchat:consultation-live";
const COMPLETE_EVENT = "chatchat:consultation-complete";
const OPEN_ARCHIVE_EVENT = "chatchat:consultation-open-archive";
const executionHistory = new ExecutionAuditHistoryStore();

interface CompletionDetail {
  report?: CouncilReport;
}

interface ArchiveDetail {
  archive?: ConsultationArchive;
}

interface MemoryView {
  sessionId: string;
  archive: boolean;
  events: ProviderExecutionAuditEvent[];
}

function ContextMemoryPortal() {
  const [view, setView] = useState<MemoryView | null>(null);
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));

  useEffect(() => {
    const onLive = () => {
      setView((current) => current?.archive ? null : current);
    };
    const onAudit = (event: Event) => {
      const detail = (event as CustomEvent<ProviderExecutionAuditEvent>).detail;
      if (!detail?.sessionId || !detail.actorId) return;
      setView((current) => {
        const base = current?.sessionId === detail.sessionId && !current.archive ? current.events : [];
        return {
          sessionId: detail.sessionId,
          archive: false,
          events: [...base, cloneProviderExecutionAudit(detail)].slice(-720),
        };
      });
    };
    const onComplete = (event: Event) => {
      const sessionId = (event as CustomEvent<CompletionDetail>).detail?.report?.sessionId;
      if (!sessionId) return;
      setView((current) => current?.sessionId === sessionId ? { ...current, archive: false } : current);
    };
    const onArchive = (event: Event) => {
      const archive = (event as CustomEvent<ArchiveDetail>).detail?.archive;
      if (!archive?.sessionId) return;
      setView({ sessionId: archive.sessionId, archive: true, events: [] });
      void executionHistory.load(archive.sessionId).then((saved) => {
        setView((current) => {
          if (!current?.archive || current.sessionId !== archive.sessionId) return current;
          return {
            sessionId: archive.sessionId,
            archive: true,
            events: saved?.execution.map(cloneProviderExecutionAudit) ?? [],
          };
        });
      }).catch(() => {
        setView((current) => current?.archive && current.sessionId === archive.sessionId
          ? { ...current, events: [] }
          : current);
      });
    };

    window.addEventListener(LIVE_EVENT, onLive);
    window.addEventListener(PROVIDER_EXECUTION_AUDIT_EVENT, onAudit);
    window.addEventListener(COMPLETE_EVENT, onComplete);
    window.addEventListener(OPEN_ARCHIVE_EVENT, onArchive);
    return () => {
      window.removeEventListener(LIVE_EVENT, onLive);
      window.removeEventListener(PROVIDER_EXECUTION_AUDIT_EVENT, onAudit);
      window.removeEventListener(COMPLETE_EVENT, onComplete);
      window.removeEventListener(OPEN_ARCHIVE_EVENT, onArchive);
    };
  }, []);

  useEffect(() => {
    const observer = new MutationObserver(() => setLocale(normalizeLocale(document.documentElement.lang)));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => observer.disconnect();
  }, []);

  const model = useMemo(() => deriveProviderContextMemory(view?.events ?? []), [view?.events]);
  useEffect(() => {
    const root = document.getElementById("context-memory-root");
    if (!root || !model.turns.length) return;
    const execution = document.getElementById("execution-provenance-root");
    if (execution?.parentElement) execution.insertAdjacentElement("afterend", root);
  }, [model.turns.length]);

  if (!view || !model.turns.length) return null;
  const zh = locale === "zh-CN";
  const visible = [...model.turns]
    .sort((a, b) => b.round - a.round || b.observedAt.localeCompare(a.observedAt))
    .slice(0, 12);

  return (
    <section
      className={`context-memory-audit ${view.archive ? "is-archive" : "is-live"}`}
      data-context-memory-audit="visible"
      data-context-memory-session={view.sessionId}
      data-context-memory-pinned-turns={model.pinnedTurnCount}
      data-context-memory-legacy-turns={model.legacyTurnCount}
    >
      <header>
        <div>
          <span>{zh ? "上下文记忆审计" : "CONTEXT MEMORY AUDIT"}</span>
          <strong>{zh ? "哪些旧未决事件被带回了这一轮 Provider 视野？" : "Which old unresolved events were restored into this Provider turn?"}</strong>
          <p>{zh
            ? "Provider 上下文仍有固定事件预算。最新公开轮次先保护；只有快被窗口挤掉、仍有结构化义务的旧事件才会被 pin 回来。Pin 只改变记忆覆盖，不增加权威。"
            : "Provider context keeps a fixed event budget. The newest public round is protected first; only older structurally unresolved events that would fall out of the window are pinned back. Pinning changes memory coverage, not authority."}</p>
        </div>
        <div className="context-memory-summary">
          <b>{model.turns.length}<small>{zh ? "轮审计" : "turns"}</small></b>
          <b>{model.pinnedTurnCount}<small>{zh ? "发生 pin" : "pinned"}</small></b>
        </div>
      </header>

      {view.archive ? <div className="context-memory-archive">↺ {zh ? "历史收据：只读取闭会时冻结的 execution audit，不重新调用 Provider。" : "Historical receipt: frozen execution audit only; no Provider calls."}</div> : null}

      <div className="context-memory-turns">
        {visible.map((turn) => <MemoryTurnCard key={turn.key} turn={turn} zh={zh} />)}
      </div>
      <footer>{zh
        ? "Pin ≠ 重要性评分 · Pin ≠ 正确性 · Pin ≠ 投票权。它只防止仍未回应的结构化义务被时间窗口遗忘。"
        : "Pin ≠ importance score · Pin ≠ correctness · Pin ≠ vote weight. It only prevents unresolved structured obligations from aging out of the bounded memory window."}</footer>
    </section>
  );
}

function MemoryTurnCard({ turn, zh }: { turn: ProviderContextMemoryTurn; zh: boolean }) {
  const pinned = turn.pinnedOpenIssueEventIds;
  const latest = turn.latestRoundEventIds;
  return (
    <article
      className={`context-memory-turn ${pinned?.length ? "has-pins" : ""} ${turn.legacySelectionAudit ? "is-legacy" : ""}`}
      data-context-memory-turn={turn.key}
      data-context-memory-round={turn.round}
      data-context-memory-snapshot-count={turn.snapshotEventIds.length}
      {...(pinned ? { "data-context-memory-pinned-count": pinned.length } : {})}
      {...(latest ? { "data-context-memory-latest-count": latest.length } : {})}
    >
      <div className="context-memory-turn__head">
        <strong>{turn.actorName}</strong>
        <span>{turn.phase.toUpperCase()} · R{turn.round}</span>
      </div>
      <div className="context-memory-turn__metrics">
        <span><b>{turn.snapshotEventIds.length}</b>{zh ? "快照" : "snapshot"}</span>
        {turn.legacySelectionAudit ? (
          <span className="legacy">— {zh ? "旧版选择审计" : "legacy selection audit"}</span>
        ) : (
          <>
            <span className={pinned?.length ? "pinned" : ""}><b>{pinned?.length ?? 0}</b>{zh ? "旧未决 pin" : "pinned old issues"}</span>
            <span><b>{latest?.length ?? 0}</b>{zh ? "最新轮保护" : "latest-round protected"}</span>
          </>
        )}
      </div>
      {pinned?.length ? (
        <div className="context-memory-turn__ids" data-context-memory-pinned-ids="visible">
          <span>{zh ? "被恢复的事件 ID" : "RESTORED EVENT IDS"}</span>
          {pinned.slice(0, 6).map((eventId) => <code key={eventId}>{eventId}</code>)}
        </div>
      ) : null}
    </article>
  );
}

const root = document.getElementById("context-memory-root");
if (!root) throw new Error("ChatChat Context Memory Audit root is missing.");
createRoot(root).render(<StrictMode><ContextMemoryPortal /></StrictMode>);
