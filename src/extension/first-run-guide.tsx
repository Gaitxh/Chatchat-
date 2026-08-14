import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { normalizeLocale, type Locale } from "../i18n/index.js";
import "./first-run-guide.css";

declare const chrome: any;

const DONE_KEY = "chatchat.first-consultation-guide.done.v1";

interface GuideState {
  participantCount: number;
  readyCount: number;
  discoveredCount: number;
  running: boolean;
  rows: Array<{ name: string; state: "ready" | "connecting" | "help" | "idle" }>;
}

const COPY = {
  en: {
    kicker: "FIRST CONSULTATION",
    title0: "Bring two AIs into the room",
    body0: "Open the AI sites you already use. ChatChat will find the tabs, connect them, and verify the consultation protocol automatically.",
    found: "{count} AI tab(s) found",
    find: "Find my AIs",
    connect: "Connect discovered AIs",
    tip0: "Already signed in? Great. Not signed in yet? Sign in normally in the AI tab — ChatChat will continue by itself.",
    title1: "ChatChat is preparing the room",
    body1: "No selectors, adapters, or protocol jargon required. You can keep using the computer normally while each AI becomes READY.",
    progress: "{ready}/2 READY",
    login: "If one AI is waiting on a login page, finish signing in there. ChatChat automatically retries after the page loads.",
    title2: "The room is ready",
    body2: "Two or more independent AI participants are READY. Write one question below and watch the meeting come alive.",
    write: "Write my first proposal",
    done: "Got it",
    ready: "READY",
    connecting: "connecting",
    help: "waiting / retrying",
    idle: "not connected",
  },
  "zh-CN": {
    kicker: "第一次协商",
    title0: "先把两个 AI 拉进会议室",
    body0: "打开你平时就在用的 AI 网站。ChatChat 会自己找到标签页、自动连接，并自动验证协商协议。",
    found: "发现 {count} 个 AI 标签页",
    find: "查找我的 AI",
    connect: "自动连接发现的 AI",
    tip0: "已经登录？直接用。还没登录？在 AI 标签页里正常登录就行，ChatChat 会自己接着往下做。",
    title1: "ChatChat 正在替你准备会议室",
    body1: "你不需要懂 selector、adapter 或协议验证。照常使用电脑，等每个 AI 自己变成 READY。",
    progress: "{ready}/2 已就绪",
    login: "如果某个 AI 停在登录页，你只需要正常完成登录。页面加载后 ChatChat 会自动重新尝试。",
    title2: "会议室准备好了",
    body2: "已经有至少两个独立 AI READY。现在只需要写一个问题，然后看这场会议自己活起来。",
    write: "写下我的第一个提案",
    done: "知道了",
    ready: "已就绪",
    connecting: "自动连接中",
    help: "等待登录 / 自动重试",
    idle: "尚未连接",
  },
} as const;

function FirstRunGuide() {
  const [locale, setLocale] = useState<Locale>(() => normalizeLocale(document.documentElement.lang));
  const [done, setDone] = useState(true);
  const [state, setState] = useState<GuideState>(() => readDomState());

  useEffect(() => {
    void chrome.storage.local.get(DONE_KEY).then((value: Record<string, unknown>) => {
      setDone(Boolean(value[DONE_KEY]));
    });
    const observer = new MutationObserver(() => setState(readDomState()));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    const localeObserver = new MutationObserver(() => setLocale(normalizeLocale(document.documentElement.lang)));
    localeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    return () => { observer.disconnect(); localeObserver.disconnect(); };
  }, []);

  useEffect(() => {
    const root = document.getElementById("first-run-guide-root");
    const hero = document.querySelector(".consultation-app .consultation-hero");
    if (!root || !hero?.parentElement) return;
    if (root.previousElementSibling !== hero) hero.after(root);
  }, [state.participantCount]);

  if (done || state.running) return null;
  const copy = COPY[locale];
  const stage = state.readyCount >= 2 ? 2 : state.participantCount > 0 ? 1 : 0;

  return (
    <section className={`first-run-guide guide-stage-${stage}`}>
      <div className="guide-topline">
        <span>{copy.kicker}</span>
        <button type="button" aria-label={copy.done} onClick={() => void finishGuide()}>×</button>
      </div>
      <div className="guide-steps" aria-hidden="true"><i className="done">1</i><b /><i className={stage >= 1 ? "done" : ""}>2</i><b /><i className={stage >= 2 ? "done" : ""}>3</i></div>

      {stage === 0 ? (
        <>
          <h2>{copy.title0}</h2><p>{copy.body0}</p>
          <div className="guide-discovery"><strong>{copy.found.replace("{count}", String(state.discoveredCount))}</strong><span>{state.discoveredCount ? "●●" : "○○"}</span></div>
          <button className="guide-primary" type="button" onClick={state.discoveredCount ? clickConnectAll : clickFindAIs}>{state.discoveredCount ? copy.connect : copy.find}<b>→</b></button>
          <small>{copy.tip0}</small>
        </>
      ) : stage === 1 ? (
        <>
          <h2>{copy.title1}</h2><p>{copy.body1}</p>
          <div className="guide-progress"><div><strong>{copy.progress.replace("{ready}", String(state.readyCount))}</strong><span>{Math.round(Math.min(1, state.readyCount / 2) * 100)}%</span></div><i><b style={{ width: `${Math.min(100, state.readyCount * 50)}%` }} /></i></div>
          <div className="guide-roster">{state.rows.map((row, index) => <div key={`${row.name}-${index}`}><span>{row.name}</span><b className={`guide-state state-${row.state}`}>{stateLabel(row.state, copy)}</b></div>)}</div>
          <small>{copy.login}</small>
        </>
      ) : (
        <>
          <div className="guide-ready-mark">✦</div><h2>{copy.title2}</h2><p>{copy.body2}</p>
          <button className="guide-primary" type="button" onClick={() => void focusProposal()}>{copy.write}<b>↓</b></button>
        </>
      )}
    </section>
  );

  async function finishGuide() {
    await chrome.storage.local.set({ [DONE_KEY]: true });
    setDone(true);
  }

  async function focusProposal() {
    await finishGuide();
    const textarea = document.querySelector<HTMLTextAreaElement>(".proposal-card textarea");
    textarea?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => textarea?.focus(), 350);
  }
}

function readDomState(): GuideState {
  const rows = [...document.querySelectorAll<HTMLElement>(".participant-row")];
  return {
    participantCount: rows.length,
    readyCount: rows.filter((row) => row.classList.contains("connection-ready")).length,
    discoveredCount: document.querySelectorAll(".discovered-tab").length,
    running: Boolean(document.querySelector(".consultation-progress,.outcome-card")),
    rows: rows.map((row) => ({
      name: row.querySelector(".participant-main strong")?.textContent?.trim() || "AI",
      state: row.classList.contains("connection-ready") ? "ready" : row.classList.contains("connection-connecting") ? "connecting" : row.classList.contains("connection-failed") ? "help" : "idle",
    })),
  };
}

function clickConnectAll() {
  (document.querySelector(".connect-all-button") as HTMLButtonElement | null)?.click();
}

function clickFindAIs() {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>(".participant-actions button")];
  (buttons[1] ?? buttons[0])?.click();
}

function stateLabel(state: GuideState["rows"][number]["state"], copy: typeof COPY.en | typeof COPY["zh-CN"]): string {
  if (state === "ready") return copy.ready;
  if (state === "connecting") return copy.connecting;
  if (state === "help") return copy.help;
  return copy.idle;
}

const root = document.getElementById("first-run-guide-root");
if (!root) throw new Error("ChatChat first-run guide root is missing.");

if (document.documentElement.dataset.surface === "web-app") {
  // The Full Room now has a zero-config Launch Lobby. Rendering the legacy guide
  // here would create a second onboarding immediately after assembly completes.
  root.hidden = true;
} else {
  createRoot(root).render(<StrictMode><FirstRunGuide /></StrictMode>);
}
