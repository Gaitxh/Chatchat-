import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CouncilPhase } from "../core/types.js";
import {
  PROVIDER_TRANSPORT_AUDIT_EVENT,
  type ProviderTransportAuditRecord,
} from "../provider-sdk/transport-audit.js";
import {
  providerPublicDeckAuditForRound,
  type ProviderPublicDeckAudit,
} from "../provider-sdk/public-deck-audit.js";
import "./public-deck-integrity-portal.css";

type MeetingPhase = CouncilPhase;

type AuditState = "waiting" | "exact" | "mismatch";

interface ObservedRoundAudit {
  key: string;
  observedAt: string;
  audit: ProviderPublicDeckAudit;
}

const MAX_VISIBLE_ROUNDS = 6;

function PublicDeckIntegrityPortal() {
  const [rounds, setRounds] = useState<Record<string, ObservedRoundAudit>>({});
  const zh = document.documentElement.lang.toLowerCase().startsWith("zh");

  useEffect(() => {
    const onTransport = (event: Event) => {
      const detail = (event as CustomEvent<ProviderTransportAuditRecord>).detail;
      if (!detail?.sessionId || !isMeetingPhase(detail.phase)) return;

      // `sending` can fire before the inner exact-Prompt observer has run. The
      // received/failed receipt will refresh this audit after RUN_SPEECH passed
      // through the real browser API; a zero-delay refresh also covers wrappers
      // that dispatch in the opposite order.
      window.setTimeout(() => {
        const audit = providerPublicDeckAuditForRound({
          sessionId: detail.sessionId,
          phase: detail.phase,
          round: detail.round,
        });
        const key = roundKey(audit);
        setRounds((current) => trimRounds({
          ...current,
          [key]: {
            key,
            observedAt: new Date().toISOString(),
            audit,
          },
        }));
      }, 0);
    };

    window.addEventListener(PROVIDER_TRANSPORT_AUDIT_EVENT, onTransport);
    return () => window.removeEventListener(PROVIDER_TRANSPORT_AUDIT_EVENT, onTransport);
  }, []);

  const ordered = useMemo(
    () => Object.values(rounds)
      .sort((left, right) => right.observedAt.localeCompare(left.observedAt))
      .slice(0, MAX_VISIBLE_ROUNDS),
    [rounds],
  );

  if (!ordered.length) return null;
  const latestSessionId = ordered[0]?.audit.sessionId;
  const visible = ordered.filter((item) => item.audit.sessionId === latestSessionId);
  const overallState = visible.some((item) => stateForAudit(item.audit) === "mismatch")
    ? "mismatch"
    : visible.some((item) => stateForAudit(item.audit) === "exact")
      ? "exact"
      : "waiting";

  return (
    <section
      className={`public-deck-integrity state-${overallState}`}
      data-public-deck-integrity={overallState}
      aria-live="polite"
    >
      <header>
        <div>
          <span>{zh ? "公共议政板一致性" : "PUBLIC BLACKBOARD DECK INTEGRITY"}</span>
          <strong>{zh ? "平等席位真的拿到同一副公开牌吗？" : "Did equal seats actually receive the same public deck?"}</strong>
          <p>{zh
            ? "这里比较真实发送给 Provider 标签页的 CONSULTATION_EVENTS_JSON 原始序列化内容，不只比较事件 ID，也不读取模型隐藏思维。"
            : "This compares the exact serialized CONSULTATION_EVENTS_JSON actually sent to Provider tabs — not only event IDs, and never hidden model reasoning."}</p>
        </div>
        <b>{overallBadge(overallState, zh)}</b>
      </header>

      <div className="public-deck-rounds">
        {visible.map(({ key, audit }) => {
          const state = stateForAudit(audit);
          const group = audit.peerDeckGroups[0];
          return (
            <article
              key={key}
              className={`public-deck-round state-${state}`}
              data-peer-deck-equal={audit.peerDecksExactlyEqual === null ? "unknown" : String(audit.peerDecksExactlyEqual)}
              data-repair-deck-preserved={audit.repairDecksExactlyPreserved === null ? "not-used" : String(audit.repairDecksExactlyPreserved)}
            >
              <div className="public-deck-round__top">
                <strong>{audit.phase.toUpperCase()} · R{audit.round}</strong>
                <span>{roundStatus(audit, zh)}</span>
              </div>
              <div className="public-deck-round__meta">
                <em>{zh ? `已观察 ${audit.firstAttemptActors.length} 个首轮席位` : `${audit.firstAttemptActors.length} first-attempt seat(s) observed`}</em>
                {group?.fingerprint ? <code title={zh ? "仅用于诊断显示；精确相等判断直接比较原始 payload" : "Diagnostic only; exact equality compares the raw payload directly"}>{shortFingerprint(group.fingerprint)}</code> : null}
                {audit.repairAttemptActors.length ? <em>{zh ? `${audit.repairAttemptActors.length} 次 repair` : `${audit.repairAttemptActors.length} repair attempt(s)`}</em> : null}
              </div>
              {state === "mismatch" ? (
                <p className="public-deck-warning">{mismatchDetail(audit, zh)}</p>
              ) : audit.repairDecksExactlyPreserved === true ? (
                <p className="public-deck-repair-ok">✓ {zh ? "格式修复沿用了同一副公共牌，没有趁 repair 改变共享上下文。" : "Structured repair reused the exact same public deck; shared context did not change during repair."}</p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function stateForAudit(audit: ProviderPublicDeckAudit): AuditState {
  if (audit.peerDecksExactlyEqual === false || audit.repairDecksExactlyPreserved === false) return "mismatch";
  if (audit.peerDecksExactlyEqual === true) return "exact";
  return "waiting";
}

function overallBadge(state: AuditState, zh: boolean): string {
  if (state === "mismatch") return zh ? "⚠ 不一致" : "⚠ MISMATCH";
  if (state === "exact") return zh ? "✓ 同牌" : "✓ SAME DECK";
  return zh ? "观察中" : "OBSERVING";
}

function roundStatus(audit: ProviderPublicDeckAudit, zh: boolean): string {
  if (audit.peerDecksExactlyEqual === false) return zh ? "发现同轮公共牌不一致" : "Peer public decks differ";
  if (audit.repairDecksExactlyPreserved === false) return zh ? "repair 改变了公共牌" : "Repair changed the public deck";
  if (audit.peerDecksExactlyEqual === true) {
    return zh
      ? `${audit.firstAttemptActors.length} 个平等席位逐字同牌`
      : `${audit.firstAttemptActors.length} equal seats · byte-identical deck`;
  }
  return zh ? "等待至少第二个同轮 Provider 回执" : "Waiting for a second peer receipt in this round";
}

function mismatchDetail(audit: ProviderPublicDeckAudit, zh: boolean): string {
  if (audit.peerDecksExactlyEqual === false) {
    const groups = audit.peerDeckGroups.map((group) => group.actorIds.join(" / ")).join(" · ");
    return zh
      ? `同一轮出现 ${audit.peerDeckGroups.length} 组不同的公共 payload：${groups}。这不是多数意见问题，而是程序公平性问题。`
      : `${audit.peerDeckGroups.length} different public payload groups were observed in one round: ${groups}. This is a procedural fairness failure, not a voting disagreement.`;
  }
  const actors = [...audit.repairMismatchActorIds, ...audit.unpairedRepairActorIds].join(" / ");
  return zh
    ? `repair 连续性异常：${actors || "未知席位"}。修复格式时不应该更换公开会议上下文。`
    : `Repair continuity failed for ${actors || "an unknown seat"}. Formatting repair must not swap the public meeting context.`;
}

function shortFingerprint(value: string): string {
  return value.length <= 22 ? value : `${value.slice(0, 14)}…${value.slice(-6)}`;
}

function roundKey(audit: Pick<ProviderPublicDeckAudit, "sessionId" | "phase" | "round">): string {
  return `${audit.sessionId}|${audit.phase}|${audit.round}`;
}

function trimRounds(record: Record<string, ObservedRoundAudit>): Record<string, ObservedRoundAudit> {
  return Object.fromEntries(
    Object.entries(record)
      .sort((left, right) => right[1].observedAt.localeCompare(left[1].observedAt))
      .slice(0, 24),
  );
}

function isMeetingPhase(value: string): value is MeetingPhase {
  return value === "sealed" || value === "debate" || value === "final";
}

const root = document.getElementById("public-deck-integrity-root");
if (root) createRoot(root).render(<StrictMode><PublicDeckIntegrityPortal /></StrictMode>);
