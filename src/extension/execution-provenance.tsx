import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import type { CouncilEvent, CouncilParticipant, CouncilPhase } from "../core/types.js";
import {
  PROVIDER_EXECUTION_AUDIT_EVENT,
  type ProviderExecutionAuditEvent,
} from "../provider-sdk/execution-audit.js";
import {
  PROVIDER_TRANSPORT_AUDIT_EVENT,
  recordProviderTransportAudit,
  type ProviderExecutionMode,
  type ProviderTransportAuditRecord,
} from "../provider-sdk/transport-audit.js";
import {
  buildProviderAttendanceAudit,
  type ProviderAttendanceAuditModel,
  type ProviderTurnAttendanceAudit,
} from "../theater/provider-attendance.js";
import "./execution-provenance.css";

const PROPOSAL_DRAFT_KEY = "chatchat.consultation.proposal-draft.v1";
const TRANSPORT_EVENT = PROVIDER_TRANSPORT_AUDIT_EVENT;
const LIVE_EVENT = "chatchat:consultation-live";
const SYNTHETIC_SHOWCASE = new URLSearchParams(location.search).get("showcase") === "consultation";
const browserChrome = (globalThis as typeof globalThis & { chrome?: any }).chrome;

type ReceiptState = "sending" | "received" | "failed";
type ExecutionMode = ProviderExecutionMode;

interface TransportReceiptDetail extends ProviderTransportAuditRecord {
  state: ReceiptState;
}

interface TransportReceipt extends TransportReceiptDetail {
  host: string;
  title: string;
  attempts: number;
}

interface ConsultationLiveDetail {
  participants?: CouncilParticipant[];
  events?: CouncilEvent[];
}

installTransportObserver();

function ExecutionProvenance() {
  const [receipts, setReceipts] = useState<Record<string, TransportReceipt>>({});
  const [executionAudit, setExecutionAudit] = useState<ProviderExecutionAuditEvent[]>([]);
  const [participants, setParticipants] = useState<CouncilParticipant[]>([]);
  const [publicEvents, setPublicEvents] = useState<CouncilEvent[]>([]);
  const mode: ExecutionMode = SYNTHETIC_SHOWCASE ? "synthetic-showcase" : "live-provider-tabs";
  const zh = document.documentElement.lang.toLowerCase().startsWith("zh")
    || new URLSearchParams(location.search).get("lang") !== "en";

  useEffect(() => {
    document.documentElement.dataset.chatchatExecutionMode = mode;
    document.documentElement.classList.toggle("chatchat-synthetic-showcase", SYNTHETIC_SHOWCASE);
    if (!SYNTHETIC_SHOWCASE) return;
    return lockSyntheticFixtureUi();
  }, [mode]);

  useEffect(() => {
    const onReceipt = (event: Event) => {
      const detail = (event as CustomEvent<TransportReceiptDetail>).detail;
      if (!detail || typeof detail.tabId !== "number") return;
      void resolveTab(detail.tabId).then((tab) => {
        setReceipts((current) => {
          const key = transportKey(detail);
          const previous = current[key];
          const next: TransportReceipt = {
            ...detail,
            host: tab.host,
            title: tab.title,
            attempts: detail.state === "sending" ? (previous?.attempts ?? 0) + 1 : previous?.attempts ?? 1,
          };
          return trimReceiptRecord({ ...current, [key]: next });
        });
      });
    };
    const onExecutionAudit = (event: Event) => {
      const detail = (event as CustomEvent<ProviderExecutionAuditEvent>).detail;
      if (!detail?.sessionId || !detail.actorId) return;
      setExecutionAudit((current) => [...current, cloneExecutionAudit(detail)].slice(-500));
    };
    const onLive = (event: Event) => {
      const detail = (event as CustomEvent<ConsultationLiveDetail>).detail;
      if (Array.isArray(detail?.participants)) setParticipants(detail.participants.map((item) => ({ ...item })));
      if (Array.isArray(detail?.events)) setPublicEvents(detail.events.map((item) => ({ ...item })));
    };
    window.addEventListener(TRANSPORT_EVENT, onReceipt);
    window.addEventListener(PROVIDER_EXECUTION_AUDIT_EVENT, onExecutionAudit);
    window.addEventListener(LIVE_EVENT, onLive);
    return () => {
      window.removeEventListener(TRANSPORT_EVENT, onReceipt);
      window.removeEventListener(PROVIDER_EXECUTION_AUDIT_EVENT, onExecutionAudit);
      window.removeEventListener(LIVE_EVENT, onLive);
    };
  }, []);

  const transportRecords = useMemo(() => Object.values(receipts), [receipts]);
  const ordered = useMemo(
    () => [...transportRecords].sort((a, b) => b.observedAt.localeCompare(a.observedAt)).slice(0, 18),
    [transportRecords],
  );
  const attendance = useMemo(
    () => buildProviderAttendanceAudit(participants, transportRecords, executionAudit, publicEvents),
    [participants, transportRecords, executionAudit, publicEvents],
  );

  return (
    <div className={`execution-provenance mode-${mode}`} data-execution-mode={mode}>
      {SYNTHETIC_SHOWCASE ? <SyntheticBoundaryNotice /> : null}
      <AttendanceAudit model={attendance} zh={zh} synthetic={SYNTHETIC_SHOWCASE} />
      <section className="execution-receipts" aria-live="polite">
        <header>
          <div>
            <span>{SYNTHETIC_SHOWCASE ? "SYNTHETIC PROVIDER FIXTURE" : "LIVE PROVIDER RECEIPTS"}</span>
            <strong>{SYNTHETIC_SHOWCASE ? "这里没有调用真实 AI" : "真实标签页传输收据"}</strong>
            <p>{SYNTHETIC_SHOWCASE
              ? "这些收据只记录 CI / Demo 夹具返回。它们不能证明 ChatGPT、Claude、Gemini 或其他真实 Provider 做过推理。"
              : "这里证明哪一个真实 AI 标签页收到了本轮 Prompt、Prompt 中包含哪一个公共事件快照、页面是否返回响应以及耗时。它不展示也不声称读取模型隐藏思维链。"}</p>
          </div>
          <b className={`execution-mode-badge ${SYNTHETIC_SHOWCASE ? "is-demo" : "is-live"}`}>
            {SYNTHETIC_SHOWCASE ? "DEMO · SYNTHETIC" : "LIVE · PROVIDER TABS"}
          </b>
        </header>

        {ordered.length ? (
          <div className="execution-receipt-list">
            {ordered.map((receipt) => <ReceiptRow key={transportKey(receipt)} receipt={receipt} />)}
          </div>
        ) : (
          <div className="execution-receipts-empty">
            {SYNTHETIC_SHOWCASE
              ? "等待合成演示开始。"
              : "尚未发送正式协商轮次。开始协商后，每个真实 Provider 标签页的传输状态会出现在这里。"}
          </div>
        )}
      </section>
    </div>
  );
}

function AttendanceAudit({
  model,
  zh,
  synthetic,
}: {
  model: ProviderAttendanceAuditModel;
  zh: boolean;
  synthetic: boolean;
}) {
  const hasTurns = model.totalTurns > 0;
  return (
    <section
      className={`provider-attendance-audit ${hasTurns ? "has-turns" : "is-empty"}`}
      data-provider-attendance-audit={hasTurns ? "active" : "waiting"}
      data-provider-attendance-session={model.sessionId ?? ""}
    >
      <header>
        <div>
          <span>{zh ? "会议出席与执行审计" : "PROVIDER ATTENDANCE & EXECUTION AUDIT"}</span>
          <strong>{zh ? "谁真的来了、看到了什么、最后发布了什么" : "Who actually attended, what they saw, and what reached the Blackboard"}</strong>
          <p>{zh
            ? synthetic
              ? "下面仍然是合成夹具的审计链，用来证明 UI/协议流程；不能把这些席位当成真实第三方模型出席。"
              : "只有“真实标签页返回 → 结构化解析成功 → 事件进入 Blackboard”的轮次才会标记为已验证。页面响应本身不等于成功参与。"
            : synthetic
              ? "This is still a synthetic-fixture audit chain for UI/protocol proof; it is not evidence that third-party models attended."
              : "A turn is verified only after live tab response → structured parse → Blackboard publication. A page response alone is not successful attendance."}</p>
        </div>
        <div className="attendance-summary">
          <b>{model.verifiedTurns}/{model.totalTurns || 0}</b>
          <small>{zh ? "已验证轮次" : "verified turns"}</small>
        </div>
      </header>

      {hasTurns ? (
        <>
          <div className="attendance-metrics">
            <span>✓ {model.verifiedTurns} {zh ? "发布完成" : "published"}</span>
            <span>↺ {model.repairedTurns} {zh ? "格式修复" : "repaired"}</span>
            <span>≈ {model.fallbackTurns} fallback</span>
            <span>! {model.failedTurns} {zh ? "失败" : "failed"}</span>
          </div>
          <div className="attendance-seat-list">
            {model.seats.filter((seat) => seat.turns.length).map((seat) => (
              <article
                className="attendance-seat"
                key={seat.actorId}
                data-attendance-seat={seat.actorId}
                data-attendance-verified-turns={seat.verifiedTurns}
              >
                <div className="attendance-seat__heading">
                  <div><strong>{seat.participantName}</strong><span>{seat.host ?? seat.providerId}</span></div>
                  <b>{seat.verifiedTurns}/{seat.turns.length}</b>
                </div>
                <div className="attendance-turn-list">
                  {seat.turns.map((turn) => <AttendanceTurn key={turn.key} turn={turn} zh={zh} />)}
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="attendance-empty">
          {zh ? "尚未开始正式协商。开会后这里会逐轮形成不可冒充的执行链。" : "No consultation turn yet. Each seat will build a non-inferred execution chain here once the meeting starts."}
        </div>
      )}
    </section>
  );
}

function AttendanceTurn({ turn, zh }: { turn: ProviderTurnAttendanceAudit; zh: boolean }) {
  const label = attendanceStateLabel(turn.state, zh);
  const verified = turn.state === "published" || turn.state === "repaired";
  return (
    <div
      className={`attendance-turn state-${turn.state}`}
      data-attendance-turn-state={turn.state}
      data-attendance-round={turn.round}
      data-attendance-phase={turn.phase}
      data-attendance-snapshot-count={turn.snapshotEventIds.length}
      data-attendance-published-count={turn.publishedEventIds.length}
    >
      <div className="attendance-turn__top">
        <span>{turn.phase.toUpperCase()} · R{turn.round}</span>
        <b>{verified ? "✓ " : ""}{label}</b>
      </div>
      <div className="attendance-turn__chain">
        <span>{zh ? "快照" : "snapshot"} {turn.snapshotEventIds.length}</span>
        <i>→</i>
        <span>{turn.transportReceived ? (zh ? "页面已返回" : "response") : turn.transportFailed ? (zh ? "传输失败" : "failed") : (zh ? "等待响应" : "waiting")}</span>
        <i>→</i>
        <span>{turn.contributionKinds.length ? `${zh ? "解析" : "parsed"} ${turn.contributionKinds.length}` : (zh ? "未解析" : "not parsed")}</span>
        <i>→</i>
        <span>{zh ? "黑板" : "board"} {turn.publishedEventIds.length}</span>
      </div>
      <div className="attendance-turn__meta">
        {turn.repairRequested ? <em>↺ {zh ? "使用过 repair" : "repair used"}</em> : null}
        {turn.elapsedMs != null ? <em>{formatDuration(turn.elapsedMs)}</em> : null}
        {turn.responseChars != null ? <em>{turn.responseChars.toLocaleString()} chars</em> : null}
      </div>
      {(turn.snapshotEventIds.length || turn.publishedEventIds.length || turn.error) ? (
        <details>
          <summary>{zh ? "查看审计 ID" : "Audit IDs"}</summary>
          {turn.snapshotEventIds.length ? <p><b>{zh ? "本轮 Prompt 公共快照" : "Prompt public snapshot"}</b>{turn.snapshotEventIds.map((id) => <code key={id}>{id}</code>)}</p> : null}
          {turn.publishedEventIds.length ? <p><b>{zh ? "本轮发布事件" : "Published events"}</b>{turn.publishedEventIds.map((id) => <code key={id}>{id}</code>)}</p> : null}
          {turn.error ? <p className="attendance-turn__error">{turn.error}</p> : null}
        </details>
      ) : null}
    </div>
  );
}

function SyntheticBoundaryNotice() {
  const zh = new URLSearchParams(location.search).get("lang") !== "en";
  return (
    <section className="synthetic-boundary" data-synthetic-showcase-warning="visible">
      <div className="synthetic-boundary__icon">!</div>
      <div>
        <span>{zh ? "合成演示模式" : "SYNTHETIC SHOWCASE MODE"}</span>
        <strong>{zh ? "这不是一场真实 AI 协商" : "This is not a live AI consultation"}</strong>
        <p>{zh
          ? "?showcase=consultation 会用固定测试夹具模拟标签页、READY 状态和会议回答。不会把你的自定义提案发送给 ChatGPT、Claude、Gemini、DeepSeek、Grok 或元宝。提案框在演示模式下会被锁定。"
          : "?showcase=consultation replaces provider tabs, READY states and meeting answers with deterministic test fixtures. Your custom proposal is not sent to ChatGPT, Claude, Gemini or any other live provider. The proposal field is locked in demo mode."}</p>
      </div>
      <button type="button" onClick={exitSyntheticShowcase}>
        {zh ? "退出 Demo，进入真实模式 →" : "Exit demo for live provider mode →"}
      </button>
    </section>
  );
}

function ReceiptRow({ receipt }: { receipt: TransportReceipt }) {
  const label = receipt.state === "sending"
    ? "PROMPT SENT"
    : receipt.state === "received"
      ? "RESPONSE CAPTURED"
      : "TRANSPORT FAILED";
  return (
    <article
      className={`execution-receipt state-${receipt.state}`}
      data-provider-receipt={receipt.state}
      data-provider-tab={receipt.tabId}
      data-provider-phase={receipt.phase}
      data-provider-round={receipt.round}
      data-provider-snapshot-count={receipt.snapshotEventIds.length}
      data-provider-repair={receipt.repairAttempt ? "true" : "false"}
    >
      <div className="execution-receipt__status"><i />{label}</div>
      <div className="execution-receipt__identity">
        <strong>{receipt.title || receipt.host || `Tab ${receipt.tabId}`}</strong>
        <span>{receipt.host || `tab:${receipt.tabId}`}</span>
      </div>
      <div className="execution-receipt__meta">
        <span>{receipt.phase.toUpperCase()} · R{receipt.round}</span>
        <span>{receipt.snapshotEventIds.length} snapshot events</span>
        <span>{receipt.promptChars.toLocaleString()} prompt chars</span>
        {receipt.responseChars != null ? <span>{receipt.responseChars.toLocaleString()} response chars</span> : null}
        {receipt.elapsedMs != null ? <span>{formatDuration(receipt.elapsedMs)}</span> : null}
        {receipt.repairAttempt ? <span>REPAIR</span> : null}
        {receipt.attempts > 1 ? <span>{receipt.attempts} sends</span> : null}
      </div>
      {receipt.error ? <p>{receipt.error}</p> : null}
    </article>
  );
}

function installTransportObserver() {
  const tabs = browserChrome?.tabs;
  if (!tabs || typeof tabs.sendMessage !== "function") return;
  const existing = tabs.sendMessage as typeof tabs.sendMessage & { __chatchatExecutionProvenance?: boolean };
  if (existing.__chatchatExecutionProvenance) return;

  const original = tabs.sendMessage.bind(tabs);
  let syntheticProposal: Promise<string | null> | null = null;

  const wrapped = (async (tabId: number, payload: any, ...rest: any[]) => {
    if (!payload?.__chatchat || payload.type !== "RUN_SPEECH" || typeof payload.prompt !== "string") {
      return original(tabId, payload, ...rest);
    }

    const prompt = String(payload.prompt);
    if (isHandshakePrompt(prompt)) return original(tabId, payload, ...rest);

    const meta = promptMeta(prompt);
    const mode: ExecutionMode = SYNTHETIC_SHOWCASE ? "synthetic-showcase" : "live-provider-tabs";

    if (SYNTHETIC_SHOWCASE) {
      syntheticProposal ??= readSyntheticProposal();
      const allowedProposal = await syntheticProposal;
      if (!allowedProposal || !prompt.includes(allowedProposal)) {
        const error = "Synthetic showcase only supports its fixed demo proposal. Reload without ?showcase=consultation to send a real proposal to live provider tabs.";
        dispatchReceipt({ tabId, state: "failed", mode, ...meta, promptChars: prompt.length, error, observedAt: new Date().toISOString() });
        return { ok: false, error };
      }
    }

    dispatchReceipt({ tabId, state: "sending", mode, ...meta, promptChars: prompt.length, observedAt: new Date().toISOString() });
    try {
      const response = await original(tabId, payload, ...rest);
      if (!response?.ok) {
        dispatchReceipt({
          tabId,
          state: "failed",
          mode,
          ...meta,
          promptChars: prompt.length,
          error: String(response?.error || "Provider tab did not answer ChatChat."),
          observedAt: new Date().toISOString(),
        });
        return response;
      }
      const speech = response?.result;
      dispatchReceipt({
        tabId,
        state: "received",
        mode,
        ...meta,
        promptChars: prompt.length,
        responseChars: typeof speech?.responseText === "string" ? speech.responseText.length : 0,
        elapsedMs: typeof speech?.elapsedMs === "number" ? speech.elapsedMs : undefined,
        observedAt: new Date().toISOString(),
      });
      return response;
    } catch (caught) {
      dispatchReceipt({
        tabId,
        state: "failed",
        mode,
        ...meta,
        promptChars: prompt.length,
        error: caught instanceof Error ? caught.message : String(caught),
        observedAt: new Date().toISOString(),
      });
      throw caught;
    }
  }) as typeof existing;

  wrapped.__chatchatExecutionProvenance = true;
  try {
    tabs.sendMessage = wrapped;
  } catch {
    // If a browser ever exposes a non-writable API method, keep the product
    // functional even though transport receipts cannot be observed there.
  }
}

function promptMeta(prompt: string): Omit<TransportReceiptDetail, "tabId" | "state" | "mode" | "promptChars" | "observedAt"> {
  const phaseText = prompt.match(/PHASE:\s*(sealed|debate|final)/i)?.[1]?.toLowerCase() ?? "consultation";
  const phase = isPhase(phaseText) ? phaseText : "consultation";
  const round = Number(prompt.match(/ROUND:\s*(\d+)/i)?.[1] ?? "0");
  const sessionId = prompt.match(/SESSION_ID:\s*([^\n]+)/)?.[1]?.trim() ?? "unknown-session";
  const actorId = prompt.match(/YOUR_ACTOR_ID:\s*([^\n]+)/)?.[1]?.trim() ?? "unknown-actor";
  const snapshotEventIds = parseJsonLine(prompt, "PUBLIC_SNAPSHOT_EVENT_IDS_JSON");
  return {
    sessionId,
    actorId,
    phase,
    round,
    snapshotEventIds,
    repairAttempt: /\nREPAIR ATTEMPT:\s*/i.test(prompt),
  };
}

function parseJsonLine(prompt: string, label: string): string[] {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const raw = prompt.match(new RegExp(`${escaped}:\\s*([^\\n]+)`))?.[1];
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function isPhase(value: string): value is CouncilPhase {
  return value === "sealed" || value === "debate" || value === "final";
}

function isHandshakePrompt(prompt: string): boolean {
  return /automatic connection handshake|connection test|Protocol handshake only/i.test(prompt);
}

async function readSyntheticProposal(): Promise<string | null> {
  try {
    const store = browserChrome?.storage?.session ?? browserChrome?.storage?.local;
    const stored = await store?.get?.(PROPOSAL_DRAFT_KEY);
    const value = stored?.[PROPOSAL_DRAFT_KEY];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

function dispatchReceipt(detail: TransportReceiptDetail) {
  recordProviderTransportAudit(detail);
}

async function resolveTab(tabId: number): Promise<{ host: string; title: string }> {
  try {
    const tab = await browserChrome?.tabs?.get?.(tabId);
    const url = typeof tab?.url === "string" ? tab.url : "";
    const host = url ? new URL(url).hostname : "";
    return { host, title: String(tab?.title ?? "") };
  } catch {
    return { host: "", title: `Tab ${tabId}` };
  }
}

function lockSyntheticFixtureUi() {
  const apply = () => {
    const textarea = document.querySelector(".proposal-card textarea");
    if (textarea instanceof HTMLTextAreaElement) {
      textarea.readOnly = true;
      textarea.dataset.syntheticProposalLocked = "true";
      textarea.setAttribute("aria-label", "Synthetic demo proposal — locked");
    }
  };
  apply();
  const observer = new MutationObserver(apply);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => observer.disconnect();
}

function exitSyntheticShowcase() {
  const url = new URL(location.href);
  url.searchParams.delete("showcase");
  url.searchParams.delete("live-proof");
  location.assign(url.toString());
}

function attendanceStateLabel(state: ProviderTurnAttendanceAudit["state"], zh: boolean): string {
  if (state === "published") return zh ? "已验证" : "VERIFIED";
  if (state === "repaired") return zh ? "已验证 · 修复后" : "VERIFIED · REPAIRED";
  if (state === "fallback") return "FALLBACK";
  if (state === "failed") return zh ? "失败" : "FAILED";
  if (state === "structured_parsed") return zh ? "已解析，等待发布" : "PARSED · WAITING";
  if (state === "response_captured") return zh ? "已捕获页面响应" : "RESPONSE CAPTURED";
  if (state === "prompt_sent") return zh ? "Prompt 已发送" : "PROMPT SENT";
  return zh ? "轮次已开始" : "TURN STARTED";
}

function transportKey(receipt: Pick<TransportReceiptDetail, "tabId" | "sessionId" | "actorId" | "phase" | "round" | "repairAttempt">): string {
  return `${receipt.sessionId}|${receipt.actorId}|${receipt.tabId}|${receipt.phase}|${receipt.round}|${receipt.repairAttempt ? "repair" : "first"}`;
}

function trimReceiptRecord(record: Record<string, TransportReceipt>): Record<string, TransportReceipt> {
  const entries = Object.entries(record).sort((a, b) => b[1].observedAt.localeCompare(a[1].observedAt)).slice(0, 240);
  return Object.fromEntries(entries);
}

function cloneExecutionAudit(event: ProviderExecutionAuditEvent): ProviderExecutionAuditEvent {
  return {
    ...event,
    snapshotEventIds: [...event.snapshotEventIds],
    ...(event.contributionKinds ? { contributionKinds: [...event.contributionKinds] } : {}),
  };
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

const root = document.getElementById("execution-provenance-root");
if (!root) throw new Error("ChatChat execution provenance root is missing.");
createRoot(root).render(<StrictMode><ExecutionProvenance /></StrictMode>);
