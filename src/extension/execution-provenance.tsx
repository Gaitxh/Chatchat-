import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./execution-provenance.css";

declare const chrome: any;

const PROPOSAL_DRAFT_KEY = "chatchat.consultation.proposal-draft.v1";
const TRANSPORT_EVENT = "chatchat:provider-transport";
const SYNTHETIC_SHOWCASE = new URLSearchParams(location.search).get("showcase") === "consultation";

type ReceiptState = "sending" | "received" | "failed";
type ExecutionMode = "synthetic-showcase" | "live-provider-tabs";

interface TransportReceiptDetail {
  tabId: number;
  state: ReceiptState;
  mode: ExecutionMode;
  phase: string;
  round: number;
  promptChars: number;
  responseChars?: number;
  elapsedMs?: number;
  error?: string;
  observedAt: string;
}

interface TransportReceipt extends TransportReceiptDetail {
  host: string;
  title: string;
  attempts: number;
}

installTransportObserver();

function ExecutionProvenance() {
  const [receipts, setReceipts] = useState<Record<number, TransportReceipt>>({});
  const mode: ExecutionMode = SYNTHETIC_SHOWCASE ? "synthetic-showcase" : "live-provider-tabs";

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
          const previous = current[detail.tabId];
          const next: TransportReceipt = {
            ...detail,
            host: tab.host,
            title: tab.title,
            attempts: detail.state === "sending" ? (previous?.attempts ?? 0) + 1 : previous?.attempts ?? 1,
          };
          return { ...current, [detail.tabId]: next };
        });
      });
    };
    window.addEventListener(TRANSPORT_EVENT, onReceipt);
    return () => window.removeEventListener(TRANSPORT_EVENT, onReceipt);
  }, []);

  const ordered = useMemo(
    () => Object.values(receipts).sort((a, b) => a.tabId - b.tabId),
    [receipts],
  );

  return (
    <div className={`execution-provenance mode-${mode}`} data-execution-mode={mode}>
      {SYNTHETIC_SHOWCASE ? <SyntheticBoundaryNotice /> : null}
      <section className="execution-receipts" aria-live="polite">
        <header>
          <div>
            <span>{SYNTHETIC_SHOWCASE ? "SYNTHETIC PROVIDER FIXTURE" : "LIVE PROVIDER RECEIPTS"}</span>
            <strong>{SYNTHETIC_SHOWCASE ? "这里没有调用真实 AI" : "真实标签页传输收据"}</strong>
            <p>{SYNTHETIC_SHOWCASE
              ? "这些收据只记录 CI / Demo 夹具返回。它们不能证明 ChatGPT、Claude、Gemini 或其他真实 Provider 做过推理。"
              : "这里证明哪一个真实 AI 标签页收到了本轮 Prompt、是否返回了页面响应以及耗时。它不展示也不声称读取模型隐藏思维链。"}</p>
          </div>
          <b className={`execution-mode-badge ${SYNTHETIC_SHOWCASE ? "is-demo" : "is-live"}`}>
            {SYNTHETIC_SHOWCASE ? "DEMO · SYNTHETIC" : "LIVE · PROVIDER TABS"}
          </b>
        </header>

        {ordered.length ? (
          <div className="execution-receipt-list">
            {ordered.map((receipt) => <ReceiptRow key={receipt.tabId} receipt={receipt} />)}
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
    >
      <div className="execution-receipt__status"><i />{label}</div>
      <div className="execution-receipt__identity">
        <strong>{receipt.title || receipt.host || `Tab ${receipt.tabId}`}</strong>
        <span>{receipt.host || `tab:${receipt.tabId}`}</span>
      </div>
      <div className="execution-receipt__meta">
        <span>{receipt.phase.toUpperCase()} · R{receipt.round}</span>
        <span>{receipt.promptChars.toLocaleString()} prompt chars</span>
        {receipt.responseChars != null ? <span>{receipt.responseChars.toLocaleString()} response chars</span> : null}
        {receipt.elapsedMs != null ? <span>{formatDuration(receipt.elapsedMs)}</span> : null}
        {receipt.attempts > 1 ? <span>{receipt.attempts} attempts</span> : null}
      </div>
      {receipt.error ? <p>{receipt.error}</p> : null}
    </article>
  );
}

function installTransportObserver() {
  const tabs = chrome?.tabs;
  if (!tabs || typeof tabs.sendMessage !== "function") return;
  const existing = tabs.sendMessage as typeof tabs.sendMessage & { __chatchatExecutionProvenance?: boolean };
  if (existing.__chatchatExecutionProvenance) return;

  const original = tabs.sendMessage.bind(tabs);
  let syntheticProposal: Promise<string | null> | null = null;

  const wrapped = async (tabId: number, payload: any, ...rest: any[]) => {
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
  };

  wrapped.__chatchatExecutionProvenance = true;
  tabs.sendMessage = wrapped;
}

function promptMeta(prompt: string): { phase: string; round: number } {
  const phase = prompt.match(/PHASE:\s*(sealed|debate|final)/i)?.[1]?.toLowerCase() ?? "consultation";
  const round = Number(prompt.match(/ROUND:\s*(\d+)/i)?.[1] ?? "0");
  return { phase, round };
}

function isHandshakePrompt(prompt: string): boolean {
  return /automatic connection handshake|connection test|Protocol handshake only/i.test(prompt);
}

async function readSyntheticProposal(): Promise<string | null> {
  try {
    const store = chrome.storage?.session ?? chrome.storage?.local;
    const stored = await store?.get?.(PROPOSAL_DRAFT_KEY);
    const value = stored?.[PROPOSAL_DRAFT_KEY];
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

function dispatchReceipt(detail: TransportReceiptDetail) {
  window.dispatchEvent(new CustomEvent<TransportReceiptDetail>(TRANSPORT_EVENT, { detail }));
}

async function resolveTab(tabId: number): Promise<{ host: string; title: string }> {
  try {
    const tab = await chrome.tabs.get(tabId);
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

function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

const root = document.getElementById("execution-provenance-root");
if (!root) throw new Error("ChatChat execution provenance root is missing.");
createRoot(root).render(<StrictMode><ExecutionProvenance /></StrictMode>);
